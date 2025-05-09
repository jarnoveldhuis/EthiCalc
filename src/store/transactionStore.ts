// src/store/transactionStore.ts

// --- Base Imports ---
import { create } from "zustand";
import { Transaction, Charity, Citation } from "@/shared/types/transactions";
import { ImpactAnalysis } from "@/core/calculations/type";
import { calculationService } from "@/core/calculations/impactService";
import { User } from "firebase/auth";
import { auth, db } from "@/core/firebase/firebase";
import { Timestamp, doc, getDoc, setDoc } from "firebase/firestore";
import { config } from "@/config";
import {
  mapPlaidTransactions,
  mergeTransactions,
} from "@/core/plaid/transactionMapper";
import {
  getVendorAnalysis,
  saveVendorAnalysis,
  normalizeVendorName,
} from "@/features/vendors/vendorStorageService";
import { VendorAnalysis } from "@/shared/types/vendors";
import { firebaseDebug } from "@/core/firebase/debugUtils";

// --- Value Setting Imports ---
import {
  VALUE_CATEGORIES,
  NEUTRAL_LEVEL,
  MIN_LEVEL,
  MAX_LEVEL,
  NEGATIVE_PRACTICE_MULTIPLIERS,
} from "@/config/valuesConfig";

// --- TYPES --- (Keep as before)
export type AppStatus =
  | "idle"
  | "initializing"
  | "connecting_bank"
  | "fetching_plaid"
  | "analyzing"
  | "saving_batch"
  | "saving_cache"
  | "applying_credit"
  | "loading_latest"
  | "loading_credit_state"
  | "loading_settings"
  | "saving_settings"
  | "error";
interface BankConnectionStatus {
  isConnected: boolean;
  error: string | null;
}
interface CreditState {
  availableCredit: number;
  appliedCredit: number;
  lastAppliedAmount: number;
  lastAppliedAt: Timestamp | null;
}
export type UserValueSettings = { [categoryId: string]: number };
interface StoredTokenInfo {
  token: string;
  userId: string;
  timestamp: number;
}
interface ApiAnalysisResultItem {
  plaidTransactionId?: string;
  societalDebt?: number;
  unethicalPractices?: string[];
  ethicalPractices?: string[];
  practiceWeights?: Record<string, number>;
  practiceDebts?: Record<string, number>;
  practiceSearchTerms?: Record<string, string>;
  practiceCategories?: Record<string, string>;
  charities?: Record<string, Charity>;
  information?: Record<string, string>;
  citations?: Record<string, Citation[]>;
  name?: string;
}
interface ApiAnalysisResponse {
  transactions: ApiAnalysisResultItem[];
  error?: string;
}

// --- MAIN STATE INTERFACE --- (Keep as before)
export interface TransactionState {
  transactions: Transaction[];
  savedTransactions: Transaction[] | null;
  impactAnalysis: ImpactAnalysis | null;
  connectionStatus: BankConnectionStatus;
  creditState: CreditState;
  appStatus: AppStatus;
  hasSavedData: boolean;
  userValueSettings: UserValueSettings;
  valuesCommittedUntil: Timestamp | null;
  // Actions
  setTransactions: (transactions: Transaction[]) => void;
  connectBank: (publicToken: string, user: User | null) => Promise<void>;
  disconnectBank: () => void;
  fetchTransactions: (accessToken?: string) => Promise<void>;
  manuallyFetchTransactions: () => Promise<void>;
  analyzeAndCacheTransactions: (
    rawTransactions: Transaction[]
  ) => Promise<void>;
  saveTransactionBatch: (transactions: Transaction[]) => Promise<void>;
  applyCredit: (amount: number) => Promise<boolean>;
  loadLatestTransactions: () => Promise<boolean>;
  loadCreditState: () => Promise<CreditState | null>;
  resetState: () => void;
  initializeStore: (user: User | null) => Promise<void>;
  initializeUserValueSettings: (userId: string) => Promise<void>;
  updateUserValue: (
    userId: string,
    categoryId: string,
    newLevel: number
  ) => Promise<void>;
  getUserValueMultiplier: (practiceCategoryName: string | undefined) => number;
  resetUserValuesToDefault: (userId: string) => Promise<void>;
  commitUserValues: (userId: string) => Promise<void>;
}

// --- Helper Functions --- (Keep as before)
function getTransactionIdentifier(transaction: Transaction): string | null {
  const plaidId = transaction.plaidTransactionId;
  if (plaidId) return `plaid-${plaidId}`;
  if (
    transaction.date &&
    transaction.name &&
    typeof transaction.amount === "number"
  )
    return `${transaction.date}-${transaction.name
      .trim()
      .toUpperCase()}-${transaction.amount.toFixed(2)}`;
  return null;
}
function sanitizeDataForFirestore<T>(data: T): T | null {
  if (data === undefined) return null;
  if (data === null || typeof data !== "object") return data;
  if (data instanceof Timestamp) return data;
  if (Array.isArray(data)) {
    return data
      .map((item) => sanitizeDataForFirestore(item))
      .filter((item) => item !== undefined) as T;
  }
  const sanitizedObject: { [key: string]: unknown } = {};
  for (const key in data) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      const value = (data as Record<string, unknown>)[key];
      const sanitizedValue = sanitizeDataForFirestore(value);
      if (sanitizedValue !== undefined) {
        sanitizedObject[key] = sanitizedValue;
      }
    }
  }
  return sanitizedObject as T;
}
const getAuthHeader = async (): Promise<HeadersInit | null> => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    console.warn("getAuthHeader: No current user found.");
    return null;
  }
  try {
    const token = await currentUser.getIdToken(true);
    if (!token) {
      console.warn("getAuthHeader: Failed to get ID token.");
      return null;
    }
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  } catch (error) {
    console.error("getAuthHeader: Error getting ID token:", error);
    return null;
  }
};

// --- STORE IMPLEMENTATION ---
export const useTransactionStore = create<TransactionState>((set, get) => ({
  // --- Initial State --- (Keep as before)
  transactions: [],
  savedTransactions: null,
  impactAnalysis: null,
  connectionStatus: { isConnected: false, error: null },
  creditState: {
    availableCredit: 0,
    appliedCredit: 0,
    lastAppliedAmount: 0,
    lastAppliedAt: null,
  },
  appStatus: "idle",
  hasSavedData: false,
  userValueSettings: VALUE_CATEGORIES.reduce((acc, category) => {
    acc[category.id] = category.defaultLevel;
    return acc;
  }, {} as UserValueSettings),
  valuesCommittedUntil: null,

  // --- Core Actions ---

  setTransactions: (transactions) => {
    /* ... implementation from prev response ... */
    const currentAppliedCredit = get().creditState.appliedCredit;
    const currentUserValueSettings = get().userValueSettings;
    const analysis = calculationService.calculateImpactAnalysis(
      transactions,
      currentAppliedCredit,
      currentUserValueSettings
    );
    set({
      transactions: transactions,
      impactAnalysis: analysis,
      creditState: {
        ...get().creditState,
        availableCredit: analysis.availableCredit,
      },
    });
  },
  connectBank: async (publicToken, user) => {
    /* ... implementation from prev response ... */
    const { appStatus } = get();
    if (!user || (appStatus !== "idle" && appStatus !== "error")) return;
    set({
      appStatus: "connecting_bank",
      connectionStatus: { isConnected: false, error: null },
    });
    let exchangedToken: string | null = null;
    try {
      const authHeaders = await getAuthHeader();
      if (!authHeaders)
        throw new Error("User not authenticated for token exchange.");
      const response = await fetch("/api/banking/exchange_token", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ public_token: publicToken }),
      });
      const data = await response.json();
      if (!response.ok || !data.access_token)
        throw new Error(
          data.error || `Token exchange failed (${response.status})`
        );
      exchangedToken = data.access_token;
      const tokenInfo: StoredTokenInfo = {
        token: exchangedToken!,
        userId: user.uid,
        timestamp: Date.now(),
      };
      localStorage.setItem(
        "plaid_access_token_info",
        JSON.stringify(tokenInfo)
      );
      set((state) => ({
        connectionStatus: {
          ...state.connectionStatus,
          isConnected: true,
          error: null,
        },
        appStatus: "idle",
      }));
      try {
        sessionStorage.removeItem("wasManuallyDisconnected");
      } catch (e) {
        console.error(e);
      }
      console.log("connectBank: Token exchanged, fetching transactions...");
      await get().fetchTransactions(exchangedToken ?? undefined);
    } catch (error) {
      console.error("Error connecting bank:", error);
      set({
        appStatus: "error",
        connectionStatus: {
          isConnected: false,
          error:
            error instanceof Error ? error.message : "Failed to connect bank",
        },
      });
    }
  },
  resetState: () => {
    /* ... implementation from prev response ... */
    console.log("resetState: Triggered.");
    const defaultSettings = VALUE_CATEGORIES.reduce((acc, category) => {
      acc[category.id] = category.defaultLevel;
      return acc;
    }, {} as UserValueSettings);
    try {
      sessionStorage.setItem("wasManuallyDisconnected", "true");
    } catch (e) {
      console.error(e);
    }
    try {
      localStorage.removeItem("plaid_access_token_info");
    } catch (e) {
      console.error(e);
    }
    set({
      transactions: [],
      savedTransactions: null,
      impactAnalysis: null,
      connectionStatus: { isConnected: false, error: null },
      creditState: {
        availableCredit: 0,
        appliedCredit: 0,
        lastAppliedAmount: 0,
        lastAppliedAt: null,
      },
      appStatus: "idle",
      hasSavedData: false,
      userValueSettings: defaultSettings,
      valuesCommittedUntil: null,
    });
  },
  disconnectBank: () => {
    get().resetState();
  },

  fetchTransactions: async (accessToken) => {
    const { appStatus } = get();
    if (
      appStatus !== "idle" &&
      appStatus !== "error" &&
      appStatus !== "initializing" &&
      appStatus !== "loading_settings"
    ) {
      console.log(
        `WorkspaceTransactions: Skipping (Current Status: ${appStatus}).`
      );
      return;
    }
    set({
      appStatus: "fetching_plaid",
      connectionStatus: { ...get().connectionStatus, error: null },
    });
    let tokenToUse: string | null = accessToken || null;
    const currentUserId = auth.currentUser?.uid;
    try {
      const authHeaders = await getAuthHeader();
      if (!authHeaders)
        throw new Error("User not authenticated for fetching transactions.");
      if (!tokenToUse) {
        const storedData = localStorage.getItem("plaid_access_token_info");
        if (!storedData) throw new Error("No access token available");
        try {
          const tokenInfo = JSON.parse(storedData) as StoredTokenInfo;
          if (!currentUserId || tokenInfo.userId !== currentUserId) {
            localStorage.removeItem("plaid_access_token_info");
            throw new Error("Invalid access token for current user.");
          }
          tokenToUse = tokenInfo.token;
        } catch (parseError) {
          // << parseError is DEFINED here
          localStorage.removeItem("plaid_access_token_info");
          // LINT FIX: Log the parseError variable
          console.error("Error parsing stored Plaid token:", parseError);
          throw new Error("Failed to read stored access token.");
        }
      }
      if (!tokenToUse) throw new Error("Access token missing after checks.");
      firebaseDebug.log("PLAID_FETCH", {
        status: "starting",
        tokenPresent: !!tokenToUse,
      });
      const response = await fetch("/api/banking/transactions", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ access_token: tokenToUse }),
      });
      firebaseDebug.log("PLAID_FETCH", {
        status: "response_received",
        ok: response.ok,
        statusCode: response.status,
      });
      if (!response.ok) {
        /* ... error handling ... */ const errorData = await response
          .json()
          .catch(() => ({}));
        firebaseDebug.log("PLAID_FETCH", {
          status: "error_response",
          errorData,
        });
        if (errorData.error?.includes("ITEM_LOGIN_REQUIRED")) {
          get().resetState();
          throw new Error("Bank connection expired. Please reconnect.");
        }
        throw new Error(
          `Plaid fetch failed: ${response.status} ${
            errorData.details || errorData.error || "Unknown Plaid error"
          }`
        );
      }
      const rawPlaidTransactions = await response.json();
      firebaseDebug.log("PLAID_FETCH", {
        status: "data_received",
        count: rawPlaidTransactions?.length,
      });
      const mappedTransactions = mapPlaidTransactions(rawPlaidTransactions);
      if (!Array.isArray(mappedTransactions))
        throw new Error("Invalid mapped transaction data format");
      set((state) => ({
        connectionStatus: {
          ...state.connectionStatus,
          isConnected: true,
          error:
            mappedTransactions.length === 0 ? "No transactions found" : null,
        },
      }));
      await get().analyzeAndCacheTransactions(mappedTransactions);
    } catch (error) {
      /* ... error handling ... */ console.error(
        "Error in fetchTransactions:",
        error
      );
      firebaseDebug.log("PLAID_FETCH", {
        status: "catch_error",
        error: error instanceof Error ? error.message : String(error),
      });
      const errorMessage =
        error instanceof Error
          ? error.message
          : String(error ?? "Failed to load transactions");
      const isTokenError =
        errorMessage.includes("No access token") ||
        errorMessage.includes("expired") ||
        errorMessage.includes("Invalid access token");
      set((state) => ({
        appStatus: "error",
        connectionStatus: {
          isConnected: isTokenError
            ? false
            : state.connectionStatus.isConnected,
          error: errorMessage,
        },
      }));
    }
  },

  manuallyFetchTransactions: async () => {
    /* ... implementation from prev response ... */
    const { appStatus } = get();
    if (appStatus !== "idle" && appStatus !== "error") return;
    try {
      await get().fetchTransactions();
    } catch (error) {
      console.error("Manual fetch error:", error);
      throw error;
    }
  },

  analyzeAndCacheTransactions: async (incomingTransactions) => {
    /* ... implementation from prev response ... */
    const {
      appStatus,
      savedTransactions: currentSavedTx,
      creditState,
      userValueSettings,
    } = get();
    if (
      appStatus !== "fetching_plaid" &&
      appStatus !== "idle" &&
      appStatus !== "error" &&
      appStatus !== "initializing" &&
      appStatus !== "loading_settings"
    ) {
      console.log(
        `analyzeAndCacheTransactions: Skipping (Current Status: ${appStatus}).`
      );
      return;
    }
    if (!incomingTransactions || incomingTransactions.length === 0) {
      console.log(
        "analyzeAndCacheTransactions: No transactions provided. Updating state."
      );
      const analysis = calculationService.calculateImpactAnalysis(
        [],
        creditState.appliedCredit,
        userValueSettings
      );
      set({
        appStatus: "idle",
        transactions: [],
        savedTransactions: [],
        impactAnalysis: analysis,
      });
      return;
    }
    set({
      appStatus: "analyzing",
      connectionStatus: { ...get().connectionStatus, error: null },
    });
    firebaseDebug.log("ANALYSIS", {
      status: "starting",
      incomingCount: incomingTransactions.length,
    });
    const baseTransactions = currentSavedTx || [];
    const mergedInitialTransactions = mergeTransactions(
      baseTransactions,
      incomingTransactions
    );
    const transactionsToProcess = mergedInitialTransactions.map((tx) => ({
      ...tx,
      analyzed: tx.analyzed ?? false,
    }));
    const transactionsForApi: Transaction[] = [];
    const transactionsFromCache: Transaction[] = [];
    const processedTxMap = new Map<string | null, Transaction>(
      transactionsToProcess
        .filter((tx) => tx.analyzed)
        .map((tx) => [getTransactionIdentifier(tx), tx])
    );
    firebaseDebug.log("ANALYSIS_CACHE", {
      status: "starting_lookup",
      count: transactionsToProcess.filter((tx) => !tx.analyzed).length,
    });
    const cacheLookupPromises = transactionsToProcess
      .filter((tx) => !tx.analyzed)
      .map(async (tx) => {
        const normalizedName = normalizeVendorName(tx.name);
        if (normalizedName !== "unknown_vendor") {
          try {
            const cachedData = await getVendorAnalysis(normalizedName);
            return { tx, cachedData };
          } catch (e) {
            console.error(`Cache lookup error for ${tx.name}:`, e);
            return { tx, cachedData: null };
          }
        }
        return { tx, cachedData: null };
      });
    const cacheResults = await Promise.all(cacheLookupPromises);
    firebaseDebug.log("ANALYSIS_CACHE", {
      status: "lookup_complete",
      resultsCount: cacheResults.length,
    });
    cacheResults.forEach(({ tx, cachedData }) => {
      const txId = getTransactionIdentifier(tx);
      if (cachedData) {
        const updatedTx: Transaction = {
          ...tx,
          analyzed: true,
          unethicalPractices: cachedData.unethicalPractices || [],
          ethicalPractices: cachedData.ethicalPractices || [],
          practiceWeights: cachedData.practiceWeights || {},
          practiceSearchTerms: cachedData.practiceSearchTerms || {},
          practiceCategories: cachedData.practiceCategories || {},
          information: cachedData.information || {},
          citations: cachedData.citations || {},
        };
        transactionsFromCache.push(updatedTx);
        processedTxMap.set(txId, updatedTx);
      } else {
        if (!processedTxMap.has(txId) || !processedTxMap.get(txId)?.analyzed) {
          transactionsForApi.push(tx);
          if (!processedTxMap.has(txId)) {
            processedTxMap.set(txId, tx);
          }
        }
      }
    });
    firebaseDebug.log("ANALYSIS", {
      cacheHits: transactionsFromCache.length,
      alreadyAnalyzed: transactionsToProcess.filter((tx) => tx.analyzed).length,
      needingApi: transactionsForApi.length,
    });
    let analysisError: Error | null = null;
    try {
      if (transactionsForApi.length > 0) {
        firebaseDebug.log("ANALYSIS_API", {
          status: "calling",
          count: transactionsForApi.length,
        });
        const authHeaders = await getAuthHeader();
        if (!authHeaders)
          throw new Error("User not authenticated for analysis.");
        const response = await fetch("/api/analysis", {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({ transactions: transactionsForApi }),
        });
        firebaseDebug.log("ANALYSIS_API", {
          status: "response_received",
          ok: response.ok,
          statusCode: response.status,
        });
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(
            errData.error || `Analysis API Error: ${response.status}`
          );
        }
        const analysisResponse = (await response.json()) as ApiAnalysisResponse;
        if (!analysisResponse || !Array.isArray(analysisResponse.transactions))
          throw new Error("Invalid API response format");
        firebaseDebug.log("ANALYSIS_API", {
          status: "data_received",
          count: analysisResponse.transactions.length,
        });
        const openAiResultsMap = new Map<string, ApiAnalysisResultItem>();
        analysisResponse.transactions.forEach((aTx) => {
          if (aTx.plaidTransactionId)
            openAiResultsMap.set(`plaid-${aTx.plaidTransactionId}`, aTx);
        });
        set({ appStatus: "saving_cache" });
        // LINT FIX: Declare apiAnalyzedResults here if needed, or build finalTransactions directly
        // Let's build finalTransactions directly to avoid the let/const issue potentially
        // const apiAnalyzedResults: Transaction[] = []; // Not needed if directly updating map

        transactionsForApi.forEach((originalTx) => {
          const txId = getTransactionIdentifier(originalTx);
          const apiResult = txId ? openAiResultsMap.get(txId) : null;
          if (txId && apiResult) {
            const finalTx: Transaction = {
              ...originalTx,
              analyzed: true,
              societalDebt: apiResult.societalDebt,
              unethicalPractices: apiResult.unethicalPractices || [],
              ethicalPractices: apiResult.ethicalPractices || [],
              practiceWeights: apiResult.practiceWeights || {},
              practiceDebts: apiResult.practiceDebts || {},
              practiceSearchTerms: apiResult.practiceSearchTerms || {},
              practiceCategories: apiResult.practiceCategories || {},
              charities: apiResult.charities || {},
              information: apiResult.information || {},
              citations: apiResult.citations || {},
            };
            /* apiAnalyzedResults.push(finalTx); */ processedTxMap.set(
              txId,
              finalTx
            );
            const normName = normalizeVendorName(finalTx.name);
            if (normName !== "unknown_vendor") {
              const vendorData: Omit<VendorAnalysis, "analyzedAt"> = {
                originalName: finalTx.name,
                analysisSource: config.analysisProvider as "openai" | "gemini",
                unethicalPractices: finalTx.unethicalPractices ?? [],
                ethicalPractices: finalTx.ethicalPractices ?? [],
                practiceWeights: finalTx.practiceWeights ?? {},
                practiceSearchTerms: finalTx.practiceSearchTerms ?? {},
                practiceCategories: finalTx.practiceCategories ?? {},
                information: finalTx.information ?? {},
                citations: finalTx.citations ?? {},
              };
              saveVendorAnalysis(normName, vendorData)
                .then(() =>
                  firebaseDebug.log("ANALYSIS_CACHE_SAVE", {
                    status: "success",
                    vendor: normName,
                  })
                )
                .catch((err) =>
                  firebaseDebug.log("ANALYSIS_CACHE_SAVE", {
                    status: "error",
                    vendor: normName,
                    error: err.message,
                  })
                );
            }
          } else {
            if (txId)
              processedTxMap.set(txId, { ...originalTx, analyzed: false });
          }
        });
      }
      const finalTransactions = Array.from(processedTxMap.values()).sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      const latestUserValueSettings = get().userValueSettings;
      const finalImpact = calculationService.calculateImpactAnalysis(
        finalTransactions,
        creditState.appliedCredit,
        latestUserValueSettings
      );
      set({
        transactions: finalTransactions,
        savedTransactions: finalTransactions,
        impactAnalysis: finalImpact,
        creditState: {
          ...creditState,
          availableCredit: finalImpact.availableCredit,
        },
        appStatus: "idle",
        connectionStatus: { ...get().connectionStatus, error: null },
        hasSavedData: true,
      });
      firebaseDebug.log("ANALYSIS", {
        status: "complete",
        finalCount: finalTransactions.length,
      });
      if (finalTransactions.length > 0) {
        get()
          .saveTransactionBatch(finalTransactions)
          .catch((err) =>
            console.error("Background saveTransactionBatch failed:", err)
          );
      }
    } catch (error) {
      analysisError = error instanceof Error ? error : new Error(String(error));
      console.error("Error during analysis orchestration:", analysisError);
      firebaseDebug.log("ANALYSIS", {
        status: "error",
        error: analysisError.message,
      });
      set({
        appStatus: "error",
        connectionStatus: {
          ...get().connectionStatus,
          error: analysisError.message || "Analysis failed",
        },
      });
    } finally {
      const finalStatus = get().appStatus;
      if (finalStatus === "saving_cache" || finalStatus === "analyzing") {
        set({ appStatus: analysisError ? "error" : "idle" });
      }
    }
  },

  // LINT FIX: Removed unused parameter from signature
  saveTransactionBatch: async (transactionsToSave) => {
    /* ... implementation from prev response ... */
    const { appStatus } = get();
    if (appStatus === "saving_batch") return;
    if (!transactionsToSave || transactionsToSave.length === 0) return;
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.error("Save Batch Error: User not logged in.");
      return;
    }
    set({ appStatus: "saving_batch" });
    firebaseDebug.log("SAVE_BATCH_API", {
      status: "starting",
      count: transactionsToSave.length,
    });
    try {
      const authHeaders = await getAuthHeader();
      if (!authHeaders)
        throw new Error("User not authenticated for saving batch.");
      const finalizedTransactions = transactionsToSave.map((tx) => ({
        ...tx,
        analyzed: tx.analyzed ?? true,
      }));
      const currentUserValueSettings = get().userValueSettings;
      const analysisForSave = calculationService.calculateImpactAnalysis(
        finalizedTransactions,
        get().creditState.appliedCredit,
        currentUserValueSettings
      );
      const batchPayload = {
        analyzedData: {
          transactions: finalizedTransactions,
          totalSocietalDebt: analysisForSave.negativeImpact,
          debtPercentage: analysisForSave.debtPercentage,
          totalPositiveImpact: analysisForSave.positiveImpact,
          totalNegativeImpact: analysisForSave.negativeImpact,
        },
      };
      const sanitizedPayload = sanitizeDataForFirestore(batchPayload);
      if (!sanitizedPayload)
        throw new Error("Failed to sanitize payload for Firestore.");
      firebaseDebug.log("SAVE_BATCH_API", {
        status: "calling",
        userId: currentUser.uid,
      });
      const response = await fetch("/api/transactions/save", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(sanitizedPayload),
      });
      firebaseDebug.log("SAVE_BATCH_API", {
        status: "response_received",
        ok: response.ok,
        statusCode: response.status,
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Save Batch API Error: ${response.status}`
        );
      }
      const result = await response.json();
      set({ hasSavedData: true });
      firebaseDebug.log("SAVE_BATCH_API", { status: "success", result });
    } catch (error) {
      console.error("Error saving batch via API:", error);
      firebaseDebug.log("SAVE_BATCH_API", {
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      });
      set((state) => ({
        appStatus: "error",
        connectionStatus: {
          ...state.connectionStatus,
          error: state.connectionStatus.error ?? "Failed to save batch history",
        },
      }));
    } finally {
      if (get().appStatus === "saving_batch") {
        set({ appStatus: "idle" });
      }
    }
  },
  applyCredit: async (amount) => {
    /* ... implementation from prev response ... */
    const {
      impactAnalysis,
      creditState,
      appStatus,
      transactions,
      userValueSettings,
    } = get();
    if (appStatus === "applying_credit") return false;
    if (appStatus !== "idle" && appStatus !== "error") {
      console.warn("Cannot apply credit while busy.");
      return false;
    }
    if (!impactAnalysis || amount <= 0) {
      console.warn("Cannot apply credit: Invalid amount or no analysis.");
      return false;
    }
    const currentUserId = auth.currentUser?.uid;
    if (!currentUserId) {
      console.warn("Cannot apply credit: No user.");
      return false;
    }
    set({ appStatus: "applying_credit" });
    firebaseDebug.log("APPLY_CREDIT", { status: "starting", amount });
    try {
      const currentPositiveImpact =
        calculationService.calculatePositiveImpact(transactions);
      const currentAvailable = Math.max(
        0,
        currentPositiveImpact - creditState.appliedCredit
      );
      const valueAdjustedNegativeImpact =
        calculationService.calculateNegativeImpact(
          transactions,
          userValueSettings
        );
      const currentEffectiveDebt = Math.max(
        0,
        valueAdjustedNegativeImpact - creditState.appliedCredit
      );
      const creditToActuallyApply = Math.min(
        amount,
        currentAvailable,
        currentEffectiveDebt
      );
      firebaseDebug.log("APPLY_CREDIT", {
        requested: amount,
        available: currentAvailable,
        effectiveDebt: currentEffectiveDebt,
        applying: creditToActuallyApply,
      });
      if (creditToActuallyApply <= 0) {
        console.log("No credit to apply or no debt to offset.");
        set({ appStatus: "idle" });
        return false;
      }
      const updatedAppliedCredit =
        creditState.appliedCredit + creditToActuallyApply;
      const updatedCreditStateValues = {
        appliedCredit: updatedAppliedCredit,
        lastAppliedAmount: creditToActuallyApply,
        lastAppliedAt: Timestamp.now(),
      };
      const creditDocRef = doc(db, "creditState", currentUserId);
      const sanitizedUpdate = sanitizeDataForFirestore(
        updatedCreditStateValues
      );
      if (!sanitizedUpdate)
        throw new Error("Failed to sanitize credit state update");
      await setDoc(creditDocRef, sanitizedUpdate, { merge: true });
      firebaseDebug.log("APPLY_CREDIT", { status: "firestore_updated" });
      const newAnalysis = calculationService.calculateImpactAnalysis(
        transactions,
        updatedAppliedCredit,
        userValueSettings
      );
      firebaseDebug.log("APPLY_CREDIT", {
        status: "recalculated_impact",
        newAnalysis,
      });
      set({
        creditState: {
          ...creditState,
          appliedCredit: updatedAppliedCredit,
          lastAppliedAmount: creditToActuallyApply,
          lastAppliedAt: updatedCreditStateValues.lastAppliedAt,
          availableCredit: newAnalysis.availableCredit,
        },
        impactAnalysis: newAnalysis,
      });
      firebaseDebug.log("APPLY_CREDIT", { status: "success" });
      return true;
    } catch (error) {
      console.error("Error applying credit:", error);
      firebaseDebug.log("APPLY_CREDIT", {
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      });
      set({ appStatus: "error" });
      return false;
    } finally {
      if (get().appStatus === "applying_credit") {
        set({ appStatus: "idle" });
      }
    }
  },
  loadLatestTransactions: async (): Promise<boolean> => {
    /* ... implementation from prev response ... */
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.log("loadLatestTransactions: No user.");
      return false;
    }
    const userId = currentUser.uid;
    let wasManuallyDisconnected = false;
    try {
      wasManuallyDisconnected =
        sessionStorage.getItem("wasManuallyDisconnected") === "true";
    } catch {}
    if (wasManuallyDisconnected) {
      set({
        appStatus: "idle",
        connectionStatus: {
          isConnected: false,
          error: "Manually disconnected.",
        },
      });
      return false;
    }
    const { appStatus } = get();
    if (
      appStatus !== "idle" &&
      appStatus !== "error" &&
      appStatus !== "initializing"
    ) {
      console.log(`loadLatestTransactions: Skipping (Status: ${appStatus})`);
      return get().hasSavedData;
    }
    set({
      appStatus: "loading_latest",
      hasSavedData: false,
      savedTransactions: null,
      connectionStatus: { ...get().connectionStatus, error: null },
    });
    firebaseDebug.log("LOAD_LATEST", { status: "starting", userId });
    let success = false;
    try {
      const authHeaders = await getAuthHeader();
      if (!authHeaders) throw new Error("User not authenticated.");
      const response = await fetch("/api/transactions/latest", {
        method: "GET",
        headers: authHeaders,
      });
      firebaseDebug.log("LOAD_LATEST", {
        status: "response_received",
        ok: response.ok,
        statusCode: response.status,
      });
      if (response.status === 404) {
        console.log("loadLatestTransactions: No data found (404).");
        firebaseDebug.log("LOAD_LATEST", { status: "no_data_found" });
        const initialCreditState = await get().loadCreditState();
        set({
          hasSavedData: false,
          savedTransactions: null,
          transactions: [],
          impactAnalysis: null,
          creditState: initialCreditState ?? get().creditState,
          appStatus: "idle",
        });
        success = false;
        return success;
      }
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Load Latest API Error: ${response.status}`
        );
      }
      const data = await response.json();
      const batch = data.batch;
      if (batch && batch.transactions) {
        const loadedTransactions = (batch.transactions as Transaction[]).map(
          (tx) => ({ ...tx, analyzed: tx.analyzed ?? true })
        );
        if (!Array.isArray(loadedTransactions))
          throw new Error("Invalid data format in loaded batch");
        firebaseDebug.log("LOAD_LATEST", {
          status: "data_received",
          count: loadedTransactions.length,
        });
        const loadedCreditState = await get().loadCreditState();
        const currentCreditState = loadedCreditState ?? get().creditState;
        const currentAppliedCredit = currentCreditState.appliedCredit;
        const currentUserValueSettings = get().userValueSettings;
        firebaseDebug.log("LOAD_LATEST", {
          status: "calculating_impact",
          appliedCredit: currentAppliedCredit,
        });
        const analysis = calculationService.calculateImpactAnalysis(
          loadedTransactions,
          currentAppliedCredit,
          currentUserValueSettings
        );
        firebaseDebug.log("LOAD_LATEST", {
          status: "impact_calculated",
          analysis,
        });
        set({
          transactions: loadedTransactions,
          savedTransactions: loadedTransactions,
          impactAnalysis: analysis,
          hasSavedData: true,
          creditState: {
            ...currentCreditState,
            availableCredit: analysis.availableCredit,
          },
          connectionStatus: { isConnected: true, error: null },
          appStatus: "idle",
        });
        success = true;
      } else {
        firebaseDebug.log("LOAD_LATEST", { status: "no_batch_data" });
        const initialCreditState = await get().loadCreditState();
        set({
          hasSavedData: false,
          savedTransactions: null,
          transactions: [],
          impactAnalysis: null,
          creditState: initialCreditState ?? get().creditState,
          appStatus: "idle",
        });
        success = false;
      }
    } catch (error) {
      console.error("❌ loadLatestTransactions Error:", error);
      firebaseDebug.log("LOAD_LATEST", {
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      });
      const fallbackCreditState = await get()
        .loadCreditState()
        .catch(() => get().creditState);
      set((state) => ({
        appStatus: "error",
        connectionStatus: {
          ...state.connectionStatus,
          error:
            error instanceof Error
              ? error.message
              : "Failed to load saved data",
        },
        hasSavedData: false,
        savedTransactions: null,
        creditState: fallbackCreditState ?? state.creditState,
      }));
      success = false;
    } finally {
      if (get().appStatus === "loading_latest") {
        set({ appStatus: success ? "idle" : "error" });
      }
    }
    return success;
  },
  loadCreditState: async (): Promise<CreditState | null> => {
    /* ... implementation from prev response ... */
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.warn("loadCreditState: No user.");
      return get().creditState;
    }
    const userId = currentUser.uid;
    const { appStatus } = get();
    if (
      appStatus !== "idle" &&
      appStatus !== "error" &&
      appStatus !== "loading_latest" &&
      appStatus !== "initializing"
    ) {
      console.log(`loadCreditState: Skipping due to app status: ${appStatus}`);
      return get().creditState;
    }
    const wasIdle = appStatus === "idle" || appStatus === "error";
    if (wasIdle) set({ appStatus: "loading_credit_state" });
    firebaseDebug.log("LOAD_CREDIT", { status: "starting", userId });
    let finalCreditState: CreditState | null = null;
    try {
      const creditDocRef = doc(db, "creditState", userId);
      const docSnap = await getDoc(creditDocRef);
      let loadedAppliedCredit = 0,
        loadedLastAmount = 0,
        loadedLastAt: Timestamp | null = null;
      if (docSnap.exists()) {
        const data = docSnap.data();
        loadedAppliedCredit =
          typeof data.appliedCredit === "number" ? data.appliedCredit : 0;
        loadedLastAmount =
          typeof data.lastAppliedAmount === "number"
            ? data.lastAppliedAmount
            : 0;
        loadedLastAt =
          data.lastAppliedAt instanceof Timestamp ? data.lastAppliedAt : null;
        firebaseDebug.log("LOAD_CREDIT", {
          status: "loaded_from_db",
          applied: loadedAppliedCredit,
        });
      } else {
        loadedLastAt = Timestamp.now();
        const initialState = {
          userId,
          appliedCredit: 0,
          lastAppliedAmount: 0,
          lastAppliedAt: loadedLastAt,
        };
        const sanitizedInit = sanitizeDataForFirestore(initialState);
        if (!sanitizedInit)
          throw new Error("Failed to sanitize initial credit state");
        await setDoc(creditDocRef, sanitizedInit);
        firebaseDebug.log("LOAD_CREDIT", { status: "initialized_in_db" });
      }
      const currentTransactions = get().transactions;
      const currentUserValueSettings = get().userValueSettings;
      const analysis = calculationService.calculateImpactAnalysis(
        currentTransactions,
        loadedAppliedCredit,
        currentUserValueSettings
      );
      firebaseDebug.log("LOAD_CREDIT", {
        status: "recalculated_impact",
        applied: loadedAppliedCredit,
        available: analysis.availableCredit,
      });
      finalCreditState = {
        appliedCredit: loadedAppliedCredit,
        lastAppliedAmount: loadedLastAmount,
        lastAppliedAt: loadedLastAt,
        availableCredit: analysis.availableCredit,
      };
      set({ creditState: finalCreditState, impactAnalysis: analysis });
    } catch (error) {
      console.error("Error loading credit state:", error);
      firebaseDebug.log("LOAD_CREDIT", {
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      });
      if (wasIdle)
        set((state) => ({
          appStatus: "error",
          connectionStatus: {
            ...state.connectionStatus,
            error:
              state.connectionStatus.error ?? "Failed to load credit state",
          },
        }));
      finalCreditState = null;
    } finally {
      if (get().appStatus === "loading_credit_state") {
        set({ appStatus: "idle" });
      }
    }
    return finalCreditState;
  },
  initializeStore: async (user: User | null) => {
    /* ... implementation from prev response (using get()) ... */
    const { appStatus, resetState } = get();
    if (!user) {
      resetState();
      return;
    }
    if (appStatus !== "idle" && appStatus !== "error") {
      console.log(`initializeStore: Skipping (Status: ${appStatus})`);
      return;
    }
    let wasManuallyDisconnected = false;
    try {
      wasManuallyDisconnected =
        sessionStorage.getItem("wasManuallyDisconnected") === "true";
    } catch {}
    if (wasManuallyDisconnected) {
      set({
        appStatus: "idle",
        connectionStatus: {
          isConnected: false,
          error: "Manually disconnected.",
        },
      });
      try {
        localStorage.removeItem("plaid_access_token_info");
      } catch (e) {
        console.error(e);
      }
      return;
    }
    set({
      appStatus: "initializing",
      connectionStatus: { ...get().connectionStatus, error: null },
    });
    console.log(`initializeStore: Starting for ${user.uid}`);
    firebaseDebug.log("INITIALIZE", { status: "starting", userId: user.uid });
    try {
      await get().initializeUserValueSettings(user.uid);
      firebaseDebug.log("INITIALIZE", { status: "settings_initialized" });
      const loadedFromFirebase = await get().loadLatestTransactions();
      firebaseDebug.log("INITIALIZE", {
        status: "load_latest_complete",
        success: loadedFromFirebase,
      });
      if (!loadedFromFirebase) {
        let hasValidStoredToken = false,
          tokenToFetch: string | null = null;
        try {
          const storedData = localStorage.getItem("plaid_access_token_info");
          if (storedData) {
            const tokenInfo = JSON.parse(storedData) as StoredTokenInfo;
            if (tokenInfo.userId === user.uid) {
              hasValidStoredToken = true;
              tokenToFetch = tokenInfo.token;
            } else {
              localStorage.removeItem("plaid_access_token_info");
            }
          }
        } catch (e) {
          localStorage.removeItem("plaid_access_token_info");
          console.error(e);
        }
        firebaseDebug.log("INITIALIZE", {
          status: "token_check_complete",
          hasToken: hasValidStoredToken,
        });
        if (hasValidStoredToken && tokenToFetch) {
          console.log(
            "initializeStore: No Firebase data, token exists. Fetching fresh transactions..."
          );
          firebaseDebug.log("INITIALIZE", {
            status: "no_firebase_data_fetching_fresh",
          });
          await get().fetchTransactions(tokenToFetch);
          firebaseDebug.log("INITIALIZE", {
            status: "finished_after_fresh_fetch",
          });
        } else {
          console.log("initializeStore: No Firebase data and no valid token.");
          firebaseDebug.log("INITIALIZE", {
            status: "finished_no_data_no_token",
          });
          set((state) => ({
            connectionStatus: {
              ...state.connectionStatus,
              isConnected: false,
              error: null,
            },
            appStatus: "idle",
          }));
        }
      } else {
        set((state) => ({
          connectionStatus: {
            ...state.connectionStatus,
            isConnected: true,
            error: null,
          },
        }));
        firebaseDebug.log("INITIALIZE", {
          status: "finished_with_firebase_data",
        });
      }
    } catch (error) {
      console.error("❌ initializeStore Error:", error);
      firebaseDebug.log("INITIALIZE", {
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      });
      set({
        appStatus: "error",
        connectionStatus: {
          isConnected: false,
          error:
            error instanceof Error ? error.message : "Initialization failed",
        },
      });
    } finally {
      if (get().appStatus === "initializing") {
        set({ appStatus: "idle" });
      }
      firebaseDebug.log("INITIALIZE", {
        status: "finally_complete",
        finalAppStatus: get().appStatus,
      });
    }
  },

  // --- Value Setting Actions ---
  initializeUserValueSettings: async (userId) => {
    set({ appStatus: "loading_settings" });
    try {
      const userSettingsRef = doc(db, "userValueSettings", userId);
      const docSnap = await getDoc(userSettingsRef);

      let settingsToSet = VALUE_CATEGORIES.reduce((acc, category) => {
        acc[category.id] = category.defaultLevel;
        return acc;
      }, {} as UserValueSettings);
      let committedUntilDate: Timestamp | null = null;

      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data && data.userValueSettings) {
          const fetchedSettings = data.userValueSettings;
          settingsToSet = VALUE_CATEGORIES.reduce((acc, category) => {
            acc[category.id] =
              fetchedSettings[category.id] !== undefined
                ? fetchedSettings[category.id]
                : category.defaultLevel;
            return acc;
          }, {} as UserValueSettings);
        }
        if (data && data.valuesCommittedUntil) {
          committedUntilDate = data.valuesCommittedUntil as Timestamp;
        }
        firebaseDebug.log(
          "INIT_USER_SETTINGS", {
            status: "Loaded user value settings",
            userId,
            settings: settingsToSet,
            committedUntil: committedUntilDate
          }
        );
      } else {
        firebaseDebug.log(
          "INIT_USER_SETTINGS", {
            status: "No value settings found, initializing with defaults.",
            userId
          }
        );
        await setDoc(userSettingsRef, { userValueSettings: settingsToSet, valuesCommittedUntil: null }, { merge: true });
      }
      set({
        userValueSettings: settingsToSet,
        valuesCommittedUntil: committedUntilDate,
        appStatus: "idle",
      });
    } catch (error) {
      console.error("Error initializing user value settings:", error);
      firebaseDebug.log(
        "INIT_USER_SETTINGS_ERROR", {
          userId,
          error: error instanceof Error ? error.message : String(error)
        }
      );
      set({ appStatus: "error" });
    }
  },
  updateUserValue: async (userId, categoryId, newLevel) => {
    if (!userId) {
      console.warn("updateUserValue: No userId provided.");
      return;
    }
    const currentSettings = get().userValueSettings;
    const updatedSettings = {
      ...currentSettings,
      [categoryId]: newLevel,
    };

    set({ userValueSettings: updatedSettings, appStatus: "saving_settings" });

    const { transactions, creditState } = get();
    const analysis = calculationService.calculateImpactAnalysis(
      transactions,
      creditState.appliedCredit,
      updatedSettings
    );
    set({
      impactAnalysis: analysis,
      creditState: {
        ...creditState,
        availableCredit: analysis.availableCredit,
      },
    });

    try {
      const userSettingsRef = doc(db, "userValueSettings", userId);
      await setDoc(userSettingsRef, { userValueSettings: updatedSettings }, { merge: true });
      set({ appStatus: "idle" });
      firebaseDebug.log("UPDATE_USER_VALUE",{
          status: "User value updated and saved.",
          userId,
          categoryId,
          newLevel
        }
      );
    } catch (error) {
      console.error("Error saving user value settings:", error);
      firebaseDebug.log("UPDATE_USER_VALUE_ERROR", {
          userId,
          categoryId,
          newLevel,
          error: error instanceof Error ? error.message : String(error)
        }
      );
      set({ appStatus: "error" });
    }
  },
  getUserValueMultiplier: (practiceCategoryName) => {
    if (!practiceCategoryName) return 1.0;
    const userValueSettings = get().userValueSettings;
    const categoryDefinition = VALUE_CATEGORIES.find(
      (catDef) => catDef.name === practiceCategoryName
    );
    if (!categoryDefinition) return 1.0;
    const userLevel = userValueSettings[categoryDefinition.id] || NEUTRAL_LEVEL;
    return NEGATIVE_PRACTICE_MULTIPLIERS[userLevel] || 1.0;
  },
  resetUserValuesToDefault: async (userId: string) => {
    const defaultSettings = VALUE_CATEGORIES.reduce((acc, category) => {
      acc[category.id] = category.defaultLevel;
      return acc;
    }, {} as UserValueSettings);

    set({ userValueSettings: defaultSettings, appStatus: "saving_settings" });

    try {
      const userSettingsRef = doc(db, "userValueSettings", userId);
      await setDoc(userSettingsRef, { userValueSettings: defaultSettings, valuesCommittedUntil: null }, { merge: true });
      set({ appStatus: "idle", valuesCommittedUntil: null });
      firebaseDebug.log("RESET_USER_VALUES", {
          status: "User value settings reset to default.",
          userId
        }
      );
    } catch (error) {
      console.error("Error resetting user value settings:", error);
      firebaseDebug.log("RESET_USER_VALUES_ERROR", {
          userId,
          error: error instanceof Error ? error.message : String(error)
        }
      );
      set({ appStatus: "error" });
    }
  },
  commitUserValues: async (userId: string) => {
    set({ appStatus: "saving_settings" });
    try {
      const now = new Date();
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      const endOfMonthTimestamp = Timestamp.fromDate(endOfMonth);

      const userSettingsRef = doc(db, "userValueSettings", userId);
      await setDoc(userSettingsRef, { valuesCommittedUntil: endOfMonthTimestamp }, { merge: true });

      set({ valuesCommittedUntil: endOfMonthTimestamp, appStatus: "idle" });
      firebaseDebug.log("COMMIT_USER_VALUES", {
          status: "User values committed.",
          userId,
          commitUntil: endOfMonth.toISOString()
        }
      );
    } catch (error) {
      console.error("Error committing user values:", error);
      firebaseDebug.log("COMMIT_USER_VALUES_ERROR", {
          userId,
          error: error instanceof Error ? error.message : String(error)
        }
      );
      set({ appStatus: "error" });
    }
  },
})); // End create store
