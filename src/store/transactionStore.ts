// src/store/transactionStore.ts
import { create } from "zustand";
import { Transaction, Charity } from "@/shared/types/transactions";
import { VendorAnalysis } from "@/shared/types/vendors";
import { ImpactAnalysis } from "@/core/calculations/type";
import { calculationService } from "@/core/calculations/impactService";
import { User } from "firebase/auth"; // Import User type
import { auth } from "@/core/firebase/firebase"; // Import auth itself for current user access
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";
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
// Type for Plaid Token stored in localStorage
interface StoredTokenInfo {
  token: string;
  userId: string;
  timestamp: number;
}
// Type for API analysis results
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
  citations?: Record<string, string>;
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
  // Loading states
  isInitializing: boolean;
  isConnectingBank: boolean;
  isFetchingTransactions: boolean;
  isAnalyzing: boolean;
  isSaving: boolean;
  isSavingCache: boolean;
  isApplyingCredit: boolean;
  isLoadingLatest: boolean;
  isLoadingCreditState: boolean;
  // Status flags
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
    transactions: Transaction[],
    totalNegativeDebt: number,
    userId?: string
  ) => Promise<void>;
  applyCredit: (amount: number, userId?: string) => Promise<boolean>;
  loadLatestTransactions: (userId: string) => Promise<boolean>;
  loadCreditState: (userId: string) => Promise<CreditState | null>;
  resetState: () => void;
  initializeStore: (user: User | null) => Promise<void>;
}
// --- End Interface Definitions ---

// --- Helper Functions ---
const isAnyLoading = (state: TransactionState): boolean => {
  /* ... */ return (
    state.isInitializing ||
    state.isConnectingBank ||
    state.isFetchingTransactions ||
    state.isAnalyzing ||
    state.isSaving ||
    state.isApplyingCredit ||
    state.isLoadingLatest ||
    state.isLoadingCreditState ||
    state.isSavingCache
  );
};
function getTransactionIdentifier(transaction: Transaction): string | null {
  /* ... */ const plaidId = transaction.plaidTransactionId;
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
  isInitializing: false,
  isConnectingBank: false,
  isFetchingTransactions: false,
  isAnalyzing: false,
  isSaving: false,
  isSavingCache: false,
  isApplyingCredit: false,
  isLoadingLatest: false,
  isLoadingCreditState: false,
  hasSavedData: false,

  // --- Actions ---

  // --- setTransactions ---
  // Recalculates impact when transactions are set directly (e.g., after loading)
  setTransactions: (transactions) => {
    const currentAppliedCredit = get().creditState.appliedCredit;
    const analysis = calculationService.calculateImpactAnalysis(
      transactions,
      currentAppliedCredit
    );
    set({
      transactions: transactions,
      impactAnalysis: analysis,
      // totalSocietalDebt: analysis.effectiveDebt, // Update if needed
      creditState: {
        ...get().creditState,
        availableCredit: analysis.availableCredit, // Update available credit based on new list
      },
    });
  },

  // --- connectBank ---
  connectBank: async (publicToken, user) => {
    if (!user || isAnyLoading(get())) {
      console.log("connectBank: Skipping.");
      return;
    }
    set({
      isConnectingBank: true,
      connectionStatus: { isConnected: false, error: null },
    });
    try {
      const apiUrl = "/api/banking/exchange_token";
      const requestOptions: RequestInit = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_token: publicToken }),
      };
      const request = new Request(apiUrl, requestOptions);
      const response = await fetch(request);
      const data = await response.json();
      if (!response.ok || !data.access_token) {
        throw new Error(
          data.error || `Token exchange failed (${response.status})`
        );
      }
      const tokenInfo = {
        token: data.access_token,
        userId: user.uid,
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
      await get().fetchTransactions(data.access_token);
    } catch (error) {
      console.error("Error connecting bank:", error);
      set({
        connectionStatus: {
          isConnected: false,
          error:
            error instanceof Error ? error.message : "Failed to connect bank",
        },
      });
    } finally {
      set({ isConnectingBank: false });
    }
  },

  // --- resetState / disconnectBank ---
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
      isInitializing: false,
      isConnectingBank: false,
      isFetchingTransactions: false,
      isAnalyzing: false,
      isSaving: false,
      isSavingCache: false,
      isApplyingCredit: false,
      isLoadingLatest: false,
      isLoadingCreditState: false,
      hasSavedData: false,
    });
  },
  disconnectBank: () => {
    get().resetState();
  },

  fetchTransactions: async (accessToken) => {
    if (
      get().isFetchingTransactions ||
      get().isAnalyzing ||
      get().isLoadingLatest
    )
      return;
    set({
      isFetchingTransactions: true,
      connectionStatus: { ...get().connectionStatus, error: null },
    });

    let tokenToUse: string | null = accessToken || null;
    const currentUserId = auth.currentUser?.uid; // Get current user from auth

    try {
      // If no access token was passed in, try getting it from storage
      if (!tokenToUse) {
        const storedData = localStorage.getItem("plaid_access_token_info");
        if (!storedData) {
          throw new Error("No access token available");
        }
        try {
          const tokenInfo = JSON.parse(storedData) as StoredTokenInfo;
          // *** ADDED CHECK: Verify stored token belongs to the CURRENT user ***
          if (!currentUserId || tokenInfo.userId !== currentUserId) {
            console.warn(
              "Stored Plaid token belongs to a different user or user is not logged in. Clearing invalid token."
            );
            localStorage.removeItem("plaid_access_token_info"); // Clear invalid token
            throw new Error("Invalid access token for current user."); // Prevent using wrong token
          }
          // Token is valid for the current user
          tokenToUse = tokenInfo.token;
          console.log(
            "fetchTransactions: Using valid token from localStorage."
          );
        } catch (parseError) {
          console.error("Error parsing stored token info:", parseError);
          localStorage.removeItem("plaid_access_token_info"); // Clear corrupted token
          throw new Error("Failed to read stored access token.");
        }
      }

      if (!tokenToUse) {
        // This should ideally not be reached if logic above is correct, but handle defensively
        throw new Error("Access token missing after checks.");
      }

      console.log("fetchTransactions: Fetching raw transactions...");
      const response = await fetch("/api/banking/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: tokenToUse }),
      });

      if (!response.ok) {
        // ... (error handling for Plaid API errors remains the same) ...
        const errorData = await response.json().catch(() => ({}));
        if (
          response.status === 400 &&
          errorData.details?.includes("ITEM_LOGIN_REQUIRED")
        ) {
          get().resetState();
          throw new Error("Bank connection expired. Please reconnect.");
        }
        throw new Error(
          `Plaid fetch failed: ${response.status} ${
            errorData.details || "Unknown Plaid error"
          }`
        );
      }

      const rawPlaidTransactions = await response.json();
      const mappedTransactions = mapPlaidTransactions(rawPlaidTransactions);
      if (!Array.isArray(mappedTransactions))
        throw new Error("Invalid mapped transaction data format");
      console.log(
        `WorkspaceTransactions: Received and mapped ${mappedTransactions.length} transactions.`
      );

      set((state) => ({
        isFetchingTransactions: false,
        connectionStatus: {
          ...state.connectionStatus,
          isConnected: true,
          error:
            mappedTransactions.length === 0 ? "No transactions found" : null,
        },
      }));

      // Trigger analysis for the fetched transactions
      if (mappedTransactions.length > 0) {
        await get().analyzeAndCacheTransactions(mappedTransactions);
      } else {
        // Ensure analysis state is cleared if no transactions are fetched
        if (get().isAnalyzing) set({ isAnalyzing: false });
        await get().analyzeAndCacheTransactions([]); // Process empty list to potentially clear state
      }
    } catch (error) {
      console.error("Error in fetchTransactions:", error);
      const isTokenError =
        error instanceof Error &&
        (error.message.includes("No access token") ||
          error.message.includes("expired") ||
          error.message.includes("Invalid access token"));
      set({
        isFetchingTransactions: false,
        // If it was a token error, ensure connection status reflects not connected
        connectionStatus: {
          isConnected: isTokenError
            ? false
            : get().connectionStatus.isConnected,
          error:
            error instanceof Error
              ? error.message
              : "Failed to load transactions",
        },
      });
    }
  },

  // --- manuallyFetchTransactions ---
  manuallyFetchTransactions: async () => {
    if (isAnyLoading(get())) return;
    try {
      const storedData = localStorage.getItem("plaid_access_token_info");
      if (!storedData)
        throw new Error("Cannot fetch: No bank connection found.");
      const tokenInfo = JSON.parse(storedData);
      await get().fetchTransactions(tokenInfo.token);
    } catch (error) {
      console.error("Manual fetch error:", error);
      set((state) => ({
        connectionStatus: {
          ...state.connectionStatus,
          error: error instanceof Error ? error.message : "Manual fetch failed",
        },
      }));
      throw error;
    }
    if (isAnyLoading(get())) return;
    try {
      const storedData = localStorage.getItem("plaid_access_token_info");
      if (!storedData)
        throw new Error("Cannot fetch: No bank connection found.");
      /* No need to re-verify user here, fetchTransactions will do it */ await get().fetchTransactions();
    } catch (error) {
      console.error("Manual fetch error:", error);
      set((state) => ({
        connectionStatus: {
          ...state.connectionStatus,
          error: error instanceof Error ? error.message : "Manual fetch failed",
        },
      }));
      throw error;
    }
  },

  // --- analyzeAndCacheTransactions ---
  analyzeAndCacheTransactions: async (incomingTransactions) => {
    if (get().isAnalyzing) {
      console.log("analyzeAndCacheTransactions: Skipping, already analyzing.");
      return;
    }
    set({
      isAnalyzing: true,
      connectionStatus: { ...get().connectionStatus, error: null },
    });
    console.log(
      `analyzeAndCacheTransactions: Starting analysis/cache check for ${incomingTransactions.length} transactions.`
    );
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
    const cacheLookupPromises = transactionsToProcess
      .filter((tx) => !tx.analyzed)
      .map(async (tx) => {
        /* ... cache lookup logic ... */
        const vendorName = tx.name;
        const normalizedName = normalizeVendorName(vendorName);
        if (normalizedName !== "unknown_vendor") {
          try {
            const cachedData = await getVendorAnalysis(normalizedName);
            return { tx, cachedData };
          } catch (error) {
            console.error(`Error fetching cache for ${normalizedName}:`, error);
            return { tx, cachedData: null };
          }
        }
        return { tx, cachedData: null };
      });
    console.log(
      `analyzeAndCacheTransactions: Performing ${cacheLookupPromises.length} cache lookups.`
    );
    const cacheResults = await Promise.all(cacheLookupPromises);
    const transactionsById = new Map(
      transactionsToProcess.map((tx) => [getTransactionIdentifier(tx), tx])
    );
    cacheResults.forEach(({ tx, cachedData }) => {
      /* ... process cache results ... */
      const txId = getTransactionIdentifier(tx);
      if (!txId) return;
      if (cachedData) {
        const updatedTx: Transaction = {
          /* merge */ ...tx,
          unethicalPractices: cachedData.unethicalPractices || [],
          ethicalPractices: cachedData.ethicalPractices || [],
          practiceWeights: cachedData.practiceWeights || {},
          practiceSearchTerms: cachedData.practiceSearchTerms || {},
          practiceCategories: cachedData.practiceCategories || {},
          information: cachedData.information || {},
          citations: cachedData.citations || {},
          analyzed: true,
        };
        transactionsFromCache.push(updatedTx);
        transactionsById.set(txId, updatedTx);
      } else {
        transactionsForApi.push(tx);
      }
    });
    transactionsToProcess.forEach((tx) => {
      /* ... populate alreadyAnalyzed list ... */
      const txId = getTransactionIdentifier(tx);
      if (tx.analyzed && txId && !transactionsById.get(txId)?.analyzed) {
        alreadyAnalyzed.push(tx);
      } else if (tx.analyzed && txId && transactionsById.get(txId)?.analyzed) {
        if (
          !alreadyAnalyzed.some(
            (analyzedTx) => getTransactionIdentifier(analyzedTx) === txId
          )
        ) {
          alreadyAnalyzed.push(transactionsById.get(txId)!);
        }
      }
    });
    console.log(
      `analyzeAndCacheTransactions: ${transactionsFromCache.length} txs from cache, ${alreadyAnalyzed.length} already analyzed.`
    );
    console.log(
      `analyzeAndCacheTransactions: ${transactionsForApi.length} txs require API call.`
    );
    let apiAnalyzedResults: Transaction[] = [];
    try {
      if (transactionsForApi.length > 0) {
        console.log(
          `analyzeAndCacheTransactions: Calling API for ${transactionsForApi.length} txs...`
        );
        const response = await fetch("/api/analysis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transactions: transactionsForApi }),
        });
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `API Error: ${response.status}`);
        }
        const analysisResponse = (await response.json()) as ApiAnalysisResponse; // Use defined type
        if (
          !analysisResponse ||
          !Array.isArray(analysisResponse.transactions)
        ) {
          throw new Error("Invalid API response format");
        }
        console.log(
          `analyzeAndCacheTransactions: Received analysis for ${analysisResponse.transactions.length} txs from API.`
        );
        const openAiResultsMap = new Map<string, ApiAnalysisResultItem>(); // Use defined type
        analysisResponse.transactions.forEach(
          (analyzedTx: ApiAnalysisResultItem) => {
            /* populate map */ if (analyzedTx.plaidTransactionId) {
              openAiResultsMap.set(analyzedTx.plaidTransactionId, analyzedTx);
            }
          }
        );
        set({ isSavingCache: true });
        const cacheSavePromises: Promise<void>[] = [];
        apiAnalyzedResults = transactionsForApi.map((originalTx) => {
          /* ... merge API results and prepare cache saves ... */
          const originalId = originalTx.plaidTransactionId;
          if (originalId && openAiResultsMap.has(originalId)) {
            const analyzedVersion: ApiAnalysisResultItem =
              openAiResultsMap.get(originalId)!;
            const finalTxData: Transaction = {
              /* merge */ ...originalTx,
              societalDebt: analyzedVersion.societalDebt,
              unethicalPractices: analyzedVersion.unethicalPractices || [],
              ethicalPractices: analyzedVersion.ethicalPractices || [],
              practiceWeights: analyzedVersion.practiceWeights || {},
              practiceDebts: analyzedVersion.practiceDebts || {},
              practiceSearchTerms: analyzedVersion.practiceSearchTerms || {},
              practiceCategories: analyzedVersion.practiceCategories || {},
              charities: analyzedVersion.charities || {},
              information: analyzedVersion.information || {},
              citations: analyzedVersion.citations || {},
              analyzed: true,
            };
            const vendorNameForCache = originalTx.name;
            const normalizedNameForCache =
              normalizeVendorName(vendorNameForCache);
            if (normalizedNameForCache !== "unknown_vendor") {
              const vendorDataToSave: Omit<VendorAnalysis, "analyzedAt"> = {
                /* data */ originalName: vendorNameForCache,
                analysisSource: "openai",
                unethicalPractices: finalTxData.unethicalPractices,
                ethicalPractices: finalTxData.ethicalPractices,
                practiceWeights: finalTxData.practiceWeights,
                practiceSearchTerms: finalTxData.practiceSearchTerms,
                practiceCategories: finalTxData.practiceCategories,
                information: finalTxData.information,
                citations: finalTxData.citations,
              };
              cacheSavePromises.push(
                saveVendorAnalysis(normalizedNameForCache, vendorDataToSave)
              );
            }
            return finalTxData;
          }
          return { ...originalTx, analyzed: false };
        });
        if (cacheSavePromises.length > 0) {
          await Promise.allSettled(cacheSavePromises);
        }
        set({ isSavingCache: false });
      } else {
        console.log("analyzeAndCacheTransactions: No API call needed.");
      }
      const finalTransactions = mergeTransactions(
        [...alreadyAnalyzed, ...transactionsFromCache],
        apiAnalyzedResults
      );
      console.log(
        `analyzeAndCacheTransactions: Final merged list has ${finalTransactions.length} transactions.`
      );
      const currentCreditState = get().creditState;
      const finalImpact = calculationService.calculateImpactAnalysis(
        finalTransactions,
        currentCreditState.appliedCredit
      );
      set({
        transactions: finalTransactions,
        impactAnalysis: finalImpact,
        creditState: {
          ...currentCreditState,
          availableCredit: finalImpact.availableCredit,
        },
        isAnalyzing: false,
        connectionStatus: { ...get().connectionStatus, error: null },
      });
      console.log(
        "analyzeAndCacheTransactions: Analysis complete, state updated."
      );
      // Trigger Save AFTER analysis and state update is complete
      const userId = (() => {
        try {
          return (
            JSON.parse(localStorage.getItem("plaid_access_token_info") || "{}")
              .userId || null
          );
        } catch {
          return null;
        }
      })();
      if (userId && finalTransactions.length > 0) {
        console.log(
          "analyzeAndCacheTransactions: Triggering save transaction batch..."
        );
        // Call saveTransactionBatch asynchronously (don't necessarily need to wait for it)
        get()
          .saveTransactionBatch(
            finalTransactions,
            finalImpact.negativeImpact,
            userId
          )
          .catch((err) =>
            console.error("Failed to save transaction batch:", err)
          ); // Log errors if save fails
      } else if (!userId) {
        console.warn(
          "analyzeAndCacheTransactions: Cannot trigger save, user ID missing."
        );
      }
    } catch (error) {
      console.error("Error during analysis orchestration:", error);
      set({
        isAnalyzing: false,
        isSavingCache: false,
        connectionStatus: {
          ...get().connectionStatus,
          error: error instanceof Error ? error.message : "Analysis failed",
        },
      });
    }
  },
  // --- End analyzeAndCacheTransactions ---

  // --- saveTransactionBatch ---
  saveTransactionBatch: async (
    transactionsToSave,
    totalNegativeDebt,
    userId
  ) => {
    if (get().isSaving) return;
    if (!transactionsToSave || transactionsToSave.length === 0) return;
    const currentUserId =
      userId ||
      (() => {
        try {
          return (
            JSON.parse(localStorage.getItem("plaid_access_token_info") || "{}")
              .userId || null
          );
        } catch {
          return null;
        }
      })();
    if (!currentUserId) {
      console.error("Save Error: No User ID.");
      return;
    }
    set({ isSaving: true });
    try {
      const finalizedTransactions = transactionsToSave.map((tx) => ({
        ...tx,
        analyzed: tx.analyzed ?? true,
      }));
      const totalSpent = finalizedTransactions.reduce(
        (sum, tx) => sum + tx.amount,
        0
      );
      const debtPercentage =
        totalSpent > 0 ? (totalNegativeDebt / totalSpent) * 100 : 0;
      const batch = {
        userId: currentUserId,
        transactions: finalizedTransactions,
        totalSocietalDebt: totalNegativeDebt,
        debtPercentage,
        createdAt: Timestamp.now(),
      };
      const docRef = await addDoc(collection(db, "transactionBatches"), batch);
      set({ hasSavedData: true }); // Indicate data exists in DB
      console.log(`saveTransactionBatch: Saved batch ${docRef.id}.`);
    } catch (error) {
      console.error("Error saving batch:", error);
      set((state) => ({
        connectionStatus: {
          ...state.connectionStatus,
          error: "Failed to save batch",
        },
      }));
    } finally {
      set({ isSaving: false });
    }
    
  },

  // --- applyCredit ---
  applyCredit: async (amount, userId) => {
    const { impactAnalysis, creditState, isApplyingCredit, transactions } =
      get();
    if (isApplyingCredit || !impactAnalysis || amount <= 0) return false;
    const currentUserId =
      userId ||
      (() => {
        try {
          return (
            JSON.parse(localStorage.getItem("plaid_access_token_info") || "{}")
              .userId || null
          );
        } catch {
          return null;
        }
      })();
    if (!currentUserId) return false;
    set({ isApplyingCredit: true });
    try {
      const creditToApply = Math.min(
        amount,
        impactAnalysis.availableCredit,
        impactAnalysis.effectiveDebt
      );
      if (creditToApply <= 0) {
        set({ isApplyingCredit: false });
        return false;
      }
      const updatedCreditStateValues = {
        appliedCredit: creditState.appliedCredit + creditToApply,
        lastAppliedAmount: creditToApply,
        lastAppliedAt: Timestamp.now(),
      };
      const creditDocRef = doc(db, "creditState", currentUserId);
      await setDoc(creditDocRef, updatedCreditStateValues, { merge: true });
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
      return false;
    } finally {
      set({ isApplyingCredit: false });
    }
  },

  // --- loadLatestTransactions ---
  loadLatestTransactions: async (userId): Promise<boolean> => {
    if (!userId) return false;
    let wasManuallyDisconnected = false;
    try {
      wasManuallyDisconnected =
        sessionStorage.getItem("wasManuallyDisconnected") === "true";
    } catch {}
    if (wasManuallyDisconnected) {
      set({
        connectionStatus: {
          isConnected: false,
          error: "User manually disconnected.",
        },
      });
      return false;
    }
    if (get().isLoadingLatest) return get().hasSavedData;
    set({
      isLoadingLatest: true,
      hasSavedData: false,
      savedTransactions: null,
      connectionStatus: { ...get().connectionStatus, error: null },
    });
    let success = false;
    try {
      const q = query(
        collection(db, "transactionBatches"),
        where("userId", "==", userId),
        orderBy("createdAt", "desc"),
        limit(1)
      );
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const docData = querySnapshot.docs[0].data();
        const loadedTransactions = (
          (docData.transactions as Transaction[]) || []
        ).map((tx) => ({ ...tx, analyzed: true })); // Assume saved are analyzed
        if (!Array.isArray(loadedTransactions))
          throw new Error("Invalid data format in loaded batch");
        const loadedCreditState = await get().loadCreditState(userId);
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
            ...get().creditState,
            availableCredit: analysis.availableCredit,
            appliedCredit: initialAppliedCredit,
          },
          connectionStatus: { isConnected: true, error: null },
        });
        success = true;
      } else {
        set({
          hasSavedData: false,
          savedTransactions: null,
          transactions: [],
          impactAnalysis: null,
        });
        success = false;
      }
    } catch (error) {
      console.error("❌ loadLatestTransactions Error:", error);
      set((state) => ({
        connectionStatus: {
          ...state.connectionStatus,
          error: error instanceof Error ? error.message : "Failed saved data",
        },
        hasSavedData: false,
        savedTransactions: null,
      }));
      success = false;
    } finally {
      set({ isLoadingLatest: false });
    }
    return success;
  },

  // --- loadCreditState ---
  loadCreditState: async (userId): Promise<CreditState | null> => {
    if (!userId || get().isLoadingCreditState) return get().creditState;
    set({ isLoadingCreditState: true });
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
        await setDoc(creditDocRef, {
          appliedCredit: 0,
          lastAppliedAmount: 0,
          lastAppliedAt: loadedLastAt,
        });
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
        connectionStatus: {
          ...state.connectionStatus,
          error: "Failed credit state",
        },
      }));
      finalCreditState = null;
    } finally {
      set({ isLoadingCreditState: false });
    }
    return finalCreditState;
  },

  // --- initializeStore ---
  initializeStore: async (user: User | null) => {
    if (!user) {
      get().resetState();
      return;
    }
    if (isAnyLoading(get())) return;
    let wasManuallyDisconnected = false;
    try {
      wasManuallyDisconnected =
        sessionStorage.getItem("wasManuallyDisconnected") === "true";
    } catch {}
    if (wasManuallyDisconnected) {
      set({
        connectionStatus: {
          isConnected: false,
          error: "Manually disconnected.",
        },
        isInitializing: false,
      });
      try {
        localStorage.removeItem("plaid_access_token_info");
      } catch (e) {
        console.error(e);
      }
      return;
    }
    set({
      isInitializing: true,
      connectionStatus: { ...get().connectionStatus, error: null },
    });
    console.log(`initializeStore: Starting for ${user.uid}`);
    let loadedFromFirebase = false;
    try {
      console.log("initializeStore: Awaiting loadLatestTransactions...");
      loadedFromFirebase = await get().loadLatestTransactions(user.uid);
      console.log(
        `initializeStore: loadLatestTransactions result: ${loadedFromFirebase}`
      );
      let hasValidStoredToken = false,
        tokenToFetch: string | null = null;
      try {
        const storedData = localStorage.getItem("plaid_access_token_info");
        if (storedData) {
          const tokenInfo = JSON.parse(storedData);
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
      if (!loadedFromFirebase && hasValidStoredToken && tokenToFetch) {
        console.log(
          "initializeStore: No Firebase data, valid token exists. Fetching fresh..."
        );
        await get().fetchTransactions(tokenToFetch);
      } else if (!loadedFromFirebase && !hasValidStoredToken) {
        console.log("initializeStore: No Firebase data and no valid token.");
        set((state) => ({
          connectionStatus: {
            ...state.connectionStatus,
            isConnected: false,
            error: null,
          },
        }));
      } else if (loadedFromFirebase) {
        console.log(
          "initializeStore: Loaded from Firebase. Ensure connected status."
        );
        set((state) => ({
          connectionStatus: {
            ...state.connectionStatus,
            isConnected: true,
            error: null,
          },
        }));
      }
    } catch (error) {
      console.error("❌ initializeStore Error:", error);
      set({
        connectionStatus: {
          isConnected: false,
          error: error instanceof Error ? error.message : "Init failed",
        },
      });
    } finally {
      set({ isInitializing: false });
      console.log("initializeStore: Finished.");
    }
  },
})); // End create
