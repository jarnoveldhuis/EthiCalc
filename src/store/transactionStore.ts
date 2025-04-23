// src/store/transactionStore.ts
import { create } from "zustand";
// Import updated Transaction and Citation types
import { Transaction, Charity, Citation } from "@/shared/types/transactions";
import { VendorAnalysis } from "@/shared/types/vendors"; // Uses updated VendorAnalysis type
import { ImpactAnalysis } from "@/core/calculations/type";
import { calculationService } from "@/core/calculations/impactService";
import { User } from "firebase/auth";
import { auth } from "@/core/firebase/firebase";
import { Timestamp, doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/core/firebase/firebase";
import { config } from "@/config";
import {
  mapPlaidTransactions,
  mergeTransactions,
} from "@/core/plaid/transactionMapper";
import {
  getVendorAnalysis,
  saveVendorAnalysis,
  normalizeVendorName,
} from "@/features/vendors/vendorStorageService"; // Uses updated VendorAnalysis type

// --- Interface Definitions ---
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
// Use updated Transaction type internally for consistency
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
  // Expects the new structure from the API/Zod validation
  citations?: Record<string, Citation[]>;
  name?: string;
}
interface ApiAnalysisResponse {
  // API response structure uses the new citations format
  transactions: ApiAnalysisResultItem[];
  error?: string;
}

export interface TransactionState {
  // Uses updated Transaction type
  transactions: Transaction[];
  savedTransactions: Transaction[] | null;
  impactAnalysis: ImpactAnalysis | null;
  connectionStatus: BankConnectionStatus;
  creditState: CreditState;
  appStatus: AppStatus;
  hasSavedData: boolean;

  // Actions
  setTransactions: (transactions: Transaction[]) => void;
  connectBank: (publicToken: string, user: User | null) => Promise<void>;
  disconnectBank: () => void;
  fetchTransactions: (accessToken?: string) => Promise<void>;
  manuallyFetchTransactions: () => Promise<void>;
  analyzeAndCacheTransactions: (
    rawTransactions: Transaction[] // Expects updated Transaction type
  ) => Promise<void>;
  saveTransactionBatch: (
    transactions: Transaction[], // Expects updated Transaction type
    totalNegativeDebt: number
  ) => Promise<void>;
  applyCredit: (amount: number) => Promise<boolean>;
  loadLatestTransactions: () => Promise<boolean>;
  loadCreditState: () => Promise<CreditState | null>;
  resetState: () => void;
  initializeStore: (user: User | null) => Promise<void>;
}
// --- End Interface Definitions ---

// --- Helper Functions (Unchanged) ---
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
const getAuthHeader = async (): Promise<HeadersInit | null> => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    console.warn("getAuthHeader: No current user found.");
    return null;
  }
  try {
    const token = await currentUser.getIdToken();
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
// --- End Helper Functions ---

// --- Store Implementation ---
export const useTransactionStore = create<TransactionState>((set, get) => ({
  // --- Initial State ---
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

  // --- Actions ---

  setTransactions: (transactions) => {
    // Ensure input matches the updated Transaction type if necessary
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

  // connectBank, disconnectBank, fetchTransactions, manuallyFetchTransactions
  // (No direct changes needed here as they rely on types passed to other functions)
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
    let exchangedToken: string | null = null;
    try {
      const authHeaders = await getAuthHeader();
      if (!authHeaders) {
        throw new Error("User not authenticated for token exchange.");
      }
      const apiUrl = "/api/banking/exchange_token";
      const requestOptions: RequestInit = {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ public_token: publicToken }),
      };
      const response = await fetch(apiUrl, requestOptions);
      const data = await response.json();
      if (!response.ok || !data.access_token) {
        throw new Error(
          data.error || `Token exchange failed (${response.status})`
        );
      }
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
      console.log("connectBank: Token exchanged, calling fetchTransactions...");
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
      const authHeaders = await getAuthHeader();
      if (!authHeaders) {
        throw new Error("User not authenticated for fetching transactions.");
      }
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
        headers: authHeaders,
        body: JSON.stringify({ access_token: tokenToUse }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
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
      // Pass mapped transactions (which conform to base Transaction type initially)
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

  // analyzeAndCacheTransactions needs to handle the updated Transaction type
  analyzeAndCacheTransactions: async (incomingTransactions) => {
    // ... (Initial checks and status setting remain the same) ...
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

    // Cache Lookup
    const cacheLookupPromises = transactionsToProcess
      .filter((tx) => !tx.analyzed)
      .map(async (tx) => {
        const vendorName = tx.name;
        const normalizedName = normalizeVendorName(vendorName);
        if (normalizedName !== "unknown_vendor") {
          try {
            // getVendorAnalysis returns VendorAnalysis | null
            // VendorAnalysis now uses Citation[] for citations
            const cachedData = await getVendorAnalysis(normalizedName);
            return { tx, cachedData };
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

    // Process cache results
    cacheResults.forEach(({ tx, cachedData }) => {
      const txId = getTransactionIdentifier(tx);
      if (!txId) return;
      if (cachedData) {
        // cachedData is VendorAnalysis | null
        // Construct transaction using data from cache, ensuring citations match Transaction type
        const uTx: Transaction = {
          ...tx,
          analyzed: true,
          unethicalPractices: cachedData.unethicalPractices || [],
          ethicalPractices: cachedData.ethicalPractices || [],
          practiceWeights: cachedData.practiceWeights || {},
          practiceSearchTerms: cachedData.practiceSearchTerms || {},
          practiceCategories: cachedData.practiceCategories || {},
          information: cachedData.information || {},
          // *** Ensure cached citations (Citation[]) are assigned correctly ***
          citations: cachedData.citations || {}, // Assign directly as type matches
        };
        transactionsFromCache.push(uTx);
        transactionsById.set(txId, uTx);
      } else {
        transactionsForApi.push(tx);
      }
    });

    // Collect already analyzed transactions (logic remains same)
    transactionsToProcess.forEach((tx) => {
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
      // Call analysis API if needed
      if (transactionsForApi.length > 0) {
        console.log(
          `Analyze: Calling API for ${transactionsForApi.length} txs...`
        );
        const authHeaders = await getAuthHeader();
        if (!authHeaders) {
          throw new Error("User not authenticated for analysis.");
        }

        const response = await fetch("/api/analysis", {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({ transactions: transactionsForApi }),
        });
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `API Error: ${response.status}`);
        }
        // analysisResponse type uses ApiAnalysisResponse which expects new citation format
        const analysisResponse = (await response.json()) as ApiAnalysisResponse;
        if (
          !analysisResponse ||
          !Array.isArray(analysisResponse.transactions)
        ) {
          throw new Error("Invalid API response format");
        }

        // Map API results
        const openAiResultsMap = new Map<string, ApiAnalysisResultItem>();
        analysisResponse.transactions.forEach((aTx) => {
          // aTx type uses ApiAnalysisResultItem
          if (aTx.plaidTransactionId) {
            openAiResultsMap.set(aTx.plaidTransactionId, aTx);
          } else {
            console.warn("API result missing plaidTransactionId:", aTx);
          }
        });

        set({ appStatus: "saving_cache" });
        const cacheSavePromises: Promise<void>[] = [];

        // Process API results and prepare for cache saving
        apiAnalyzedResults = transactionsForApi.map((oTx) => {
          const oId = oTx.plaidTransactionId;
          if (oId && openAiResultsMap.has(oId)) {
            const aVer = openAiResultsMap.get(oId)!; // aVer is ApiAnalysisResultItem
            // Construct final transaction, ensuring citations match Transaction type
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
              // *** Assign citations correctly (aVer.citations is Record<string, Citation[]>) ***
              citations: aVer.citations || {}, // Direct assignment as type matches
            };

            // Prepare data for vendor cache (VendorAnalysis type uses Citation[])
            const vName = oTx.name;
            const nName = normalizeVendorName(vName);
            if (nName !== "unknown_vendor") {
              // vData needs to match Omit<VendorAnalysis, 'analyzedAt'>
              const vData: Omit<VendorAnalysis, "analyzedAt"> = {
                originalName: vName,
                analysisSource: config.analysisProvider as "openai" | "gemini",
                unethicalPractices: fTx.unethicalPractices,
                ethicalPractices: fTx.ethicalPractices,
                practiceWeights: fTx.practiceWeights,
                practiceSearchTerms: fTx.practiceSearchTerms,
                practiceCategories: fTx.practiceCategories,
                information: fTx.information,
                // *** Assign citations correctly (fTx.citations is Record<string, Citation[]>) ***
                citations: fTx.citations, // Direct assignment as type matches
              };
              cacheSavePromises.push(saveVendorAnalysis(nName, vData));
            }
            return fTx; // fTx is of type Transaction
          }
          // Return original transaction if no API result, ensure analyzed is boolean
          return { ...oTx, analyzed: oTx.analyzed ?? false };
        });

        if (cacheSavePromises.length > 0) {
          await Promise.allSettled(cacheSavePromises);
          console.log(
            `Analyze: Finished saving ${cacheSavePromises.length} items to cache.`
          );
        }
      } // End if (transactionsForApi.length > 0)

      // Merge all transaction sources (all should conform to Transaction type now)
      const finalTransactions = mergeTransactions(
        [...alreadyAnalyzed, ...transactionsFromCache],
        apiAnalyzedResults
      );

      // Recalculate impact using final list
      const currentCreditState = get().creditState;
      const finalImpact = calculationService.calculateImpactAnalysis(
        finalTransactions,
        currentCreditState.appliedCredit
      );

      // Update state
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
          .saveTransactionBatch(finalTransactions, finalImpact.negativeImpact)
          .catch((err) => console.error("Failed to save batch:", err));
      }
    } catch (error) {
      // ... (Error handling remains the same) ...
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
      // ... (Final status setting remains the same) ...
      const finalStatus = get().appStatus;
      if (finalStatus === "saving_cache" || finalStatus === "analyzing") {
        set({ appStatus: analysisError ? "error" : "idle" });
      }
    }
  },

  // saveTransactionBatch needs to send data conforming to the updated Transaction type
  saveTransactionBatch: async (transactionsToSave, totalNegativeDebt) => {
    // ... (Initial checks, auth header logic remain the same) ...
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
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.error("Save Batch Error: User not logged in.");
      return;
    }
    set({ appStatus: "saving_batch" });

    try {
      const authHeaders = await getAuthHeader();
      if (!authHeaders) {
        throw new Error("User not authenticated for saving batch.");
      }

      // Ensure transactions being saved conform to the updated Transaction type
      const finalizedTransactions = transactionsToSave.map((tx) => ({
        ...tx,
        analyzed: tx.analyzed ?? true,
        // Ensure citations structure is correct here if needed, though it should be already
        citations: tx.citations || {}, // Make sure it's the correct Citation[] structure
      }));

      // Prepare payload - finalizedTransactions now uses updated Transaction type
      const batchPayload = {
        analyzedData: {
          transactions: finalizedTransactions, // This array now uses the correct type
          totalSocietalDebt: totalNegativeDebt ?? 0,
          debtPercentage: calculationService.calculateDebtPercentage(
            finalizedTransactions
          ),
          totalPositiveImpact: calculationService.calculatePositiveImpact(
            finalizedTransactions
          ),
          totalNegativeImpact: totalNegativeDebt ?? 0,
        },
      };

      console.log(
        `saveTransactionBatch: Calling API /api/transactions/save for user ${currentUser.uid}...`
      );
      const response = await fetch("/api/transactions/save", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(batchPayload),
      });
      // ... (Rest of response handling remains the same) ...
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
      // ... (Error handling remains the same) ...
      console.error("Error saving batch via API:", error);
      set((state) => ({
        appStatus: "error",
        connectionStatus: {
          ...state.connectionStatus,
          error: state.connectionStatus.error ?? "Failed to save batch history",
        },
      }));
    } finally {
      // ... (Final status setting remains the same) ...
      if (get().appStatus === "saving_batch") {
        set({ appStatus: "idle" });
      }
    }
  },

  // applyCredit, loadLatestTransactions, loadCreditState, initializeStore
  // (Should be okay as they rely on types or functions that now use updated types)
  applyCredit: async (amount) => {
    // This function primarily interacts with creditState and recalculates impact,
    // it doesn't directly manipulate the deep structure of citations, so should be fine.
    const { impactAnalysis, creditState, appStatus, transactions } = get();
    if (appStatus !== "idle" && appStatus !== "error") return false;
    if (!impactAnalysis || amount <= 0) return false;
    const currentUserId = auth.currentUser?.uid;
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
      // Recalculation uses the updated Transaction[] type internally via calculationService
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
  loadLatestTransactions: async (): Promise<boolean> => {
    // This function receives Transaction data from the API, which should now conform
    // to the updated type definition on the backend/storage service side.
    // The recalculation within this function also uses calculationService.
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
    let success = false;
    try {
      const authHeaders = await getAuthHeader();
      if (!authHeaders) {
        throw new Error("User not authenticated.");
      }
      console.log(
        `loadLatestTransactions: Calling API /api/transactions/latest for user ${userId}...`
      );
      const response = await fetch("/api/transactions/latest", {
        method: "GET",
        headers: authHeaders,
      });
      if (response.status === 404) {
        console.log("loadLatestTransactions: No data found (404).");
        const initialCreditState = await get().loadCreditState();
        set({
          hasSavedData: false,
          savedTransactions: null,
          transactions: [],
          impactAnalysis: null,
          creditState: initialCreditState ?? {
            availableCredit: 0,
            appliedCredit: 0,
            lastAppliedAmount: 0,
            lastAppliedAt: null,
          },
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
        // Assuming backend returns transactions matching the NEW Transaction type
        const loadedTransactions = (batch.transactions as Transaction[]).map(
          (tx) => ({ ...tx, analyzed: tx.analyzed ?? true })
        );
        if (!Array.isArray(loadedTransactions))
          throw new Error("Invalid data format in loaded batch");
        console.log(
          "loadLatestTransactions: Transactions loaded, now loading credit state..."
        );
        const loadedCreditState = await get().loadCreditState();
        const currentCreditState = loadedCreditState ?? {
          availableCredit: 0,
          appliedCredit: 0,
          lastAppliedAmount: 0,
          lastAppliedAt: null,
        };
        const currentAppliedCredit = currentCreditState.appliedCredit;
        console.log(
          `loadLatestTransactions: Credit state loaded. Applied: ${currentAppliedCredit}. Calculating final impact...`
        );
        const analysis = calculationService.calculateImpactAnalysis(
          loadedTransactions,
          currentAppliedCredit
        );
        console.log(
          "loadLatestTransactions: Final impact calculated. Setting state..."
        );
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
        console.log(
          "loadLatestTransactions: API returned OK but no batch data."
        );
        const initialCreditState = await get().loadCreditState();
        set({
          hasSavedData: false,
          savedTransactions: null,
          transactions: [],
          impactAnalysis: null,
          creditState: initialCreditState ?? {
            availableCredit: 0,
            appliedCredit: 0,
            lastAppliedAmount: 0,
            lastAppliedAt: null,
          },
          appStatus: "idle",
        });
        success = false;
      }
    } catch (error) {
      console.error("❌ loadLatestTransactions Error:", error);
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
    // This function recalculates impact based on current transactions, which now use the updated type.
    const currentUser = auth.currentUser;
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
        const data = docSnap.data();
        loadedAppliedCredit = data.appliedCredit || 0;
        loadedLastAmount = data.lastAppliedAmount || 0;
        loadedLastAt =
          data.lastAppliedAt instanceof Timestamp ? data.lastAppliedAt : null;
      } else {
        loadedLastAt = Timestamp.now();
        const init = sanitizeDataForFirestore({
          appliedCredit: 0,
          lastAppliedAmount: 0,
          lastAppliedAt: loadedLastAt,
        });
        if (!init) throw new Error("Failed sanitize init state");
        await setDoc(creditDocRef, init);
      }
      const currentTransactions = get().transactions; // Uses updated Transaction[] type
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
  initializeStore: async (user: User | null) => {
    // Relies on loadLatestTransactions which is now corrected.
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
    let loadedFromFirebase = false;
    try {
      loadedFromFirebase = await get().loadLatestTransactions();
      console.log(
        `initializeStore: loadLatestTransactions result: ${loadedFromFirebase}`
      );
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
      if (loadedFromFirebase) {
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
        await get().fetchTransactions(tokenToFetch);
      } else {
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
