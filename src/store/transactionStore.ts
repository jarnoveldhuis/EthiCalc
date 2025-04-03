// src/store/transactionStore.ts
import { create } from 'zustand';
import { Transaction, AnalyzedTransactionData } from '@/shared/types/transactions'; // Ensure AnalyzedTransactionData is imported
import { ImpactAnalysis } from '@/core/calculations/type';
import { calculationService } from '@/core/calculations/impactService';
import { User } from 'firebase/auth';
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
  setDoc
} from 'firebase/firestore';
import { db } from '@/core/firebase/firebase';
import { mergeTransactions } from '@/core/plaid/transactionMapper';
// Assuming you have this service or similar logic from your analysis API
import { analyzeTransactionsCore, processAnalyzedTransactions } from '@/features/analysis/transactionAnalysisService'; // Adjust import path if needed

interface BankConnectionStatus {
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
}

interface CreditState {
  availableCredit: number;
  appliedCredit: number;
  lastAppliedAmount: number;
  lastAppliedAt: Timestamp | null;
}

// REMOVED unused interface: AnalysisResultForSaving

interface TransactionState {
  // Data
  transactions: Transaction[];
  savedTransactions: Transaction[] | null;
  impactAnalysis: ImpactAnalysis | null;
  totalSocietalDebt: number; // Store the effective debt or net debt? Let's assume effective for display

  // Bank Connection State
  connectionStatus: BankConnectionStatus;

  // Credit State
  creditState: CreditState;

  // Loading States
  isAnalyzing: boolean;
  isSaving: boolean;
  isApplyingCredit: boolean;
  hasSavedData: boolean;

  // Actions
  setTransactions: (transactions: Transaction[]) => void;
  connectBank: (publicToken: string, user: User | null) => Promise<void>;
  disconnectBank: () => void;
  fetchTransactions: (accessToken?: string) => Promise<void>;
  manuallyFetchTransactions: () => Promise<void>;
  // Update return type here
  analyzeTransactions: (transactions: Transaction[]) => Promise<AnalyzedTransactionData>; // <-- Return full analysis object
  // Update signature here
  saveTransactions: (transactions: Transaction[], totalNegativeDebt: number, userId?: string) => Promise<void>; // <-- Expecting negative debt
  applyCredit: (amount: number, userId?: string) => Promise<boolean>;
  loadLatestTransactions: (userId: string) => Promise<boolean>;
  loadCreditState: (userId: string) => Promise<CreditState | null>;
  resetState: () => void;
  initializeStore: (user: User | null) => Promise<void>;
}

export const useTransactionStore = create<TransactionState>((set, get) => ({
  // Initial state
  transactions: [],
  savedTransactions: null,
  impactAnalysis: null,
  totalSocietalDebt: 0, // Represents effective debt shown in UI

  connectionStatus: {
    isConnected: false,
    isLoading: false,
    error: null,
  },

  creditState: {
    availableCredit: 0,
    appliedCredit: 0,
    lastAppliedAmount: 0,
    lastAppliedAt: null,
  },

  isAnalyzing: false,
  isSaving: false,
  isApplyingCredit: false,
  hasSavedData: false,

  // Actions
  setTransactions: (transactions) => {
    set({ transactions }); // Set raw transactions first

    // Recalculate impact analysis based on current credit state
    const currentAppliedCredit = get().creditState.appliedCredit;
    const analysis = calculationService.calculateImpactAnalysis(transactions, currentAppliedCredit);

    set({
      impactAnalysis: analysis,
      totalSocietalDebt: analysis.effectiveDebt // Update displayed debt
    });
  },

  connectBank: async (publicToken, user) => {
    if (!user) return;

    const state = get();
    if (state.connectionStatus.isLoading) return;

    set(state => ({
      connectionStatus: { ...state.connectionStatus, isLoading: true, error: null }
    }));

    try {
      const response = await fetch("/api/banking/exchange_token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_token: publicToken }),
      });
      const data = await response.json();
      if (!response.ok || !data.access_token) throw new Error(data.error || "Failed to exchange token");

      const tokenInfo = { token: data.access_token, userId: user.uid, timestamp: Date.now() };
      localStorage.setItem("plaid_access_token_info", JSON.stringify(tokenInfo));

      set(state => ({
        connectionStatus: { ...state.connectionStatus, isConnected: true, isLoading: false }
      }));

      // Fetch transactions triggers analysis and saving internally
      await get().fetchTransactions(data.access_token);

    } catch (error) {
      console.error("Error connecting bank:", error);
      set(state => ({
        connectionStatus: { ...state.connectionStatus, isConnected: false, isLoading: false, error: error instanceof Error ? error.message : "Failed to connect bank" }
      }));
    }
  },

  disconnectBank: () => {
    localStorage.removeItem("plaid_access_token_info");
    // Consider clearing other plaid related items if necessary
    // localStorage.removeItem("plaid_token");
    // localStorage.removeItem("plaid_access_token");
    try {
      sessionStorage.setItem('wasManuallyDisconnected', 'true');
    } catch (e) { console.warn('Error setting manual disconnect flag:', e); }

    // Reset relevant parts of the state
    set({
      transactions: [],
      savedTransactions: null,
      impactAnalysis: null,
      totalSocietalDebt: 0,
      connectionStatus: { isConnected: false, isLoading: false, error: null },
      // Optionally reset credit state or keep it? Resetting seems safer.
      creditState: { availableCredit: 0, appliedCredit: 0, lastAppliedAmount: 0, lastAppliedAt: null },
      hasSavedData: false,
    });
  },

  fetchTransactions: async (accessToken) => {
    const { connectionStatus } = get();
    if (connectionStatus.isLoading) return;

    set(state => ({ connectionStatus: { ...state.connectionStatus, isLoading: true, error: null } }));

    try {
      let token = accessToken;
      if (!token) {
          const storedData = localStorage.getItem("plaid_access_token_info");
          if (!storedData) throw new Error("No access token available");
          token = JSON.parse(storedData).token;
      }

      const response = await fetch("/api/banking/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: token }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})); // Try to parse error details
        throw new Error(`Failed to fetch transactions: ${response.status} ${errorData.details || ''}`);
      }

      const rawTransactions = await response.json(); // Assume this returns raw Plaid transactions

      if (!Array.isArray(rawTransactions)) {
           throw new Error("Invalid transaction data format received");
      }

      // Map Plaid transactions to your internal format if needed here
      // For now, assuming rawTransactions are in your Transaction format or handled by analysis
      const transactionsToAnalyze = rawTransactions as Transaction[]; // Adjust mapping if necessary

       set(state => ({
           connectionStatus: {
               ...state.connectionStatus,
               isConnected: true, // Mark as connected even if analysis/saving fails later
               isLoading: false, // Stop loading indicator for fetch phase
               error: transactionsToAnalyze.length === 0 ? "Connected, but no transactions found" : null,
           }
       }));


      // Analyze the fetched transactions
      // analyzeTransactions internally updates state (transactions, impactAnalysis, totalSocietalDebt)
      const analysisResult = await get().analyzeTransactions(transactionsToAnalyze);

      // Save the analyzed transactions using the result from analyzeTransactions
      try {
        const storedData = localStorage.getItem("plaid_access_token_info");
        if (storedData) {
          const tokenInfo = JSON.parse(storedData);
          if (tokenInfo.userId) {
             // Pass the NEGATIVE impact component to saveTransactions
            await get().saveTransactions(analysisResult.transactions, analysisResult.totalNegativeImpact, tokenInfo.userId);
          }
        }
      } catch (saveError) {
        console.error("Error saving transactions after fetch:", saveError);
        // Optionally set an error state specifically for saving failure
        set(state => ({ connectionStatus: { ...state.connectionStatus, error: 'Failed to save transactions' } }));
      }

    } catch (error) {
      console.error("Error fetching/processing transactions:", error);
      set(state => ({
        connectionStatus: { ...state.connectionStatus, isLoading: false, error: error instanceof Error ? error.message : "Failed to load transactions" }
      }));
    }
  },

  manuallyFetchTransactions: async () => {
    try {
      const storedData = localStorage.getItem("plaid_access_token_info");
      if (!storedData) throw new Error("No stored access token found");
      const tokenInfo = JSON.parse(storedData);
      await get().fetchTransactions(tokenInfo.token);
    } catch (error) {
      console.error("Manual fetch error:", error);
      throw error; // Re-throw for handling in component
    }
  },

  // Updated analyzeTransactions
  analyzeTransactions: async (transactions): Promise<AnalyzedTransactionData> => {
    if (!transactions || transactions.length === 0 || get().isAnalyzing) {
      // If no transactions or already analyzing, return a default/empty analysis based on input
        const currentAppliedCredit = get().creditState.appliedCredit;
        const currentAnalysis = calculationService.calculateImpactAnalysis(transactions, currentAppliedCredit);
      return {
          transactions: transactions, // Return original transactions
          totalPositiveImpact: currentAnalysis.positiveImpact,
          totalNegativeImpact: currentAnalysis.negativeImpact,
          totalSocietalDebt: currentAnalysis.negativeImpact, // Return negative impact here as per type? Or net? Let's stick to negative.
          debtPercentage: currentAnalysis.debtPercentage,
      };
    }

    set({ isAnalyzing: true });

    try {
        // Use the core analysis logic (which might call OpenAI API)
        // analyzeTransactionsCore should return the full AnalyzedTransactionData object
        const analysisResult = await analyzeTransactionsCore(transactions); // Assume this calls your API / OpenAI

        // Merge results if necessary (if core logic doesn't handle merging)
        const { savedTransactions } = get();
        const finalTransactions = savedTransactions
          ? mergeTransactions(savedTransactions, analysisResult.transactions)
          : analysisResult.transactions;

        // Process the final merged transactions to get the complete analysis data needed
        const finalProcessedData = processAnalyzedTransactions(finalTransactions);


        // Recalculate the UI-facing impact analysis using the final transactions and current credit state
        const currentAppliedCredit = get().creditState.appliedCredit;
        const uiImpactAnalysis = calculationService.calculateImpactAnalysis(finalProcessedData.transactions, currentAppliedCredit);

        // Update the store state
        set({
          transactions: finalProcessedData.transactions, // Update transactions with analyzed data
          impactAnalysis: uiImpactAnalysis, // Update the detailed impact analysis for UI
          totalSocietalDebt: uiImpactAnalysis.effectiveDebt, // Update effective debt for display
          isAnalyzing: false
        });

        // Return the specific structure needed by handleLoadSampleData (if that's the primary consumer)
        // or the more general AnalyzedTransactionData
         return {
            transactions: finalProcessedData.transactions,
            totalPositiveImpact: finalProcessedData.totalPositiveImpact,
            totalNegativeImpact: finalProcessedData.totalNegativeImpact,
            totalSocietalDebt: finalProcessedData.totalSocietalDebt, // Return the negative impact component
            debtPercentage: finalProcessedData.debtPercentage
        };

    } catch (error) {
      console.error('Error analyzing transactions:', error);
      set(state => ({
        isAnalyzing: false,
        connectionStatus: { ...state.connectionStatus, error: error instanceof Error ? error.message : 'Failed to analyze transactions' }
      }));
      // Rethrow or return an error structure if needed by caller
       throw error; // Propagate the error
    }
  },


  // Updated saveTransactions signature
  saveTransactions: async (transactions, totalNegativeDebt, userId) => {
    const state = get();
    if (state.isSaving) return;

    const currentUserId = userId || (() => {
        try {
            const storedData = localStorage.getItem("plaid_access_token_info");
            if (!storedData) return null;
            return JSON.parse(storedData).userId;
        } catch { return null; }
    })();

    if (!currentUserId) {
      console.error("Cannot save transactions: no user ID available");
      return;
    }

    set({ isSaving: true });

    try {
      // Calculate debt percentage using the provided negative debt
      const totalSpent = transactions.reduce((sum, tx) => sum + tx.amount, 0);
      const debtPercentage = totalSpent > 0 ? (totalNegativeDebt / totalSpent) * 100 : 0;

      const batch = {
        userId: currentUserId,
        transactions,
        totalSocietalDebt: totalNegativeDebt, // Save the negative debt component
        debtPercentage,
        createdAt: Timestamp.now(),
      };

      await addDoc(collection(db, "transactionBatches"), batch);

      // Update local state
      set({
        savedTransactions: transactions, // Keep track of what was last saved
        // Don't update totalSocietalDebt here, it reflects effective debt
        hasSavedData: true,
        isSaving: false
      });
    } catch (error) {
      console.error('Error saving transactions:', error);
      set(state => ({
        isSaving: false,
        connectionStatus: { ...state.connectionStatus, error: 'Failed to save transactions' }
      }));
    }
  },

  applyCredit: async (amount, userId) => {
    const { impactAnalysis, creditState, isApplyingCredit } = get();
    if (isApplyingCredit || !impactAnalysis || amount <= 0) return false;

    const currentUserId = userId || (() => {
         try {
            const storedData = localStorage.getItem("plaid_access_token_info");
            if (!storedData) return null;
            return JSON.parse(storedData).userId;
        } catch { return null; }
    })();
    if (!currentUserId) { console.error("Cannot apply credit: no user ID available"); return false; }

    set({ isApplyingCredit: true });

    try {
      // Calculate credit to apply based on current state
      const available = impactAnalysis.availableCredit; // Use calculated available credit
      const currentDebt = impactAnalysis.effectiveDebt; // Use current effective debt
      const creditToApply = Math.min(amount, available, currentDebt); // Can't apply more than available or needed

      if (creditToApply <= 0) {
        set({ isApplyingCredit: false });
        console.log("No credit to apply or no debt to offset.");
        return false;
      }

      // Update credit state object optimistically
      const updatedCreditState: CreditState = {
        availableCredit: available - creditToApply, // Decrease available
        appliedCredit: creditState.appliedCredit + creditToApply, // Increase applied
        lastAppliedAmount: creditToApply,
        lastAppliedAt: Timestamp.now(),
      };

      // Update Firestore
      const creditDocRef = doc(db, "creditState", currentUserId);
      await setDoc(creditDocRef, updatedCreditState, { merge: true }); // Use merge to be safe

      // Update local store state
      set({
        creditState: updatedCreditState,
        isApplyingCredit: false
      });

      // IMPORTANT: Re-calculate impact analysis based on the *new* credit state
       const newAnalysis = calculationService.calculateImpactAnalysis(get().transactions, updatedCreditState.appliedCredit);
       set({ impactAnalysis: newAnalysis, totalSocietalDebt: newAnalysis.effectiveDebt });

      console.log(`Applied $${creditToApply.toFixed(2)} credit.`);
      return true;
    } catch (error) {
      console.error("Error applying credit:", error);
      set({ isApplyingCredit: false });
      return false;
    }
  },

  loadLatestTransactions: async (userId) => {
     if (!userId) return false;

     // Check session storage flag first
     const wasManuallyDisconnected = (() => {
       try { return sessionStorage.getItem('wasManuallyDisconnected') === 'true'; }
       catch { return false; }
     })();
     if (wasManuallyDisconnected) {
       console.log("Skipping loadLatestTransactions: User manually disconnected.");
       return false;
     }


    set(state => ({ connectionStatus: { ...state.connectionStatus, isLoading: true } }));

    try {
      const q = query(
        collection(db, 'transactionBatches'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(1)
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        set(state => ({ connectionStatus: { ...state.connectionStatus, isLoading: false } }));
        return false; // No saved data found
      }

      const doc = querySnapshot.docs[0];
      const data = doc.data();
      const loadedTransactions = data.transactions as Transaction[];

      // Load credit state *before* calculating initial impact
       const loadedCreditState = await get().loadCreditState(userId);
       const initialAppliedCredit = loadedCreditState?.appliedCredit ?? 0;

      // Calculate impact analysis based on loaded transactions and credit state
      const analysis = calculationService.calculateImpactAnalysis(loadedTransactions, initialAppliedCredit);

      // Update state with loaded data and calculated analysis
      set({
        transactions: loadedTransactions,
        savedTransactions: loadedTransactions, // Mark these as saved
        impactAnalysis: analysis,
        totalSocietalDebt: analysis.effectiveDebt, // Set initial effective debt
        hasSavedData: true,
        connectionStatus: { isConnected: true, isLoading: false, error: null } // Assume connected if data loaded
        // Credit state is already set by loadCreditState
      });

      // Optionally re-analyze if needed (e.g., if analysis format changed)
      // const needsReAnalysis = loadedTransactions.some((tx: Transaction) => !tx.analyzed);
      // if (needsReAnalysis) {
      //    await get().analyzeTransactions(loadedTransactions); // This will recalculate and update state again
      // }

      return true;
    } catch (error) {
      console.error('❌ loadLatestTransactions: Error:', error);
      set(state => ({ connectionStatus: { ...state.connectionStatus, isLoading: false, error: 'Failed to load saved transactions' } }));
      return false;
    }
  },

  loadCreditState: async (userId) => {
    if (!userId) return null;

    try {
      const creditDocRef = doc(db, "creditState", userId);
      const docSnap = await getDoc(creditDocRef);
      let loadedCreditState: CreditState;

      if (docSnap.exists()) {
        const data = docSnap.data();
        loadedCreditState = {
          availableCredit: typeof data.availableCredit === "number" ? data.availableCredit : 0, // This might be recalculated based on transactions
          appliedCredit: typeof data.appliedCredit === "number" ? data.appliedCredit : 0,
          lastAppliedAmount: typeof data.lastAppliedAmount === "number" ? data.lastAppliedAmount : 0,
          lastAppliedAt: data.lastAppliedAt instanceof Timestamp ? data.lastAppliedAt : null,
        };
         console.log("Loaded credit state from Firestore:", loadedCreditState);
      } else {
        // Initialize new credit state if none exists
        console.log("No credit state found in Firestore, initializing.");
        const initialPositiveImpact = calculationService.calculatePositiveImpact(get().transactions); // Base initial available on current transactions
        loadedCreditState = {
          availableCredit: initialPositiveImpact,
          appliedCredit: 0,
          lastAppliedAmount: 0,
          lastAppliedAt: Timestamp.now(),
        };
        await setDoc(creditDocRef, loadedCreditState);
      }

      // Update the store's credit state
      set({ creditState: loadedCreditState });

      // Re-calculate impact analysis based on the potentially updated credit state
      // Avoids stale calculations if loadCreditState is called after transactions are set
      const currentTransactions = get().transactions;
       if (currentTransactions.length > 0) {
           const analysis = calculationService.calculateImpactAnalysis(currentTransactions, loadedCreditState.appliedCredit);
           set({ impactAnalysis: analysis, totalSocietalDebt: analysis.effectiveDebt });
       }


      return loadedCreditState;
    } catch (error) {
      console.error("Error loading/initializing credit state:", error);
       // Optionally set an error state
      return null;
    }
  },


  resetState: () => {
    set({
      transactions: [],
      savedTransactions: null,
      impactAnalysis: null,
      totalSocietalDebt: 0,
      connectionStatus: { isConnected: false, isLoading: false, error: null },
      creditState: { availableCredit: 0, appliedCredit: 0, lastAppliedAmount: 0, lastAppliedAt: null },
      isAnalyzing: false,
      isSaving: false,
      isApplyingCredit: false,
      hasSavedData: false,
    });
     // Also clear the disconnect flag on reset
     try { sessionStorage.removeItem('wasManuallyDisconnected'); } catch {}
     console.log("Store state reset.");
  },

  initializeStore: async (user: User | null) => {
    if (!user) {
        get().resetState(); // Reset if user logs out
        return;
    }

    const state = get();
    // Avoid re-initialization if already loading or has data and connection is ok
    if (state.connectionStatus.isLoading || (state.transactions.length > 0 && state.connectionStatus.isConnected && !state.connectionStatus.error)) {
       console.log("Skipping initialization: Already loading or initialized.");
      return;
    }

     // Check manual disconnect flag
     const wasManuallyDisconnected = (() => {
       try { return sessionStorage.getItem('wasManuallyDisconnected') === 'true'; }
       catch { return false; }
     })();
     if (wasManuallyDisconnected) {
       console.log("Skipping initialization: User manually disconnected.");
       // Ensure UI reflects disconnected state without resetting everything if they just logged in
        set({ connectionStatus: { isConnected: false, isLoading: false, error: "User manually disconnected." } });
       return;
     }


    set(state => ({ connectionStatus: { ...state.connectionStatus, isLoading: true, error: null } }));

    try {
      // 1. Try loading the latest saved data from Firebase first.
      // loadLatestTransactions now also loads credit state and calculates initial impact.
      const loadedFromFirebase = await get().loadLatestTransactions(user.uid);
      console.log("Initialize: Loaded from Firebase:", loadedFromFirebase);

       // 2. If nothing was loaded from Firebase, check for a Plaid token.
      if (!loadedFromFirebase) {
        const storedData = localStorage.getItem("plaid_access_token_info");
        if (storedData) {
          const tokenInfo = JSON.parse(storedData);
          if (tokenInfo.userId === user.uid) {
            console.log("Initialize: Found valid Plaid token, fetching fresh transactions...");
            // Fetch fresh transactions - this will analyze and save automatically.
            // It also sets connectionStatus internally.
            await get().fetchTransactions(tokenInfo.token);
          } else {
            // Token for different user, clear it
             console.log("Initialize: Stale Plaid token found, clearing.");
            localStorage.removeItem("plaid_access_token_info");
             set(state => ({ connectionStatus: { ...state.connectionStatus, isLoading: false } })); // Stop loading
          }
        } else {
          // No Firebase data and no Plaid token. User needs to connect.
          console.log("Initialize: No saved data or token found.");
          set(state => ({ connectionStatus: { ...state.connectionStatus, isConnected: false, isLoading: false } })); // Ensure disconnected state
        }
      }
       // If data *was* loaded from Firebase, we're done initializing.
       // fetchTransactions was NOT called, connectionStatus was set by loadLatestTransactions.

    } catch (error) {
      console.error("❌ initializeStore: Error during initialization:", error);
      set(state => ({
        connectionStatus: { ...state.connectionStatus, isLoading: false, error: error instanceof Error ? error.message : "Failed to initialize store" }
      }));
    } finally {
       // Ensure loading is always set to false eventually, unless fetchTransactions sets it again.
       // We rely on the internal state management of loadLatest/fetchTransactions now.
    }
  },
}));