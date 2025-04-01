// src/store/transactionStore.ts
import { create } from 'zustand';
import { Transaction } from '@/shared/types/transactions';
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

interface TransactionState {
  // Data
  transactions: Transaction[];
  savedTransactions: Transaction[] | null;
  impactAnalysis: ImpactAnalysis | null;
  totalSocietalDebt: number;
  
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
  fetchTransactions: (accessToken?: string, mergeWithExisting?: boolean) => Promise<void>;
  manuallyFetchTransactions: () => Promise<void>;
  analyzeTransactions: (transactions: Transaction[]) => Promise<Transaction[]>;
  saveTransactions: (transactions: Transaction[], totalDebt: number, userId?: string) => Promise<void>;
  applyCredit: (amount: number, userId?: string) => Promise<boolean>;
  loadLatestTransactions: (userId: string) => Promise<{ success: boolean; batchTimestamp?: Timestamp | null }>;
  loadCreditState: (userId: string) => Promise<CreditState | null>;
  resetState: () => void;
  initializeStore: (user: User | null) => Promise<void>;
}

export const useTransactionStore = create<TransactionState>((set, get) => ({
  // Initial state
  transactions: [],
  savedTransactions: null,
  impactAnalysis: null,
  totalSocietalDebt: 0,
  
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
    set({ transactions });
    
    // Calculate impact analysis
    const analysis = calculationService.calculateImpactAnalysis(transactions);
    set({ 
      impactAnalysis: analysis,
      totalSocietalDebt: analysis.netSocietalDebt 
    });
  },
  
  connectBank: async (publicToken, user) => {
    if (!user) return;
    
    const state = get();
    if (state.connectionStatus.isLoading) return; // Prevent multiple simultaneous connections
    
    set(state => ({
      connectionStatus: {
        ...state.connectionStatus,
        isLoading: true,
        error: null,
      }
    }));
    
    try {
      // Exchange public token for access token
      const response = await fetch("/api/banking/exchange_token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_token: publicToken }),
      });
      
      const data = await response.json();
      
      if (!response.ok || !data.access_token) {
        throw new Error(data.error || "Failed to exchange token");
      }
      
      // Store token in localStorage
      const tokenInfo = {
        token: data.access_token,
        userId: user.uid,
        timestamp: Date.now(),
      };
      
      localStorage.setItem("plaid_access_token_info", JSON.stringify(tokenInfo));
      
      // Update connection status
      set(state => ({
        connectionStatus: {
          ...state.connectionStatus,
          isConnected: true,
          isLoading: false,
        }
      }));
      
      // Fetch transactions with the new token
      await get().fetchTransactions(data.access_token);
      
    } catch (error) {
      console.error("Error connecting bank:", error);
      
      set(state => ({
        connectionStatus: {
          ...state.connectionStatus,
          isConnected: false,
          isLoading: false,
          error: error instanceof Error ? error.message : "Failed to connect bank",
        }
      }));
    }
  },
  
  disconnectBank: () => {
    // Clear token from localStorage
    localStorage.removeItem("plaid_access_token_info");
    localStorage.removeItem("plaid_token");
    localStorage.removeItem("plaid_access_token");
    
    // Set manual disconnect flag
    try {
      sessionStorage.setItem('wasManuallyDisconnected', 'true');
    } catch (e) {
      console.warn('Error setting manual disconnect flag:', e);
    }
    
    set({
      transactions: [],
      connectionStatus: {
        isConnected: false,
        isLoading: false,
        error: null,
      }
    });
  },
  
  fetchTransactions: async (accessToken, mergeWithExisting = false) => {
    const { connectionStatus, transactions: currentTransactions } = get();
    
    // Don't fetch if already loading
    if (connectionStatus.isLoading) return;
    
    set(state => ({
      connectionStatus: {
        ...state.connectionStatus,
        isLoading: true,
        error: null,
      }
    }));
    
    try {
      // If no access token provided, try to get it from storage
      let token = accessToken;
      if (!token) {
        try {
          const storedData = localStorage.getItem("plaid_access_token_info");
          if (!storedData) {
            throw new Error("No access token available");
          }
          
          const tokenInfo = JSON.parse(storedData);
          token = tokenInfo.token;
        } catch (error) {
          console.error("Error retrieving access token:", error);
          throw new Error("Failed to retrieve access token");
        }
      }
      
      // Fetch transactions from API
      const response = await fetch("/api/banking/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: token }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch transactions: ${response.status}`);
      }
      
      const fetchedData = await response.json();
      
      if (Array.isArray(fetchedData)) {
        let finalTransactions = fetchedData;
        if (mergeWithExisting) {
          console.log("🔄 fetchTransactions: Merging fetched transactions with existing ones.");
          finalTransactions = mergeTransactions(currentTransactions, fetchedData);
        }

        // Update state with transactions
        set({
          transactions: finalTransactions,
          connectionStatus: {
            isConnected: true,
            isLoading: false,
            error: finalTransactions.length === 0 ? "Connected, but no transactions were found" : null,
          }
        });
        
        // Analyze the transactions and get the result
        const analyzedTransactionsResult = await get().analyzeTransactions(finalTransactions);
        
        // Use the returned analyzed transactions for saving
        const currentTotalDebt = get().totalSocietalDebt;

        // Save the ANALYZED transactions to Firestore if we have a user ID
        try {
          const storedData = localStorage.getItem("plaid_access_token_info");
          if (storedData) {
            const tokenInfo = JSON.parse(storedData);
            if (tokenInfo.userId) {
              await get().saveTransactions(analyzedTransactionsResult, currentTotalDebt, tokenInfo.userId);
            }
          }
        } catch (error) {
          console.error("Error saving transactions:", error);
        }
      } else if (fetchedData.error) {
        throw new Error(fetchedData.error);
      } else {
        throw new Error("Invalid response format");
      }
    } catch (error) {
      console.error("Error fetching transactions:", error);
      
      set(state => ({
        connectionStatus: {
          ...state.connectionStatus,
          isLoading: false,
          error: error instanceof Error ? error.message : "Failed to load transactions",
        }
      }));
    }
  },
  
  manuallyFetchTransactions: async () => {
    try {
      const storedData = localStorage.getItem("plaid_access_token_info");
      
      if (!storedData) {
        throw new Error("No stored access token found");
      }
      
      const tokenInfo = JSON.parse(storedData);
      // Always merge when manually fetching
      console.log("🔄 manuallyFetchTransactions: Fetching and merging latest transactions...");
      await get().fetchTransactions(tokenInfo.token, true);
      
      return; // Success
    } catch (error) {
      console.error("Manual fetch error:", error);
      throw error; // Re-throw for handling in component
    }
  },
  
  analyzeTransactions: async (transactions): Promise<Transaction[]> => {
    if (!transactions.length || get().isAnalyzing) {
      return transactions;
    }
    
    set({ isAnalyzing: true });
    
    let finalTransactions = transactions;

    try {
      // Skip any transactions that are already analyzed
      const transactionsToAnalyze = transactions.filter(tx => !tx.analyzed);
      
      if (transactionsToAnalyze.length === 0) {
        // If all transactions are already analyzed, just calculate totals
        const analysis = calculationService.calculateImpactAnalysis(transactions);
        set({ 
          transactions,
          impactAnalysis: analysis,
          totalSocietalDebt: analysis.netSocietalDebt,
          isAnalyzing: false 
        });
      } else {
        // Only call OpenAI if we have transactions that need analysis
        
        // Call the analysis API
        const response = await fetch("/api/analysis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transactions: transactionsToAnalyze }),
        });
        
        if (!response.ok) {
          throw new Error(`Analysis API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Process the analyzed transactions
        const { savedTransactions } = get();
        const mergedTransactions = savedTransactions 
          ? mergeTransactions(savedTransactions, data.transactions) 
          : data.transactions; 
        
        // Update state with analyzed data
        const analysis = calculationService.calculateImpactAnalysis(mergedTransactions);
        
        set({ 
          transactions: mergedTransactions,
          impactAnalysis: analysis,
          totalSocietalDebt: data.totalSocietalDebt,
          isAnalyzing: false
        });
        
        finalTransactions = mergedTransactions;
      }
    } catch (error) {
      console.error('Error analyzing transactions:', error);
      
      set(state => ({
        isAnalyzing: false,
        connectionStatus: {
          ...state.connectionStatus,
          error: error instanceof Error ? error.message : 'Failed to analyze transactions'
        }
      }));
    }
    
    return finalTransactions;
  },
  
  saveTransactions: async (transactions, totalDebt, userId) => {
    const state = get();
    if (state.isSaving) return;
    
    // Use provided userId or try to get from stored token
    const currentUserId = userId || (() => {
      try {
        const storedData = localStorage.getItem("plaid_access_token_info");
        if (!storedData) return null;
        
        const tokenInfo = JSON.parse(storedData);
        return tokenInfo.userId;
      } catch {
        return null;
      }
    })();
    
    if (!currentUserId) {
      console.error("Cannot save transactions: no user ID available");
      return;
    }
    
    set({ isSaving: true });
    
    try {
      // Calculate debt percentage
      const totalSpent = transactions.reduce((sum, tx) => sum + tx.amount, 0);
      const debtPercentage = totalSpent > 0 ? (totalDebt / totalSpent) * 100 : 0;
      
      // Create batch document
      const batch = {
        userId: currentUserId,
        transactions,
        totalSocietalDebt: totalDebt,
        debtPercentage,
        createdAt: Timestamp.now(),
      };
      
      // Add to Firestore
      await addDoc(collection(db, "transactionBatches"), batch);
      
      // Update local state
      set({
        savedTransactions: transactions,
        totalSocietalDebt: totalDebt,
        hasSavedData: true,
        isSaving: false
      });
    } catch (error) {
      console.error('Error saving transactions:', error);
      
      set(state => ({
        isSaving: false,
        connectionStatus: {
          ...state.connectionStatus,
          error: 'Failed to save transactions'
        }
      }));
    }
  },
  
  applyCredit: async (amount, userId) => {
    const { impactAnalysis, creditState, isApplyingCredit } = get();
    
    if (isApplyingCredit || !impactAnalysis) return false;
    
    // Use provided userId or try to get from stored token
    const currentUserId = userId || (() => {
      try {
        const storedData = localStorage.getItem("plaid_access_token_info");
        if (!storedData) return null;
        
        const tokenInfo = JSON.parse(storedData);
        return tokenInfo.userId;
      } catch {
        return null;
      }
    })();
    
    if (!currentUserId) {
      console.error("Cannot apply credit: no user ID available");
      return false;
    }
    
    set({ isApplyingCredit: true });
    
    try {
      // Calculate how much credit we can actually apply
      const totalDebt = impactAnalysis.negativeImpact;
      const availableCredit = impactAnalysis.availableCredit;
      const creditToApply = Math.min(amount, totalDebt, availableCredit);
      
      if (creditToApply <= 0) {
        set({ isApplyingCredit: false });
        return false;
      }
      
      // Calculate remaining credit after application
      const remainingCredit = availableCredit - creditToApply;
      
      // Update credit state
      const updatedCreditState = {
        availableCredit: remainingCredit,
        appliedCredit: creditState.appliedCredit + creditToApply,
        lastAppliedAmount: creditToApply,
        lastAppliedAt: Timestamp.now(),
      };
      
      // Update Firestore
      const creditDocRef = doc(db, "creditState", currentUserId);
      await setDoc(creditDocRef, updatedCreditState);
      
      // Update local state
      set({
        creditState: updatedCreditState,
        isApplyingCredit: false
      });
      
      // Update impact analysis to reflect the applied credit
      const newAnalysis = { 
        ...impactAnalysis,
        appliedCredit: updatedCreditState.appliedCredit,
        availableCredit: updatedCreditState.availableCredit,
        effectiveDebt: Math.max(0, impactAnalysis.negativeImpact - updatedCreditState.appliedCredit)
      };
      
      set({ impactAnalysis: newAnalysis });
      
      return true;
    } catch (error) {
      console.error("Error applying credit:", error);
      
      set({ isApplyingCredit: false });
      return false;
    }
  },
  
  loadLatestTransactions: async (userId): Promise<{ success: boolean; batchTimestamp?: Timestamp | null }> => {
    if (!userId) {
      // console.log("🚫 loadLatestTransactions: No user ID provided");
      return { success: false, batchTimestamp: null };
    }
    
    // console.log("🔄 loadLatestTransactions: Starting load for user:", userId);
    
    set(state => ({
      connectionStatus: {
        ...state.connectionStatus,
        isLoading: true
      }
    }));
    
    try {
      // console.log("📥 loadLatestTransactions: Querying Firebase...");
      const q = query(
        collection(db, 'transactionBatches'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(1)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        // console.log('🚫 loadLatestTransactions: No saved transactions found for user:', userId);
        // ... (set loading state) ...
        return { success: false, batchTimestamp: null };
      }
      
      // Get the latest batch
      const doc = querySnapshot.docs[0];
      const data = doc.data();
      const batchTimestamp = data.createdAt instanceof Timestamp ? data.createdAt : null;
      
      // console.log(`✅ loadLatestTransactions: Loaded batch ${doc.id} with ${data.transactions.length} transactions`);
      
      // Update state with saved transactions first
      set({
        transactions: data.transactions,
        savedTransactions: data.transactions,
        totalSocietalDebt: data.totalSocietalDebt,
        hasSavedData: true,
        connectionStatus: {
          isConnected: true,
          isLoading: false,
          error: null
        }
      });
      
      // Check if transactions need analysis
      const needsAnalysis = data.transactions.some((tx: Transaction) => !tx.analyzed);
      
      if (needsAnalysis) {
        await get().analyzeTransactions(data.transactions);
      } else {
        const analysis = calculationService.calculateImpactAnalysis(data.transactions);
        set({ 
          impactAnalysis: analysis,
          totalSocietalDebt: analysis.netSocietalDebt
        });
      }
      
      // Load credit state
      // console.log("💳 loadLatestTransactions: Loading credit state");
      await get().loadCreditState(userId);
      
      return { success: true, batchTimestamp: batchTimestamp }; // Return success and timestamp
    } catch (error) {
      console.error('❌ loadLatestTransactions: Error:', error);
      // ... (set error state) ...
      return { success: false, batchTimestamp: null }; // Return failure
    }
  },
  
  loadCreditState: async (userId) => {
    if (!userId) return null;
    
    try {
      const creditDocRef = doc(db, "creditState", userId);
      const docSnap = await getDoc(creditDocRef);
      
      if (docSnap.exists()) {
        // Found existing credit state
        const data = docSnap.data();
        
        // Ensure we have all required fields
        const creditState: CreditState = {
          availableCredit: typeof data.availableCredit === "number" ? data.availableCredit : 0,
          appliedCredit: typeof data.appliedCredit === "number" ? data.appliedCredit : 0,
          lastAppliedAmount: typeof data.lastAppliedAmount === "number" ? data.lastAppliedAmount : 0,
          lastAppliedAt: data.lastAppliedAt instanceof Timestamp ? data.lastAppliedAt : null,
        };
        
        // Update impact analysis with credit state
        const { impactAnalysis } = get();
        
        if (impactAnalysis) {
          const updatedAnalysis = {
            ...impactAnalysis,
            appliedCredit: creditState.appliedCredit,
            availableCredit: Math.max(0, impactAnalysis.positiveImpact - creditState.appliedCredit),
            effectiveDebt: Math.max(0, impactAnalysis.negativeImpact - creditState.appliedCredit)
          };
          
          set({ 
            creditState,
            impactAnalysis: updatedAnalysis
          });
        } else {
          set({ creditState });
        }
        
        return creditState;
      } else {
        // Initialize new credit state
        const { transactions } = get();
        const totalPositiveImpact = calculationService.calculatePositiveImpact(transactions);
        
        const initialState: CreditState = {
          availableCredit: totalPositiveImpact,
          appliedCredit: 0,
          lastAppliedAmount: 0,
          lastAppliedAt: Timestamp.now(),
        };
        
        await setDoc(creditDocRef, initialState);
        
        // Update impact analysis with credit state
        const { impactAnalysis } = get();
        
        if (impactAnalysis) {
          const updatedAnalysis = {
            ...impactAnalysis,
            appliedCredit: 0,
            availableCredit: totalPositiveImpact,
            effectiveDebt: impactAnalysis.negativeImpact
          };
          
          set({ 
            creditState: initialState,
            impactAnalysis: updatedAnalysis
          });
        } else {
          set({ creditState: initialState });
        }
        
        return initialState;
      }
    } catch (error) {
      console.error("Error loading credit state:", error);
      return null;
    }
  },
  
  resetState: () => {
    set({
      transactions: [],
      savedTransactions: null,
      impactAnalysis: null,
      totalSocietalDebt: 0,
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
    });
  },

  // Add initialization function
  initializeStore: async (user: User | null) => {
    if (!user) {
      return;
    }

    const state = get();
    if (state.connectionStatus.isLoading) {
      return;
    }

    set(state => ({
      connectionStatus: {
        ...state.connectionStatus,
        isLoading: true,
        error: null,
      }
    }));

    try {
      // First try to load saved transactions from Firebase
      const loadResult = await get().loadLatestTransactions(user.uid);
      let shouldFetchFromPlaid = false;
      let mergePlaidData = false;
      const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);

      if (loadResult.success && loadResult.batchTimestamp) {
        // Successfully loaded from Firebase, check timestamp
        if (loadResult.batchTimestamp.toMillis() < twentyFourHoursAgo) {
          console.log("🔄 initializeStore: Firebase data is older than 24 hours, preparing to fetch updates from Plaid.");
          shouldFetchFromPlaid = true;
          mergePlaidData = true; // Merge with existing Firebase data
        } else {
          console.log("✅ initializeStore: Successfully loaded recent transactions from Firebase.");
        }
      } else {
        // Failed to load from Firebase or no data found
        console.log("📥 initializeStore: No recent transactions in Firebase, preparing to fetch from Plaid.");
        shouldFetchFromPlaid = true;
        mergePlaidData = false; // Overwrite with Plaid data
      }
      
      // Fetch from Plaid if needed
      if (shouldFetchFromPlaid) {
        const storedData = localStorage.getItem("plaid_access_token_info");
        if (storedData) {
          const tokenInfo = JSON.parse(storedData);
          
          if (tokenInfo.userId === user.uid) {
            const wasManuallyDisconnected = (() => {
              try {
                return sessionStorage.getItem('wasManuallyDisconnected') === 'true';
              } catch {
                return false;
              }
            })();
            
            if (!wasManuallyDisconnected) {
              console.log(`🔌 initializeStore: Fetching from Plaid (merge=${mergePlaidData})...`);
              set(state => ({ // Ensure loading state is still true if Firebase load finished quickly
                connectionStatus: { ...state.connectionStatus, isLoading: true }
              }));
              await get().fetchTransactions(tokenInfo.token, mergePlaidData);
            } else {
              console.log("🚫 initializeStore: User manually disconnected, skipping Plaid fetch.");
              // Ensure loading is false if we skipped Plaid after a successful Firebase load
              if (loadResult.success) {
                set(state => ({ connectionStatus: { ...state.connectionStatus, isLoading: false } }));
              }
            }
          } else {
            console.log("🚫 initializeStore: Plaid token belongs to different user, clearing...");
            localStorage.removeItem("plaid_access_token_info");
            // Ensure loading is false if we skipped Plaid after a successful Firebase load
            if (loadResult.success) {
              set(state => ({ connectionStatus: { ...state.connectionStatus, isLoading: false } }));
            }
          }
        } else {
          console.log("🚫 initializeStore: No Plaid token found, cannot fetch updates.");
          // Ensure loading is false if we skipped Plaid after a successful Firebase load
          if (loadResult.success) {
            set(state => ({ connectionStatus: { ...state.connectionStatus, isLoading: false } }));
          }
        }
      }
      
      // Ensure loading state is finally false if no Plaid fetch happened
      // (fetchTransactions handles setting isLoading to false if it runs)
      if (!shouldFetchFromPlaid) {
         set(state => ({ connectionStatus: { ...state.connectionStatus, isLoading: false } }));
      }

    } catch (error) {
      console.error("❌ initializeStore: Error during initialization:", error);
      // ... (error handling, ensure isLoading is false) ...
       set(state => ({ 
         connectionStatus: { 
           ...state.connectionStatus, 
           isLoading: false, 
           error: error instanceof Error ? error.message : "Failed to initialize store" 
         } 
       }));
    }
  },
}));