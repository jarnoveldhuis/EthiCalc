// src/store/transactionStore.ts
import { create } from "zustand";
import {
  Transaction,
  AnalyzedTransactionData, // Structure for final results
} from "@/shared/types/transactions";
import { VendorAnalysis } from "@/shared/types/vendors"; // For cache saving type
import { ImpactAnalysis } from "@/core/calculations/type";
import { calculationService } from "@/core/calculations/impactService";
import { User } from "firebase/auth";
import {
  collection, addDoc, getDocs, query, where, orderBy, limit, Timestamp, doc, getDoc, setDoc
} from "firebase/firestore";
import { db } from "@/core/firebase/firebase";
import { mapPlaidTransactions, mergeTransactions } from "@/core/plaid/transactionMapper";
// Import vendor service functions for client-side use
import { getVendorAnalysis, saveVendorAnalysis, normalizeVendorName } from "@/features/vendors/vendorStorageService";
// Import the processing function if needed (or move logic here)
import { processTransactionList } from "@/features/analysis/transactionAnalysisService";

// --- Interface Definitions (mostly unchanged) ---
interface BankConnectionStatus { isConnected: boolean; error: string | null; }
interface CreditState { availableCredit: number; appliedCredit: number; lastAppliedAmount: number; lastAppliedAt: Timestamp | null; }
export interface TransactionState {
  transactions: Transaction[];
  savedTransactions: Transaction[] | null;
  impactAnalysis: ImpactAnalysis | null;
  // totalSocietalDebt: number; // Likely superseded by impactAnalysis.effectiveDebt
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
  userId: string | null;
  // Actions
  setTransactions: (transactions: Transaction[]) => void;
  connectBank: (publicToken: string, user: User | null) => Promise<void>;
  disconnectBank: () => void;
  fetchTransactions: (accessToken?: string) => Promise<void>;
  manuallyFetchTransactions: () => Promise<void>;
  analyzeAndCacheTransactions: (rawTransactions: Transaction[]) => Promise<void>;
  saveTransactionBatch: (transactions: Transaction[], totalNegativeDebt: number, userId?: string) => Promise<void>;
  applyCredit: (amount: number, userId?: string) => Promise<boolean>;
  loadLatestTransactions: (userId: string) => Promise<boolean>;
  loadCreditState: (userId: string) => Promise<CreditState | null>;
  resetState: () => void;
  initializeStore: (user: User | null) => Promise<void>;
  analyzeTransactions: (transactions: Transaction[]) => Promise<AnalyzedTransactionData>;
  saveTransactions: (transactions: Transaction[], totalNegativeDebt: number, userId?: string) => Promise<void>;
}
// --- End Interface Definitions ---

// --- Helper Functions ---
const isAnyLoading = (state: TransactionState): boolean => {
    return state.isInitializing || state.isConnectingBank || state.isFetchingTransactions ||
           state.isAnalyzing || state.isSaving || state.isApplyingCredit ||
           state.isLoadingLatest || state.isLoadingCreditState || state.isSavingCache;
};

function getTransactionIdentifier(transaction: Transaction): string | null {
    const plaidId: string | undefined = transaction.plaidTransactionId;
    if (plaidId && typeof plaidId === "string" && plaidId.trim() !== "") return `plaid-${plaidId}`;
    if (transaction.date && transaction.name && typeof transaction.amount === "number") {
        const normalizedName = transaction.name.trim().toUpperCase();
        return `${transaction.date}-${normalizedName}-${transaction.amount.toFixed(2)}`;
    }
    return null;
}
// --- End Helper Functions ---

// --- Store Implementation ---
export const useTransactionStore = create<TransactionState>((set, get) => ({
  // --- Initial State ---
  transactions: [],
  savedTransactions: null,
  impactAnalysis: null,
  // totalSocietalDebt: 0, // Use impactAnalysis.effectiveDebt
  connectionStatus: { isConnected: false, error: null },
  creditState: { availableCredit: 0, appliedCredit: 0, lastAppliedAmount: 0, lastAppliedAt: null },
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
  userId: null,

  // --- Actions Implementation ---

  setTransactions: (transactions) => {
      set({ transactions });
  },

  // connectBank: MODIFIED FETCH CALL
  connectBank: async (publicToken, user) => {
      if (!user || isAnyLoading(get())) {
          console.log("connectBank: Skipping (no user or already loading).");
          return;
      }
      set({
          isConnectingBank: true,
          connectionStatus: { isConnected: false, error: null },
      });
      try {
          // --- Modified Fetch: Use Request constructor ---
          const apiUrl = "/api/banking/exchange_token";
          const requestOptions: RequestInit = { // Define options for the Request object
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ public_token: publicToken }),
          };
          const request = new Request(apiUrl, requestOptions); // Create Request object explicitly
          const response = await fetch(request); // Pass the Request object to fetch
          // --- End Modified Fetch ---

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

          try { sessionStorage.removeItem('wasManuallyDisconnected'); } catch (e) { console.error("Failed to remove session storage item:", e); }

          await get().fetchTransactions(data.access_token);

      } catch (error) {
          console.error("Error connecting bank:", error);
          set({
              connectionStatus: {
                  isConnected: false,
                  error: error instanceof Error ? error.message : "Failed to connect bank",
              },
          });
      } finally {
          set({ isConnectingBank: false });
      }
  },

  // disconnectBank/resetState: (implementation unchanged)
  resetState: () => {
      console.log("resetState: Triggered.");
      try { sessionStorage.setItem('wasManuallyDisconnected', 'true'); } catch (e) { console.error(e); }
      try { localStorage.removeItem("plaid_access_token_info"); } catch (e) { console.error(e); }
      set({
        transactions: [], savedTransactions: null, impactAnalysis: null,
        connectionStatus: { isConnected: false, error: null },
        creditState: { availableCredit: 0, appliedCredit: 0, lastAppliedAmount: 0, lastAppliedAt: null },
        isInitializing: false, isConnectingBank: false, isFetchingTransactions: false, isAnalyzing: false,
        isSaving: false, isSavingCache: false, isApplyingCredit: false, isLoadingLatest: false, isLoadingCreditState: false,
        hasSavedData: false,
      });
  },
  disconnectBank: () => { get().resetState(); },


  // fetchTransactions: (implementation unchanged from previous step)
  fetchTransactions: async (accessToken) => {
      if (get().isFetchingTransactions || get().isAnalyzing || get().isLoadingLatest) return;
      set({ isFetchingTransactions: true, connectionStatus: { ...get().connectionStatus, error: null } });
      let tokenToUse: string | null = accessToken || null;
      try {
          if (!tokenToUse) {
              const storedData = localStorage.getItem("plaid_access_token_info");
              if (!storedData) throw new Error("No access token available");
              tokenToUse = JSON.parse(storedData).token;
          }
          if (!tokenToUse) throw new Error("Access token missing");

          const response = await fetch("/api/banking/transactions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ access_token: tokenToUse }) });
          if (!response.ok) {
               const errorData = await response.json().catch(() => ({}));
               if (response.status === 400 && errorData.details?.includes("ITEM_LOGIN_REQUIRED")) {
                    console.warn("fetchTransactions: ITEM_LOGIN_REQUIRED received. Resetting state.");
                    get().resetState(); throw new Error("Bank connection expired. Please reconnect.");
                }
                throw new Error(`Plaid fetch failed: ${response.status} ${errorData.details || "Unknown Plaid error"}`);
            }

          const rawPlaidTransactions = await response.json();
          const mappedTransactions = mapPlaidTransactions(rawPlaidTransactions);

          if (!Array.isArray(mappedTransactions)) throw new Error("Invalid mapped transaction data format");
          console.log(`WorkspaceTransactions: Received and mapped ${mappedTransactions.length} transactions.`);

          set((state) => ({
              isFetchingTransactions: false,
              connectionStatus: { ...state.connectionStatus, isConnected: true, error: mappedTransactions.length === 0 ? "No transactions found" : null },
          }));

          if (mappedTransactions.length > 0) {
              await get().analyzeAndCacheTransactions(mappedTransactions);
          } else {
               if (get().isAnalyzing) set({ isAnalyzing: false });
               get().analyzeAndCacheTransactions([]); // Process empty list
          }

      } catch (error) {
          console.error("Error in fetchTransactions:", error);
          const isTokenError = error instanceof Error && (error.message.includes("No access token") || error.message.includes("expired"));
          set({ isFetchingTransactions: false, connectionStatus: { isConnected: isTokenError ? false : get().connectionStatus.isConnected, error: error instanceof Error ? error.message : "Failed to load transactions" } });
      }
  },

  // manuallyFetchTransactions: (implementation unchanged)
  manuallyFetchTransactions: async () => {
      if (isAnyLoading(get())) return;
      try {
          const storedData = localStorage.getItem("plaid_access_token_info");
          if (!storedData) throw new Error("Cannot fetch: No bank connection found.");
          const tokenInfo = JSON.parse(storedData);
          await get().fetchTransactions(tokenInfo.token);
      } catch (error) {
          console.error("Manual fetch error:", error);
          set((state) => ({ connectionStatus: { ...state.connectionStatus, error: error instanceof Error ? error.message : "Manual fetch failed" } }));
          throw error;
      }
  },

  // analyzeAndCacheTransactions: (implementation unchanged from previous step)
  analyzeAndCacheTransactions: async (incomingTransactions) => {
      if (get().isAnalyzing) {
          console.log("analyzeAndCacheTransactions: Skipping, already analyzing.");
          return;
      }
      set({ isAnalyzing: true, connectionStatus: { ...get().connectionStatus, error: null } });
      console.log(`analyzeAndCacheTransactions: Starting analysis/cache check for ${incomingTransactions.length} transactions.`);

      const currentSavedTx = get().savedTransactions || [];
      const mergedInitialTransactions = mergeTransactions(currentSavedTx, incomingTransactions);
      const transactionsToProcess = mergedInitialTransactions.map(tx => ({ ...tx, analyzed: tx.analyzed ?? false }));

      const transactionsForApi: Transaction[] = [];
      const transactionsFromCache: Transaction[] = [];
      const alreadyAnalyzed: Transaction[] = [];

      // Client-side Cache Lookup
      const cacheLookupPromises = transactionsToProcess
          .filter(tx => !tx.analyzed)
          .map(async (tx) => {
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

      console.log(`analyzeAndCacheTransactions: Performing ${cacheLookupPromises.length} cache lookups.`);
      const cacheResults = await Promise.all(cacheLookupPromises);
      const transactionsById = new Map(transactionsToProcess.map(tx => [getTransactionIdentifier(tx), tx]));

      cacheResults.forEach(({ tx, cachedData }) => {
           const txId = getTransactionIdentifier(tx);
           if (!txId) return;
           if (cachedData) {
                const updatedTx = { /* ... merge cache data ... */
                     ...tx, unethicalPractices: cachedData.unethicalPractices || [], ethicalPractices: cachedData.ethicalPractices || [],
                     practiceWeights: cachedData.practiceWeights || {}, practiceSearchTerms: cachedData.practiceSearchTerms || {},
                     practiceCategories: cachedData.practiceCategories || {}, information: cachedData.information || {},
                     citations: cachedData.citations || {}, analyzed: true,
                 };
                transactionsFromCache.push(updatedTx);
                transactionsById.set(txId, updatedTx);
           } else {
               transactionsForApi.push(tx);
           }
      });

      transactionsToProcess.forEach(tx => {
           if(tx.analyzed && !transactionsFromCache.some(cachedTx => getTransactionIdentifier(cachedTx) === getTransactionIdentifier(tx))) {
               alreadyAnalyzed.push(tx);
           }
       });

      console.log(`analyzeAndCacheTransactions: ${transactionsFromCache.length} txs from cache, ${alreadyAnalyzed.length} already analyzed.`);
      console.log(`analyzeAndCacheTransactions: ${transactionsForApi.length} txs require API call.`);

      let apiAnalyzedResults: Transaction[] = [];

      try {
          if (transactionsForApi.length > 0) {
              console.log(`analyzeAndCacheTransactions: Calling API for ${transactionsForApi.length} txs...`);
              const response = await fetch("/api/analysis", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transactions: transactionsForApi }), });
              if (!response.ok) { const errData = await response.json().catch(() => ({})); throw new Error(errData.error || `API Error: ${response.status}`); }
              const analysisResponse = await response.json();
              if (!analysisResponse || !Array.isArray(analysisResponse.transactions)) { throw new Error("Invalid API response format"); }
              console.log(`analyzeAndCacheTransactions: Received analysis for ${analysisResponse.transactions.length} txs from API.`);

              const openAiResultsMap = new Map<string, any>();
              analysisResponse.transactions.forEach((analyzedTx: any) => { if (analyzedTx.plaidTransactionId) { openAiResultsMap.set(analyzedTx.plaidTransactionId, analyzedTx); } });

              set({ isSavingCache: true });
              const cacheSavePromises: Promise<void>[] = [];
              apiAnalyzedResults = transactionsForApi.map(originalTx => {
                   const originalId = originalTx.plaidTransactionId;
                   if (originalId && openAiResultsMap.has(originalId)) {
                       const analyzedVersion = openAiResultsMap.get(originalId)!;
                       const finalTxData: Transaction = { /* ... merge original and analyzed ... */
                           ...originalTx, societalDebt: analyzedVersion.societalDebt, unethicalPractices: analyzedVersion.unethicalPractices || [],
                           ethicalPractices: analyzedVersion.ethicalPractices || [], practiceWeights: analyzedVersion.practiceWeights || {},
                           practiceDebts: analyzedVersion.practiceDebts || {}, practiceSearchTerms: analyzedVersion.practiceSearchTerms || {},
                           practiceCategories: analyzedVersion.practiceCategories || {}, charities: analyzedVersion.charities || {},
                           information: analyzedVersion.information || {}, citations: analyzedVersion.citations || {}, analyzed: true,
                       };
                       const vendorNameForCache = originalTx.name;
                       const normalizedNameForCache = normalizeVendorName(vendorNameForCache);
                       if (normalizedNameForCache !== "unknown_vendor") {
                           const vendorDataToSave: Omit<VendorAnalysis, 'analyzedAt'> = { /* ... data for cache ... */
                                originalName: vendorNameForCache, analysisSource: 'openai',
                                unethicalPractices: finalTxData.unethicalPractices, ethicalPractices: finalTxData.ethicalPractices,
                                practiceWeights: finalTxData.practiceWeights, practiceSearchTerms: finalTxData.practiceSearchTerms,
                                practiceCategories: finalTxData.practiceCategories, information: finalTxData.information,
                                citations: finalTxData.citations,
                            };
                           cacheSavePromises.push(saveVendorAnalysis(normalizedNameForCache, vendorDataToSave));
                       }
                       return finalTxData;
                   }
                   return { ...originalTx, analyzed: false };
              });

              if (cacheSavePromises.length > 0) { await Promise.allSettled(cacheSavePromises); }
              set({ isSavingCache: false });

          } else { console.log("analyzeAndCacheTransactions: No API call needed."); }

          const finalTransactions = mergeTransactions([...alreadyAnalyzed, ...transactionsFromCache], apiAnalyzedResults );
          console.log(`analyzeAndCacheTransactions: Final merged list has ${finalTransactions.length} transactions.`);

          const currentCreditState = get().creditState;
          const finalImpact = calculationService.calculateImpactAnalysis(finalTransactions, currentCreditState.appliedCredit );

          set({
              transactions: finalTransactions,
              impactAnalysis: finalImpact,
              creditState: { ...currentCreditState, availableCredit: finalImpact.availableCredit },
              isAnalyzing: false,
              connectionStatus: { ...get().connectionStatus, error: null },
          });
           console.log("analyzeAndCacheTransactions: Analysis complete, state updated.");

      } catch (error) {
           console.error("Error during analysis orchestration:", error);
           set({ isAnalyzing: false, isSavingCache: false, connectionStatus: { ...get().connectionStatus, error: error instanceof Error ? error.message : "Analysis failed" } });
      }
  },
  // --- End analyzeAndCacheTransactions ---

  // saveTransactionBatch: (implementation unchanged)
  saveTransactionBatch: async (transactionsToSave, totalNegativeDebt, userId) => {
        if (get().isSaving) return;
        if (!transactionsToSave || transactionsToSave.length === 0) return;
        const currentUserId = userId || (() => { try { return JSON.parse(localStorage.getItem("plaid_access_token_info") || "{}").userId || null; } catch { return null; } })();
        if (!currentUserId) { console.error("Save Error: No User ID."); return; }
        set({ isSaving: true });
        try {
            const finalizedTransactions = transactionsToSave.map((tx) => ({ ...tx, analyzed: tx.analyzed ?? true }));
            const totalSpent = finalizedTransactions.reduce((sum, tx) => sum + tx.amount, 0);
            const debtPercentage = totalSpent > 0 ? (totalNegativeDebt / totalSpent) * 100 : 0;
            const batch = { userId: currentUserId, transactions: finalizedTransactions, totalSocietalDebt: totalNegativeDebt, debtPercentage, createdAt: Timestamp.now() };
            const docRef = await addDoc(collection(db, "transactionBatches"), batch);
            set({ hasSavedData: true });
            console.log(`saveTransactionBatch: Saved batch ${docRef.id}.`);
        } catch (error) {
            console.error("Error saving batch:", error);
            set((state) => ({ connectionStatus: { ...state.connectionStatus, error: "Failed to save batch" } }));
        } finally {
            set({ isSaving: false });
        }
  },

  // applyCredit: (implementation unchanged)
  applyCredit: async (amount, userId) => {
        const { impactAnalysis, creditState, isApplyingCredit, transactions } = get();
        if (isApplyingCredit || !impactAnalysis || amount <= 0) return false;
        const currentUserId = userId || (() => { try { return JSON.parse(localStorage.getItem("plaid_access_token_info") || "{}").userId || null; } catch { return null; } })();
        if (!currentUserId) return false;
        set({ isApplyingCredit: true });
        try {
            const creditToApply = Math.min(amount, impactAnalysis.availableCredit, impactAnalysis.effectiveDebt);
            if (creditToApply <= 0) { set({ isApplyingCredit: false }); return false; }
            const updatedCreditStateValues = { appliedCredit: creditState.appliedCredit + creditToApply, lastAppliedAmount: creditToApply, lastAppliedAt: Timestamp.now() };
            const creditDocRef = doc(db, "creditState", currentUserId);
            await setDoc(creditDocRef, updatedCreditStateValues, { merge: true });
            const newAnalysis = calculationService.calculateImpactAnalysis(transactions, updatedCreditStateValues.appliedCredit);
            set({
                creditState: { ...creditState, ...updatedCreditStateValues, availableCredit: newAnalysis.availableCredit },
                impactAnalysis: newAnalysis,
            });
            return true;
        } catch (error) { console.error("Error applying credit:", error); return false; }
        finally { set({ isApplyingCredit: false }); }
    },

  // loadLatestTransactions: (implementation unchanged)
  loadLatestTransactions: async (userId): Promise<boolean> => {
        if (!userId) return false;
        let wasManuallyDisconnected = false; try { wasManuallyDisconnected = sessionStorage.getItem("wasManuallyDisconnected") === "true"; } catch {}
        if (wasManuallyDisconnected) { set({ connectionStatus: { isConnected: false, error: "User manually disconnected." } }); return false; }
        if (get().isLoadingLatest) return get().hasSavedData;
        set({ isLoadingLatest: true, hasSavedData: false, savedTransactions: null, connectionStatus: { ...get().connectionStatus, error: null } });
        let success = false;
        try {
            const q = query(collection(db, "transactionBatches"), where("userId", "==", userId), orderBy("createdAt", "desc"), limit(1));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                const docData = querySnapshot.docs[0].data();
                const loadedTransactions = ((docData.transactions as Transaction[]) || []).map((tx) => ({ ...tx, analyzed: true }));
                if (!Array.isArray(loadedTransactions)) throw new Error("Invalid data format");
                const loadedCreditState = await get().loadCreditState(userId);
                const initialAppliedCredit = loadedCreditState?.appliedCredit ?? 0;
                const analysis = calculationService.calculateImpactAnalysis(loadedTransactions, initialAppliedCredit);
                set({
                    transactions: loadedTransactions, savedTransactions: loadedTransactions, impactAnalysis: analysis,
                    hasSavedData: true,
                    creditState: { ...get().creditState, availableCredit: analysis.availableCredit, appliedCredit: initialAppliedCredit },
                    connectionStatus: { isConnected: true, error: null },
                });
                success = true;
            } else { set({ hasSavedData: false, savedTransactions: null, transactions: [], impactAnalysis: null }); success = false; }
        } catch (error) { console.error("❌ loadLatestTransactions Error:", error); set((state) => ({ connectionStatus: { ...state.connectionStatus, error: error instanceof Error ? error.message : "Failed saved data" }, hasSavedData: false, savedTransactions: null })); success = false; }
        finally { set({ isLoadingLatest: false }); }
        return success;
    },

  // loadCreditState: (implementation unchanged)
  loadCreditState: async (userId): Promise<CreditState | null> => {
        if (!userId || get().isLoadingCreditState) return get().creditState;
        set({ isLoadingCreditState: true });
        let finalCreditState: CreditState | null = null;
        try {
            const creditDocRef = doc(db, "creditState", userId);
            const docSnap = await getDoc(creditDocRef);
            let loadedAppliedCredit = 0, loadedLastAmount = 0, loadedLastAt: Timestamp | null = null;
            if (docSnap.exists()) { const data = docSnap.data(); loadedAppliedCredit = data.appliedCredit || 0; loadedLastAmount = data.lastAppliedAmount || 0; loadedLastAt = data.lastAppliedAt instanceof Timestamp ? data.lastAppliedAt : null; }
            else { loadedLastAt = Timestamp.now(); await setDoc(creditDocRef, { appliedCredit: 0, lastAppliedAmount: 0, lastAppliedAt: loadedLastAt }); }
            const currentTransactions = get().transactions;
            const analysis = calculationService.calculateImpactAnalysis(currentTransactions, loadedAppliedCredit);
            finalCreditState = { appliedCredit: loadedAppliedCredit, lastAppliedAmount: loadedLastAmount, lastAppliedAt: loadedLastAt, availableCredit: analysis.availableCredit };
            set({ creditState: finalCreditState, impactAnalysis: analysis });
        } catch (error) { console.error("Error loading credit state:", error); set((state) => ({ connectionStatus: { ...state.connectionStatus, error: "Failed credit state" } })); finalCreditState = null; }
        finally { set({ isLoadingCreditState: false }); }
        return finalCreditState;
    },

  // initializeStore: (implementation unchanged)
  initializeStore: async (user: User | null) => {
        if (!user) { get().resetState(); return; }
        if (isAnyLoading(get())) return;
        let wasManuallyDisconnected = false; try { wasManuallyDisconnected = sessionStorage.getItem("wasManuallyDisconnected") === "true"; } catch {}
        if (wasManuallyDisconnected) { set({ connectionStatus: { isConnected: false, error: "Manually disconnected." }, isInitializing: false }); try { localStorage.removeItem("plaid_access_token_info"); } catch (e) { console.error(e); } return; }
        set({ isInitializing: true, connectionStatus: { ...get().connectionStatus, error: null } });
        let loadedFromFirebase = false;
        try {
            loadedFromFirebase = await get().loadLatestTransactions(user.uid);
            let hasValidStoredToken = false, tokenToFetch: string | null = null;
            try { const storedData = localStorage.getItem("plaid_access_token_info"); if (storedData) { const tokenInfo = JSON.parse(storedData); if (tokenInfo.userId === user.uid) { hasValidStoredToken = true; tokenToFetch = tokenInfo.token; } else { localStorage.removeItem("plaid_access_token_info"); } } } catch (e) { localStorage.removeItem("plaid_access_token_info"); console.error(e); }
            if (!loadedFromFirebase && hasValidStoredToken && tokenToFetch) { await get().fetchTransactions(tokenToFetch); }
            else if (!loadedFromFirebase && !hasValidStoredToken) { set((state) => ({ connectionStatus: { ...state.connectionStatus, isConnected: false, error: null } })); }
            else if (loadedFromFirebase) { set((state) => ({ connectionStatus: { ...state.connectionStatus, isConnected: true, error: null } })); }
        } catch (error) { console.error("❌ initializeStore Error:", error); set({ connectionStatus: { isConnected: false, error: error instanceof Error ? error.message : "Init failed" } }); }
        finally { set({ isInitializing: false }); }
    },

  analyzeTransactions: async (transactions: Transaction[]): Promise<AnalyzedTransactionData> => {
    if (get().isAnalyzing) {
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
    set({ isAnalyzing: true });
    try {
      const analysisResult = processTransactionList(transactions);
      const impactAnalysis = calculationService.calculateImpactAnalysis(transactions, get().creditState.appliedCredit);
      set({ impactAnalysis });
      return analysisResult;
    } catch (error) {
      console.error("Error analyzing transactions:", error);
      throw error;
    } finally {
      set({ isAnalyzing: false });
    }
  },

  saveTransactions: async (transactions: Transaction[], totalNegativeDebt: number, userId?: string): Promise<void> => {
    if (get().isSaving) return;
    set({ isSaving: true });
    try {
      const batch = {
        userId: userId || get().userId,
        transactions,
        totalSocietalDebt: totalNegativeDebt,
        createdAt: Timestamp.now(),
      };
      await addDoc(collection(db, "transactionBatches"), batch);
      set({ savedTransactions: transactions });
    } catch (error) {
      console.error("Error saving transactions:", error);
      throw error;
    } finally {
      set({ isSaving: false });
    }
  },

})); // End create