// src/store/transactionStore.ts
import { create } from "zustand";
import { Transaction, Charity } from "@/shared/types/transactions";
import { VendorAnalysis } from "@/shared/types/vendors";
import { ImpactAnalysis } from "@/core/calculations/type";
import { calculationService } from "@/core/calculations/impactService";
import { User } from "firebase/auth";
import { auth } from "@/core/firebase/firebase"; // Make sure auth is imported for getIdToken
import { Timestamp, doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/core/firebase/firebase";
import {
  mapPlaidTransactions,
  mergeTransactions,
} from "@/core/plaid/transactionMapper";
import {
  getVendorAnalysis,
  saveVendorAnalysis,
  normalizeVendorName,
} from "@/features/vendors/vendorStorageService";

// --- Interface Definitions ---

// Application Status Type
export type AppStatus =
  | "idle"
  | "initializing"
  | "connecting_bank" // Status while exchanging token
  | "fetching_plaid" // Status while fetching transactions from Plaid API
  | "analyzing" // Status while calling the analysis LLM API
  | "saving_batch" // Status while saving batch to Firestore
  | "saving_cache" // Status while saving vendor analysis to cache
  | "applying_credit" // Status while applying credit in Firestore
  | "loading_latest" // Status while loading latest batch from Firestore
  | "loading_credit_state" // Status while loading credit state from Firestore
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
  citations?: Record<string, string[]>;
  name?: string;
}
interface ApiAnalysisResponse {
  transactions: ApiAnalysisResultItem[];
  error?: string;
}

export interface TransactionState {
  transactions: Transaction[];
  savedTransactions: Transaction[] | null;
  impactAnalysis: ImpactAnalysis | null;
  connectionStatus: BankConnectionStatus;
  creditState: CreditState;
  appStatus: AppStatus; // Central status indicator
  hasSavedData: boolean;

  // Actions
  setTransactions: (transactions: Transaction[]) => void;
  connectBank: (publicToken: string, user: User | null) => Promise<void>;
  disconnectBank: () => void;
  fetchTransactions: (accessToken?: string) => Promise<void>;
  manuallyFetchTransactions: () => Promise<void>;
  analyzeAndCacheTransactions: (
    rawTransactions: Transaction[]
  ) => Promise<void>;
  saveTransactionBatch: (
    // Renamed from internal save function concept
    transactions: Transaction[],
    totalNegativeDebt: number
    // userId is now derived from auth state
  ) => Promise<void>;
  applyCredit: (amount: number) => Promise<boolean>; // userId derived from auth state
  loadLatestTransactions: () => Promise<boolean>; // userId derived from auth state
  loadCreditState: () => Promise<CreditState | null>; // userId derived from auth state
  resetState: () => void;
  initializeStore: (user: User | null) => Promise<void>;
}
// --- End Interface Definitions ---

// --- Helper Functions ---
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

// Sanitization function (keep as is)
function sanitizeDataForFirestore<T>(data: T): T | null {
  if (data === undefined) return null;
  if (data === null || typeof data !== "object") return data;
  if (data instanceof Timestamp) return data;
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeDataForFirestore(item)) as T;
  }
  const sanitizedObject: { [key: string]: unknown } = {};
  for (const key in data) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      const value = (data as Record<string, unknown>)[key];
      sanitizedObject[key] = sanitizeDataForFirestore(value);
    }
  }
  return sanitizedObject as T;
}

// Helper to get Auth Token
const getAuthHeader = async (): Promise<HeadersInit | null> => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    console.warn("getAuthHeader: No current user found.");
    return null; // Or throw an error depending on expected usage
  }
  try {
    const token = await currentUser.getIdToken();
    if (!token) {
      console.warn("getAuthHeader: Failed to get ID token.");
      return null;
    }
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json", // Keep content type here
    };
  } catch (error) {
    console.error("getAuthHeader: Error getting ID token:", error);
    // Handle error appropriately - maybe trigger logout or show error
    // For now, return null or throw
    return null; // Indicate failure
  }
};

// --- Store Implementation ---
export const useTransactionStore = create<TransactionState>((set, get) => ({
  // --- Initial State (Unchanged from previous refactor) ---
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

  // --- Actions (Updated for Auth Headers) ---

  setTransactions: (transactions) => {
    const currentAppliedCredit = get().creditState.appliedCredit;
    const analysis = calculationService.calculateImpactAnalysis(
      transactions,
      currentAppliedCredit
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

  // connectBank needs Auth Header for the exchange_token call
  connectBank: async (publicToken, user) => {
    const { appStatus } = get();
    if (!user || (appStatus !== "idle" && appStatus !== "error")) {
      console.log(`connectBank: Skipping (Current Status: ${appStatus}).`);
      return;
    }
    set({
      appStatus: "connecting_bank",
      connectionStatus: { isConnected: false, error: null },
    });
    try {
      // *** ADD AUTH HEADER ***
      const authHeaders = await getAuthHeader();
      if (!authHeaders) {
        throw new Error("User not authenticated for token exchange.");
      }

      const apiUrl = "/api/banking/exchange_token";
      const requestOptions: RequestInit = {
        method: "POST",
        headers: authHeaders, // Use fetched auth headers
        body: JSON.stringify({ public_token: publicToken }),
      };
      // const request = new Request(apiUrl, requestOptions); // No need to create Request object explicitly
      const response = await fetch(apiUrl, requestOptions);
      const data = await response.json();
      if (!response.ok || !data.access_token) {
        throw new Error(
          data.error || `Token exchange failed (${response.status})`
        );
      }
      const tokenInfo: StoredTokenInfo = {
        token: data.access_token,
        userId: user.uid, // Store the user ID it belongs to
        timestamp: Date.now(),
      };
      localStorage.setItem(
        "plaid_access_token_info",
        JSON.stringify(tokenInfo)
      );
      set((state) => ({
        connectionStatus: { ...state.connectionStatus, isConnected: true },
      }));
      try {
        sessionStorage.removeItem("wasManuallyDisconnected");
      } catch (e) {
        console.error(e);
      }
      await get().fetchTransactions(data.access_token); // fetchTransactions will add its own auth header if needed
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
    // No finally needed as fetchTransactions handles subsequent state
  },

  resetState: () => {
    console.log("resetState: Triggered.");
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
    });
  },
  disconnectBank: () => {
    get().resetState();
  },

  // fetchTransactions needs Auth Header
  fetchTransactions: async (accessToken) => {
    const { appStatus } = get();
    if (
      appStatus !== "idle" &&
      appStatus !== "error" &&
      appStatus !== "initializing"
    ) {
      console.log(
        `fetchTransactions: Skipping (Current Status: ${appStatus}).`
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
      // *** ADD AUTH HEADER ***
      const authHeaders = await getAuthHeader();
      if (!authHeaders) {
        throw new Error("User not authenticated for fetching transactions.");
      }

      // Get Plaid access token (logic remains the same)
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
          console.error(parseError);
          localStorage.removeItem("plaid_access_token_info");
          throw new Error("Failed to read stored access token.");
        }
      }
      if (!tokenToUse) throw new Error("Access token missing after checks.");

      console.log("fetchTransactions: Fetching raw transactions via API...");
      const response = await fetch("/api/banking/transactions", {
        method: "POST",
        headers: authHeaders, // Use fetched auth headers
        body: JSON.stringify({ access_token: tokenToUse }), // Plaid token in body
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (errorData.error?.includes("ITEM_LOGIN_REQUIRED")) {
          // Check error message
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
      console.error("Error in fetchTransactions:", error);
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

  // manuallyFetchTransactions uses fetchTransactions, which now includes auth
  manuallyFetchTransactions: async () => {
    const { appStatus } = get();
    if (appStatus !== "idle" && appStatus !== "error") return;
    try {
      await get().fetchTransactions();
    } catch (error) {
      console.error("Manual fetch error:", error);
      throw error;
    }
  },

  // analyzeAndCacheTransactions needs Auth Header for the /api/analysis call
  analyzeAndCacheTransactions: async (incomingTransactions) => {
    const { appStatus } = get();
    if (
      appStatus !== "fetching_plaid" &&
      appStatus !== "idle" &&
      appStatus !== "error" &&
      appStatus !== "initializing"
    ) {
      console.log(
        `analyzeAndCacheTransactions: Skipping (Current Status: ${appStatus}).`
      );
      return;
    }
    if (!incomingTransactions || incomingTransactions.length === 0) {
      console.log(
        "analyzeAndCacheTransactions: No transactions. Setting idle."
      );
      const currentAppliedCredit = get().creditState.appliedCredit;
      set({
        appStatus: "idle",
        transactions: [],
        impactAnalysis: calculationService.calculateImpactAnalysis(
          [],
          currentAppliedCredit
        ),
      });
      return;
    }

    set({
      appStatus: "analyzing",
      connectionStatus: { ...get().connectionStatus, error: null },
    });
    console.log(`Analyze: Starting for ${incomingTransactions.length} txs.`);
    const currentSavedTx = get().savedTransactions || [];
    const mergedInitialTransactions = mergeTransactions(
      currentSavedTx,
      incomingTransactions
    );
    const transactionsToProcess = mergedInitialTransactions.map((tx) => ({
      ...tx,
      analyzed: tx.analyzed ?? false,
    }));
    const transactionsForApi: Transaction[] = [];
    const transactionsFromCache: Transaction[] = [];
    const alreadyAnalyzed: Transaction[] = [];

    // Cache Lookup (logic remains the same)
    const cacheLookupPromises = transactionsToProcess
      .filter((tx) => !tx.analyzed)
      .map(async (tx) => {
        /* ... as before ... */
        const vendorName = tx.name;
        const normalizedName = normalizeVendorName(vendorName);
        if (normalizedName !== "unknown_vendor") {
          try {
            const d = await getVendorAnalysis(normalizedName);
            return { tx, cachedData: d };
          } catch (e) {
            console.error(e);
            return { tx, cachedData: null };
          }
        }
        return { tx, cachedData: null };
      });
    const cacheResults = await Promise.all(cacheLookupPromises);
    const transactionsById = new Map(
      transactionsToProcess.map((tx) => [getTransactionIdentifier(tx), tx])
    );
    cacheResults.forEach(({ tx, cachedData }) => {
      /* ... as before ... */
      const txId = getTransactionIdentifier(tx);
      if (!txId) return;
      if (cachedData) {
        const uTx: Transaction = {
          ...tx,
          analyzed: true,
          unethicalPractices: cachedData.unethicalPractices || [],
          ethicalPractices: cachedData.ethicalPractices || [],
          practiceWeights: cachedData.practiceWeights || {},
          practiceSearchTerms: cachedData.practiceSearchTerms || {},
          practiceCategories: cachedData.practiceCategories || {},
          information: cachedData.information || {},
          citations:
            typeof cachedData.citations === "object"
              ? Object.entries(cachedData.citations).reduce((a, [k, v]) => {
                  a[k] = Array.isArray(v) ? v : [String(v)];
                  return a;
                }, {} as Record<string, string[]>)
              : {},
        };
        transactionsFromCache.push(uTx);
        transactionsById.set(txId, uTx);
      } else {
        transactionsForApi.push(tx);
      }
    });
    transactionsToProcess.forEach((tx) => {
      /* ... as before ... */
      const txId = getTransactionIdentifier(tx);
      if (tx.analyzed && txId && !transactionsById.get(txId)?.analyzed) {
        alreadyAnalyzed.push(tx);
      } else if (tx.analyzed && txId && transactionsById.get(txId)?.analyzed) {
        if (
          !alreadyAnalyzed.some((aTx) => getTransactionIdentifier(aTx) === txId)
        ) {
          alreadyAnalyzed.push(transactionsById.get(txId)!);
        }
      }
    });
    console.log(
      `Analyze: ${transactionsFromCache.length} cache, ${alreadyAnalyzed.length} done, ${transactionsForApi.length} API.`
    );

    let apiAnalyzedResults: Transaction[] = [];
    let analysisError: Error | null = null;
    try {
      if (transactionsForApi.length > 0) {
        console.log(
          `Analyze: Calling API for ${transactionsForApi.length} txs...`
        );
        // *** ADD AUTH HEADER ***
        const authHeaders = await getAuthHeader();
        if (!authHeaders) {
          throw new Error("User not authenticated for analysis.");
        }

        const response = await fetch("/api/analysis", {
          method: "POST",
          headers: authHeaders, // Use fetched auth headers
          body: JSON.stringify({ transactions: transactionsForApi }),
        });
        // ... rest of API handling as before ...
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `API Error: ${response.status}`);
        }
        const analysisResponse = (await response.json()) as ApiAnalysisResponse;
        if (
          !analysisResponse ||
          !Array.isArray(analysisResponse.transactions)
        ) {
          throw new Error("Invalid API response format");
        }
        const openAiResultsMap = new Map<string, ApiAnalysisResultItem>();
        analysisResponse.transactions.forEach((aTx: ApiAnalysisResultItem) => {
          if (aTx.plaidTransactionId) {
            openAiResultsMap.set(aTx.plaidTransactionId, aTx);
          } else {
            console.warn("API result missing plaidTransactionId:", aTx);
          }
        });
        set({ appStatus: "saving_cache" });
        const cacheSavePromises: Promise<void>[] = [];
        apiAnalyzedResults = transactionsForApi.map((oTx) => {
          /* ... cache saving logic as before ... */
          const oId = oTx.plaidTransactionId;
          if (oId && openAiResultsMap.has(oId)) {
            const aVer = openAiResultsMap.get(oId)!;
            const fTx: Transaction = {
              ...oTx,
              analyzed: true,
              societalDebt: aVer.societalDebt,
              unethicalPractices: aVer.unethicalPractices || [],
              ethicalPractices: aVer.ethicalPractices || [],
              practiceWeights: aVer.practiceWeights || {},
              practiceDebts: aVer.practiceDebts || {},
              practiceSearchTerms: aVer.practiceSearchTerms || {},
              practiceCategories: aVer.practiceCategories || {},
              charities: aVer.charities || {},
              information: aVer.information || {},
              citations:
                typeof aVer.citations === "object"
                  ? Object.entries(aVer.citations).reduce((a, [k, v]) => {
                      a[k] = Array.isArray(v) ? v : [String(v)];
                      return a;
                    }, {} as Record<string, string[]>)
                  : {},
            };
            const vName = oTx.name;
            const nName = normalizeVendorName(vName);
            if (nName !== "unknown_vendor") {
              const vData: Omit<VendorAnalysis, "analyzedAt"> = {
                originalName: vName,
                analysisSource: "openai",
                unethicalPractices: fTx.unethicalPractices,
                ethicalPractices: fTx.ethicalPractices,
                practiceWeights: fTx.practiceWeights,
                practiceSearchTerms: fTx.practiceSearchTerms,
                practiceCategories: fTx.practiceCategories,
                information: fTx.information,
                citations: fTx.citations,
              };
              cacheSavePromises.push(saveVendorAnalysis(nName, vData));
            }
            return fTx;
          }
          return { ...oTx, analyzed: oTx.analyzed ?? false };
        });
        if (cacheSavePromises.length > 0) {
          await Promise.allSettled(cacheSavePromises);
          console.log(`Analyze: Finished saving cache.`);
        }
      }

      const finalTransactions = mergeTransactions(
        [...alreadyAnalyzed, ...transactionsFromCache],
        apiAnalyzedResults
      );
      const currentCreditState = get().creditState;
      const finalImpact = calculationService.calculateImpactAnalysis(
        finalTransactions,
        currentCreditState.appliedCredit
      );
      set({
        transactions: finalTransactions,
        savedTransactions: finalTransactions,
        impactAnalysis: finalImpact,
        creditState: {
          ...currentCreditState,
          availableCredit: finalImpact.availableCredit,
        },
        appStatus: "idle",
        connectionStatus: { ...get().connectionStatus, error: null },
      });
      console.log("Analyze: Complete, state updated.");
      // Trigger background save
      if (finalTransactions.length > 0) {
        get()
          .saveTransactionBatch(finalTransactions, finalImpact.negativeImpact) // userId is handled internally now
          .catch((err) => console.error("Failed to save batch:", err));
      }
    } catch (error) {
      analysisError = error instanceof Error ? error : new Error(String(error));
      console.error("Error during analysis orchestration:", analysisError);
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

  // saveTransactionBatch needs Auth Header
  saveTransactionBatch: async (transactionsToSave, totalNegativeDebt) => {
    const { appStatus } = get();
    if (
      appStatus !== "idle" &&
      appStatus !== "error" &&
      appStatus !== "saving_batch"
    ) {
      return;
    }
    if (!transactionsToSave || transactionsToSave.length === 0) {
      return;
    }
    const currentUser = auth.currentUser; // Get current user
    if (!currentUser) {
      console.error("Save Batch Error: User not logged in.");
      return;
    }

    set({ appStatus: "saving_batch" });
    try {
      // *** ADD AUTH HEADER ***
      const authHeaders = await getAuthHeader();
      if (!authHeaders) {
        throw new Error("User not authenticated for saving batch.");
      }

      const finalizedTransactions = transactionsToSave.map((tx) => ({
        ...tx,
        analyzed: tx.analyzed ?? true,
      }));
      // Prepare data WITHOUT userId, as it's handled server-side now
      const batchPayload = {
        analyzedData: {
          transactions: finalizedTransactions,
          totalSocietalDebt: totalNegativeDebt ?? 0,
          debtPercentage: calculationService.calculateDebtPercentage(
            finalizedTransactions
          ), // Recalculate here
          // Include impact analysis totals if needed by the save logic/service
          totalPositiveImpact: calculationService.calculatePositiveImpact(
            finalizedTransactions
          ),
          totalNegativeImpact: totalNegativeDebt ?? 0, // Use provided neg impact
        },
        // accessToken?: string; // Include if needed
      };

      console.log(
        `saveTransactionBatch: Calling API /api/transactions/save for user ${currentUser.uid}...`
      );
      const response = await fetch("/api/transactions/save", {
        // Use the new route
        method: "POST",
        headers: authHeaders, // Use fetched auth headers
        body: JSON.stringify(batchPayload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Save Batch API Error: ${response.status}`
        );
      }

      const result = await response.json();
      set({ hasSavedData: true });
      console.log(`saveTransactionBatch: Saved batch via API. Result:`, result);
    } catch (error) {
      console.error("Error saving batch via API:", error);
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

  // applyCredit updates Firestore directly, no API call needed IF rules allow client writes
  // However, for consistency and better security/validation, an API endpoint is preferred.
  // Let's assume direct write for now as implemented, but flag for potential refactor.
  applyCredit: async (amount) => {
    // ... (Keep existing applyCredit logic for now, which writes directly)
    // This assumes Firestore rules allow the client to write to their own /creditState/{userId} doc.
    // A more secure approach would be an API endpoint:
    // 1. Client calls POST /api/credit/apply { amount: X } with Auth header
    // 2. Server verifies auth, gets uid
    // 3. Server reads current credit state and transactions for uid
    // 4. Server calculates valid amount to apply
    // 5. Server updates credit state in Firestore
    // 6. Server responds success/fail
    // 7. Client updates local state based on response
    const { impactAnalysis, creditState, appStatus, transactions } = get();
    if (appStatus !== "idle" && appStatus !== "error") return false;
    if (!impactAnalysis || amount <= 0) return false;
    const currentUserId = auth.currentUser?.uid; // Get current user ID
    if (!currentUserId) return false;

    set({ appStatus: "applying_credit" });
    try {
      const availableFromState = Math.max(0, creditState.availableCredit);
      const effectiveDebtFromAnalysis = Math.max(
        0,
        impactAnalysis.effectiveDebt
      );
      const creditToApply = Math.min(
        amount,
        availableFromState,
        effectiveDebtFromAnalysis
      );

      if (creditToApply <= 0) {
        set({ appStatus: "idle" });
        return false;
      }

      const updatedCreditStateValues = {
        appliedCredit: creditState.appliedCredit + creditToApply,
        lastAppliedAmount: creditToApply,
        lastAppliedAt: Timestamp.now(),
      };
      const creditDocRef = doc(db, "creditState", currentUserId);
      const sanitizedUpdate = sanitizeDataForFirestore(
        updatedCreditStateValues
      );
      if (!sanitizedUpdate) throw new Error("Failed to sanitize credit state");
      await setDoc(creditDocRef, sanitizedUpdate, { merge: true });

      const newAnalysis = calculationService.calculateImpactAnalysis(
        transactions,
        updatedCreditStateValues.appliedCredit
      );
      set({
        creditState: {
          ...creditState,
          ...updatedCreditStateValues,
          availableCredit: newAnalysis.availableCredit,
        },
        impactAnalysis: newAnalysis,
      });
      return true;
    } catch (error) {
      console.error("Error applying credit:", error);
      set({ appStatus: "error" });
      return false;
    } finally {
      if (get().appStatus === "applying_credit") {
        set({ appStatus: "idle" });
      }
    }
  },

  // loadLatestTransactions needs Auth Header
  loadLatestTransactions: async (): Promise<boolean> => {
    const currentUser = auth.currentUser; // Get user from auth state
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
    if (appStatus !== "idle" && appStatus !== "error")
      return get().hasSavedData;

    set({
      appStatus: "loading_latest",
      hasSavedData: false,
      savedTransactions: null,
      connectionStatus: { ...get().connectionStatus, error: null },
    });
    let success = false;
    try {
      // *** ADD AUTH HEADER ***
      const authHeaders = await getAuthHeader();
      if (!authHeaders) {
        throw new Error(
          "User not authenticated for loading latest transactions."
        );
      }

      console.log(
        `loadLatestTransactions: Calling API /api/transactions/latest for user ${userId}...`
      );
      // Call the new GET route
      const response = await fetch("/api/transactions/latest", {
        method: "GET",
        headers: authHeaders, // Send auth token
      });

      if (response.status === 404) {
        console.log("loadLatestTransactions: No data found (404).");
        set({
          hasSavedData: false,
          savedTransactions: null,
          transactions: [],
          impactAnalysis: null,
          appStatus: "idle",
        });
        success = false; // Technically not a success in terms of loading data
        return success; // Exit early
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Load Latest API Error: ${response.status}`
        );
      }

      const data = await response.json();
      const batch = data.batch; // Assuming the API returns { batch: TransactionBatch | null }

      if (batch && batch.transactions) {
        const loadedTransactions = (batch.transactions as Transaction[]).map(
          (tx) => ({ ...tx, analyzed: tx.analyzed ?? true })
        ); // Ensure analyzed is boolean
        if (!Array.isArray(loadedTransactions))
          throw new Error("Invalid data format in loaded batch");

        const loadedCreditState = await get().loadCreditState(); // loadCreditState now gets userId internally
        const initialAppliedCredit = loadedCreditState?.appliedCredit ?? 0;
        const analysis = calculationService.calculateImpactAnalysis(
          loadedTransactions,
          initialAppliedCredit
        );
        set({
          transactions: loadedTransactions,
          savedTransactions: loadedTransactions,
          impactAnalysis: analysis,
          hasSavedData: true,
          creditState: {
            appliedCredit: initialAppliedCredit,
            lastAppliedAmount: loadedCreditState?.lastAppliedAmount ?? 0,
            lastAppliedAt: loadedCreditState?.lastAppliedAt ?? null,
            availableCredit: analysis.availableCredit,
          },
          connectionStatus: { isConnected: true, error: null }, // Assume connected
          appStatus: "idle", // Set idle on success
        });
        success = true;
      } else {
        // This case should be covered by the 404 check, but as a fallback
        console.log(
          "loadLatestTransactions: API returned OK but no batch data."
        );
        set({
          hasSavedData: false,
          savedTransactions: null,
          transactions: [],
          impactAnalysis: null,
          appStatus: "idle",
        });
        success = false;
      }
    } catch (error) {
      console.error("❌ loadLatestTransactions Error:", error);
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
      }));
      success = false;
    }
    return success;
  },

  // loadCreditState uses user ID internally now
  loadCreditState: async (): Promise<CreditState | null> => {
    const currentUser = auth.currentUser; // Get current user
    if (!currentUser) {
      console.warn("loadCreditState: No user logged in.");
      return get().creditState;
    }
    const userId = currentUser.uid;

    const { appStatus } = get();
    if (
      appStatus !== "idle" &&
      appStatus !== "error" &&
      appStatus !== "loading_latest"
    ) {
      return get().creditState;
    }

    set({ appStatus: "loading_credit_state" });
    let finalCreditState: CreditState | null = null;
    try {
      const creditDocRef = doc(db, "creditState", userId);
      const docSnap = await getDoc(creditDocRef);
      let loadedAppliedCredit = 0,
        loadedLastAmount = 0,
        loadedLastAt: Timestamp | null = null;
      if (docSnap.exists()) {
        /* ... load logic as before ... */
        const data = docSnap.data();
        loadedAppliedCredit = data.appliedCredit || 0;
        loadedLastAmount = data.lastAppliedAmount || 0;
        loadedLastAt =
          data.lastAppliedAt instanceof Timestamp ? data.lastAppliedAt : null;
      } else {
        /* ... init logic as before ... */
        loadedLastAt = Timestamp.now();
        const init = sanitizeDataForFirestore({
          appliedCredit: 0,
          lastAppliedAmount: 0,
          lastAppliedAt: loadedLastAt,
        });
        if (!init) throw new Error("Failed sanitize init state");
        await setDoc(creditDocRef, init);
      }

      const currentTransactions = get().transactions;
      const analysis = calculationService.calculateImpactAnalysis(
        currentTransactions,
        loadedAppliedCredit
      );
      finalCreditState = {
        appliedCredit: loadedAppliedCredit,
        lastAppliedAmount: loadedLastAmount,
        lastAppliedAt: loadedLastAt,
        availableCredit: analysis.availableCredit,
      };
      set({ creditState: finalCreditState, impactAnalysis: analysis });
    } catch (error) {
      console.error("Error loading credit state:", error);
      set((state) => ({
        appStatus: "error",
        connectionStatus: {
          ...state.connectionStatus,
          error: state.connectionStatus.error ?? "Failed credit state",
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

  // initializeStore remains largely the same, but calls actions that now use auth
  initializeStore: async (user: User | null) => {
    const { appStatus } = get();
    if (!user) {
      get().resetState();
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
      /* ... handle disconnect ... */ set({
        appStatus: "idle",
        connectionStatus: {
          isConnected: false,
          error: "Manually disconnected.",
        },
      });
      try {
        localStorage.removeItem("plaid_access_token_info");
      } catch (e) {console.error(e)}
      return;
    }

    set({
      appStatus: "initializing",
      connectionStatus: { ...get().connectionStatus, error: null },
    });
    console.log(`initializeStore: Starting for ${user.uid}`);
    let loadedFromFirebase = false;
    try {
      // loadLatestTransactions now handles auth internally
      loadedFromFirebase = await get().loadLatestTransactions(); // No userId needed
      console.log(
        `initializeStore: loadLatestTransactions result: ${loadedFromFirebase}`
      );

      let hasValidStoredToken = false,
        tokenToFetch: string | null = null;
      try {
        /* ... token check logic as before ... */
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

      if (loadedFromFirebase) {
        /* ... ensure connected status ... */
        set((state) => ({
          connectionStatus: {
            ...state.connectionStatus,
            isConnected: true,
            error: null,
          },
        }));
      } else if (hasValidStoredToken && tokenToFetch) {
        console.log(
          "initializeStore: No Firebase data, token exists. Fetching fresh..."
        );
        await get().fetchTransactions(tokenToFetch); // fetchTransactions handles auth
      } else {
        /* ... handle no data, no token ... */
        set((state) => ({
          connectionStatus: {
            ...state.connectionStatus,
            isConnected: false,
            error: null,
          },
          appStatus: "idle",
        }));
      }
    } catch (error) {
      console.error("❌ initializeStore Error:", error);
      set({
        appStatus: "error",
        connectionStatus: {
          isConnected: false,
          error: error instanceof Error ? error.message : "Init failed",
        },
      });
    } finally {
      if (get().appStatus === "initializing") {
        set({ appStatus: "idle" });
      }
      console.log(`initializeStore: Finished. Status: ${get().appStatus}`);
    }
  },
})); // End create
