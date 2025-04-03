// src/tsx/store/transactionStore.ts
import { create } from "zustand";
import {
  Transaction,
  AnalyzedTransactionData,
} from "@/shared/types/transactions";
import { ImpactAnalysis } from "@/core/calculations/type";
import { calculationService } from "@/core/calculations/impactService";
import { User } from "firebase/auth";
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
  // FirestoreError,
} from "firebase/firestore";
import { db } from "@/core/firebase/firebase";
// *** Ensure BOTH mappers are imported ***
import {
  mapPlaidTransactions,
  mergeTransactions,
} from "@/core/plaid/transactionMapper";

// --- Interface Definitions (Keep as is) ---
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
export interface TransactionState {
  transactions: Transaction[];
  savedTransactions: Transaction[] | null;
  impactAnalysis: ImpactAnalysis | null;
  totalSocietalDebt: number;
  connectionStatus: BankConnectionStatus;
  creditState: CreditState;
  isInitializing: boolean;
  isConnectingBank: boolean;
  isFetchingTransactions: boolean;
  isAnalyzing: boolean;
  isSaving: boolean;
  isApplyingCredit: boolean;
  isLoadingLatest: boolean;
  isLoadingCreditState: boolean;
  hasSavedData: boolean;
  setTransactions: (transactions: Transaction[]) => void;
  connectBank: (publicToken: string, user: User | null) => Promise<void>;
  disconnectBank: () => void;
  fetchTransactions: (accessToken?: string) => Promise<void>;
  manuallyFetchTransactions: () => Promise<void>;
  analyzeTransactions: (
    transactions: Transaction[]
  ) => Promise<AnalyzedTransactionData>;
  saveTransactions: (
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

// --- Helper Functions (Keep as is) ---
const isAnyLoading = (state: TransactionState): boolean => {
  return (
    state.isInitializing ||
    state.isConnectingBank ||
    state.isFetchingTransactions ||
    state.isAnalyzing ||
    state.isSaving ||
    state.isApplyingCredit ||
    state.isLoadingLatest ||
    state.isLoadingCreditState
  );
};
function getTransactionIdentifier(transaction: Transaction): string | null {

  const plaidId: string | undefined = transaction.plaidTransactionId;
  if (plaidId && typeof plaidId === "string" && plaidId.trim() !== "") {
    return `plaid-${plaidId}`;
  } else if (
    transaction.date &&
    transaction.name &&
    typeof transaction.amount === "number"
  ) {
    const normalizedName = transaction.name.trim().toUpperCase();
    return `${transaction.date}-${normalizedName}-${transaction.amount.toFixed(
      2
    )}`;
  } else {
    console.error(
      `Identifier Error: Cannot create reliable identifier for tx:`,
      transaction
    );
    return null;
  }
}
// --- End Helper Functions ---

// --- Store Implementation ---
export const useTransactionStore = create<TransactionState>((set, get) => ({
  // --- Initial State (Keep as is) ---
  transactions: [],
  savedTransactions: null,
  impactAnalysis: null,
  totalSocietalDebt: 0,
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
  isApplyingCredit: false,
  isLoadingLatest: false,
  isLoadingCreditState: false,
  hasSavedData: false,

  // --- Actions Implementation ---

  setTransactions: (transactions) => {
    const currentAppliedCredit = get().creditState.appliedCredit;
    const analysis = calculationService.calculateImpactAnalysis(
      transactions,
      currentAppliedCredit
    );
    set({
      transactions: transactions,
      impactAnalysis: analysis,
      totalSocietalDebt: analysis.effectiveDebt,
      creditState: {
        ...get().creditState,
        availableCredit: analysis.availableCredit,
      },
    });
  },

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
      const response = await fetch("/api/banking/exchange_token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_token: publicToken }),
      });
      const data = await response.json();
      if (!response.ok || !data.access_token)
        throw new Error(
          data.error || `Token exchange failed (${response.status})`
        );
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
      console.log("connectBank: Finished.");
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
      // Merge, not replace
      transactions: [],
      savedTransactions: null,
      impactAnalysis: null,
      totalSocietalDebt: 0,
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
      isApplyingCredit: false,
      isLoadingLatest: false,
      isLoadingCreditState: false,
      hasSavedData: false,
    });
    console.log("Store state reset complete.");
  },

  disconnectBank: () => {
    get().resetState();
  },

  // --- fetchTransactions - UPDATED ---
  fetchTransactions: async (accessToken) => {
    if (
      get().isFetchingTransactions ||
      get().isAnalyzing ||
      get().isLoadingLatest
    ) {
      console.log(
        "fetchTransactions: Skipping - Operation already in progress."
      );
      return;
    }
    set({
      isFetchingTransactions: true,
      connectionStatus: { ...get().connectionStatus, error: null },
    });
    let tokenToUse: string | null = accessToken || null;
    try {
      if (!tokenToUse) {
        const storedData = localStorage.getItem("plaid_access_token_info");
        if (!storedData) throw new Error("No access token available");
        tokenToUse = JSON.parse(storedData).token;
      }
      if (!tokenToUse) throw new Error("Access token missing");

      console.log("fetchTransactions: Fetching raw transactions...");
      const response = await fetch("/api/banking/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: tokenToUse }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (
          response.status === 400 &&
          errorData.details?.includes("ITEM_LOGIN_REQUIRED")
        ) {
          console.warn(
            "fetchTransactions: ITEM_LOGIN_REQUIRED received. Resetting state."
          );
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
      const mappedTransactions = mapPlaidTransactions(rawPlaidTransactions); // Map raw data

      if (!Array.isArray(mappedTransactions))
        throw new Error("Invalid mapped transaction data format"); // Check mapped data
      console.log(
        `WorkspaceTransactions: Received and mapped ${mappedTransactions.length} transactions.`
      );

      set((state) => ({
        // Update state after successful fetch and map
        isFetchingTransactions: false,
        connectionStatus: {
          ...state.connectionStatus,
          isConnected: true,
          error:
            mappedTransactions.length === 0 ? "No transactions found" : null,
        },
      }));

      // Call analyzeTransactions with the *mapped* data
      if (mappedTransactions.length > 0) {
        console.log(
          "fetchTransactions: Calling analyzeTransactions with mapped data..."
        );
        await get().analyzeTransactions(mappedTransactions);
        console.log("fetchTransactions: analyzeTransactions completed.");
      } else {
        console.log("fetchTransactions: Skipping analysis (no transactions).");
        if (get().isAnalyzing) set({ isAnalyzing: false });
      }
    } catch (error) {
      console.error("Error in fetchTransactions:", error);
      const isTokenError =
        error instanceof Error &&
        (error.message.includes("No access token") ||
          error.message.includes("expired"));
      set({
        isFetchingTransactions: false,
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
  // --- End fetchTransactions ---

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
    }
  },

  // --- analyzeTransactions - Keep previously corrected version with guard ---
  analyzeTransactions: async (
    incomingTransactions
  ): Promise<AnalyzedTransactionData> => {
    // Guard against running if still loading saved data or already analyzing
    const { isLoadingLatest, savedTransactions, hasSavedData, isAnalyzing } =
      get();
    if (isAnalyzing) {
      console.log("analyzeTransactions: Skipping - Already analyzing.");
      const { transactions: curTxs, impactAnalysis: curIm } = get();
      return {
        transactions: curTxs,
        totalPositiveImpact: curIm?.positiveImpact ?? 0,
        totalNegativeImpact: curIm?.negativeImpact ?? 0,
        totalSocietalDebt: curIm?.negativeImpact ?? 0,
        debtPercentage: curIm?.debtPercentage ?? 0,
      };
    }
    // If loading is still in progress, OR loading finished but savedTransactions is null AND we expect data
    if (
      isLoadingLatest ||
      (savedTransactions === null && hasSavedData === true && !isAnalyzing)
    ) {
      // Added !isAnalyzing to prevent potential loop if load completes mid-analysis
      console.warn(
        `analyzeTransactions: Postponing analysis. isLoadingLatest=${isLoadingLatest}, savedTransactions is null=${
          savedTransactions === null
        }, hasSavedData=${hasSavedData}`
      );
      const { transactions: curTxs, impactAnalysis: curIm } = get();
      return {
        transactions: curTxs,
        totalPositiveImpact: curIm?.positiveImpact ?? 0,
        totalNegativeImpact: curIm?.negativeImpact ?? 0,
        totalSocietalDebt: curIm?.negativeImpact ?? 0,
        debtPercentage: curIm?.debtPercentage ?? 0,
      };
    }
    if (!incomingTransactions || incomingTransactions.length === 0) {
      console.log("analyzeTransactions: Skipping - No incoming transactions.");
      // Get current state to return the existing analysis data
      const { transactions: currentTxs, impactAnalysis: currentImpact } = get();
      return {
        transactions: currentTxs,
        totalPositiveImpact: currentImpact?.positiveImpact ?? 0,
        totalNegativeImpact: currentImpact?.negativeImpact ?? 0,
        // Use the raw negative impact sum for consistency with other return paths
        totalSocietalDebt: currentImpact?.negativeImpact ?? 0,
        debtPercentage: currentImpact?.debtPercentage ?? 0,
      };
    }

    set({
      isAnalyzing: true,
      connectionStatus: { ...get().connectionStatus, error: null },
    });
    // console.log(`analyzeTransactions: Received ${incomingTransactions.length} incoming.`);

    // Filtering logic
    const savedTransactionMap = new Map<string, Transaction>();
    (savedTransactions || []).forEach((tx) => {
      if (tx.analyzed) {
        const id = getTransactionIdentifier(tx);
        if (id) savedTransactionMap.set(id, tx);
      }
    });
    console.log(
      `analyzeTransactions: Built map with ${savedTransactionMap.size} analyzed saved transactions.`
    );

    const transactionsToSendToApi = incomingTransactions.filter((tx) => {
      const id = getTransactionIdentifier(tx);
      return !id || !savedTransactionMap.has(id);
    });
    console.log(
      `analyzeTransactions: Filtered down to ${transactionsToSendToApi.length} transactions for API.`
    );

    let analysisApiResult: { transactions: Transaction[] } | null = null;
    try {
      // API Call
      if (transactionsToSendToApi.length > 0) {
        console.log(
          `analyzeTransactions: Calling API for ${transactionsToSendToApi.length} txs...`
        );
        const response = await fetch("/api/analysis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transactions: transactionsToSendToApi }),
        });
        if (!response.ok) {
          if (response.status === 405) {
            throw new Error("API Error 405 - Method Not Allowed.");
          }
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `API Error: ${response.status}`);
        }
        analysisApiResult = await response.json();
        if (
          !analysisApiResult ||
          !Array.isArray(analysisApiResult.transactions)
        )
          throw new Error("Invalid API response format");
        console.log(
          `analyzeTransactions: Received analysis for ${analysisApiResult.transactions.length} txs.`
        );
      } else {
        console.log("analyzeTransactions: No API call needed.");
        analysisApiResult = { transactions: [] };
      }

      // Merging
      const analyzedSavedTransactions =
        savedTransactions?.filter((tx) => tx.analyzed) || [];
      const newlyAnalyzedTransactions = (
        analysisApiResult?.transactions || []
      ).map((tx) => ({ ...tx, analyzed: true }));
      const mergedStage1 = mergeTransactions(
        analyzedSavedTransactions,
        newlyAnalyzedTransactions
      );
      const incomingNotSent = incomingTransactions.filter(
        (tx) => transactionsToSendToApi.indexOf(tx) === -1
      );
      const allFinalTransactions = mergeTransactions(
        mergedStage1,
        incomingNotSent
      );
      console.log(
        `analyzeTransactions: Merged into ${allFinalTransactions.length} final txs.`
      );

      // Recalculate & Update State
      const { creditState } = get();
      const finalUiImpact = calculationService.calculateImpactAnalysis(
        allFinalTransactions,
        creditState.appliedCredit
      );
      set({
        transactions: allFinalTransactions,
        savedTransactions: allFinalTransactions,
        impactAnalysis: finalUiImpact,
        totalSocietalDebt: finalUiImpact.effectiveDebt,
        creditState: {
          ...creditState,
          availableCredit: finalUiImpact.availableCredit,
        },
        isAnalyzing: false,
        connectionStatus: { ...get().connectionStatus, error: null },
      });
      console.log("analyzeTransactions: Analysis complete, state updated.");

      // Trigger Save
      if (allFinalTransactions.length > 0) {
        console.log("analyzeTransactions: Triggering save post-analysis...");
        const userId = (() => {
          try {
            return (
              JSON.parse(
                localStorage.getItem("plaid_access_token_info") || "{}"
              ).userId || null
            );
          } catch {
            return null;
          }
        })();
        if (userId) {
          const rawNegativeImpact = finalUiImpact.negativeImpact;
          Promise.resolve().then(() => {
            get().saveTransactions(
              allFinalTransactions,
              rawNegativeImpact,
              userId
            );
          });
        } else {
          console.warn(
            "analyzeTransactions: Cannot trigger save, user ID missing."
          );
        }
      }

      // Return final analysis data
      return {
        transactions: allFinalTransactions,
        totalPositiveImpact: finalUiImpact.positiveImpact,
        totalNegativeImpact: finalUiImpact.negativeImpact,
        totalSocietalDebt: finalUiImpact.negativeImpact,
        debtPercentage: finalUiImpact.debtPercentage,
      };
    } catch (error) {
      console.error("Error during analysis process:", error);
      const errorMsg =
        error instanceof Error ? error.message : "Failed to analyze";
      set({
        isAnalyzing: false,
        connectionStatus: { ...get().connectionStatus, error: errorMsg },
      });
      const { transactions: curTxs, impactAnalysis: curIm } = get();
      return {
        transactions: curTxs,
        totalPositiveImpact: curIm?.positiveImpact ?? 0,
        totalNegativeImpact: curIm?.negativeImpact ?? 0,
        totalSocietalDebt: curIm?.negativeImpact ?? 0,
        debtPercentage: curIm?.debtPercentage ?? 0,
      }; // Return current state on error
    }
  },
  // --- End analyzeTransactions ---

  // --- saveTransactions ---
  saveTransactions: async (transactionsToSave, totalNegativeDebt, userId) => {
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
      set({ savedTransactions: finalizedTransactions, hasSavedData: true }); // Update saved state *after* DB save
      console.log(`saveTransactions: Saved batch ${docRef.id}. Store updated.`);
    } catch (error) {
      console.error("Error saving:", error);
      set((state) => ({
        connectionStatus: {
          ...state.connectionStatus,
          error: "Failed to save",
        },
      }));
    } finally {
      set({ isSaving: false });
    }
  },
  // --- End saveTransactions ---

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
      } // Exit early if nothing to apply
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
        totalSocietalDebt: newAnalysis.effectiveDebt,
      });
      return true;
    } catch (error) {
      console.error("Error applying credit:", error);
      return false;
    } finally {
      set({ isApplyingCredit: false });
    }
  },
  // --- End applyCredit ---

  // --- loadLatestTransactions ---
  loadLatestTransactions: async (userId): Promise<boolean> => {
    if (!userId) {
      console.warn("loadLatest: No userId");
      return false;
    }
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
    if (get().isLoadingLatest) {
      console.log("loadLatest: Already loading.");
      return get().hasSavedData;
    }

    set({
      isLoadingLatest: true,
      hasSavedData: false,
      savedTransactions: null,
      connectionStatus: { ...get().connectionStatus, error: null },
    });
    console.log(`loadLatestTransactions: Loading for ${userId}...`);
    let success = false; // Track success
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
        ).map((tx) => ({ ...tx, analyzed: true }));
        if (!Array.isArray(loadedTransactions))
          throw new Error("Invalid data format");
        console.log(
          `loadLatestTransactions: Loaded ${loadedTransactions.length} txs.`
        );

        const loadedCreditState = await get().loadCreditState(userId);
        const initialAppliedCredit = loadedCreditState?.appliedCredit ?? 0;
        const analysis = calculationService.calculateImpactAnalysis(
          loadedTransactions,
          initialAppliedCredit
        );

        set({
          // Update store fully
          transactions: loadedTransactions,
          savedTransactions: loadedTransactions,
          impactAnalysis: analysis,
          totalSocietalDebt: analysis.effectiveDebt,
          hasSavedData: true,
          creditState: {
            ...get().creditState,
            availableCredit: analysis.availableCredit,
          },
          connectionStatus: { isConnected: true, error: null },
        });
        success = true; // Mark success
      } else {
        console.log("loadLatestTransactions: No data found.");
        set({ hasSavedData: false, savedTransactions: null, transactions: [] }); // Clear state
        success = false; // No data found isn't an error, but load wasn't successful in finding data
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
      success = false; // Mark failure
    } finally {
      set({ isLoadingLatest: false }); // Clear loading flag regardless of outcome
      console.log(`loadLatestTransactions: Finished. Success=${success}`);
    }
    return success; // Return actual success/failure
  },
  // --- End loadLatestTransactions ---

  // --- loadCreditState ---
  loadCreditState: async (userId): Promise<CreditState | null> => {
    if (!userId || get().isLoadingCreditState) return get().creditState;
    set({ isLoadingCreditState: true });
    let finalCreditState: CreditState | null = null; // To return
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

      const currentTransactions = get().transactions; // Use current state transactions
      const analysis = calculationService.calculateImpactAnalysis(
        currentTransactions,
        loadedAppliedCredit
      ); // Recalculate impact
      finalCreditState = {
        appliedCredit: loadedAppliedCredit,
        lastAppliedAmount: loadedLastAmount,
        lastAppliedAt: loadedLastAt,
        availableCredit: analysis.availableCredit,
      };

      set({
        creditState: finalCreditState,
        impactAnalysis: analysis,
        totalSocietalDebt: analysis.effectiveDebt,
      }); // Update store
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
    return finalCreditState; // Return the loaded/calculated state
  },
  // --- End loadCreditState ---

  // --- initializeStore ---
  initializeStore: async (user: User | null) => {
    if (!user) {
      get().resetState();
      return;
    }
    if (isAnyLoading(get())) return; // Skip if already busy
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

      // Check token only *after* load attempt finishes
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

      // Fetch ONLY if load failed AND token exists
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
  // --- End initializeStore ---
})); // End create
