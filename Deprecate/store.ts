// // src/store/transactionStore.ts
// import { create } from 'zustand';
// import { Transaction, AnalyzedTransactionData } from '@/shared/types/transactions';

// interface TransactionState {
//   // Original transactions from bank
//   bankTransactions: Transaction[];
//   // Analyzed transactions with ethical impact
//   analyzedTransactions: Transaction[];
//   // Analysis summary data
//   analysisData: AnalyzedTransactionData | null;
//   // Loading states
//   isBankConnecting: boolean;
//   isAnalyzing: boolean;
//   // Error states
//   bankError: string | null;
//   analysisError: string | null;
  
//   // Actions
//   setBankTransactions: (transactions: Transaction[]) => void;
//   setAnalyzedTransactions: (transactions: Transaction[]) => void;
//   setAnalysisData: (data: AnalyzedTransactionData | null) => void;
//   setBankConnecting: (isConnecting: boolean) => void;
//   setAnalyzing: (isAnalyzing: boolean) => void;
//   setBankError: (error: string | null) => void;
//   setAnalysisError: (error: string | null) => void;
  
//   // Complex actions (these will use the simpler actions internally)
//   connectToBank: (publicToken: string) => Promise<void>;
//   analyzeTransactions: () => Promise<void>;
//   resetState: () => void;
// }

// export const useTransactionStore = create<TransactionState>((set, get) => ({
//   // State
//   bankTransactions: [],
//   analyzedTransactions: [],
//   analysisData: null,
//   isBankConnecting: false,
//   isAnalyzing: false,
//   bankError: null,
//   analysisError: null,
  
//   // Simple actions
//   setBankTransactions: (transactions) => set({ bankTransactions: transactions }),
//   setAnalyzedTransactions: (transactions) => set({ analyzedTransactions: transactions }),
//   setAnalysisData: (data) => set({ analysisData: data }),
//   setBankConnecting: (isBankConnecting) => set({ isBankConnecting }),
//   setAnalyzing: (isAnalyzing) => set({ isAnalyzing }),
//   setBankError: (error) => set({ bankError: error }),
//   setAnalysisError: (error) => set({ analysisError: error }),
  
//   // Complex actions
//   connectToBank: async (publicToken) => {
//     const { setBankConnecting, setBankTransactions, setBankError } = get();
    
//     setBankConnecting(true);
//     setBankError(null);
    
//     try {
//       // Exchange token
//       const tokenResponse = await fetch('/api/banking/exchange_token', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ public_token: publicToken }),
//       });
      
//       if (!tokenResponse.ok) {
//         throw new Error(`Token exchange failed: ${tokenResponse.status}`);
//       }
      
//       const { access_token } = await tokenResponse.json();
      
//       // Get transactions
//       const txResponse = await fetch('/api/banking/transactions', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ access_token }),
//       });
      
//       if (!txResponse.ok) {
//         throw new Error(`Transaction fetch failed: ${txResponse.status}`);
//       }
      
//       const transactions = await txResponse.json();
//       setBankTransactions(transactions);
      
//       // Store token in localStorage for later use
//       localStorage.setItem('plaid_access_token_info', JSON.stringify({
//         token: access_token,
//         userId: 'current-user', // This should come from auth context
//         timestamp: Date.now()
//       }));
      
//     } catch (error) {
//       setBankError(error instanceof Error ? error.message : 'Unknown error connecting to bank');
//     } finally {
//       setBankConnecting(false);
//     }
//   },
  
//   analyzeTransactions: async () => {
//     const { 
//       bankTransactions, 
//       setAnalyzing, 
//       setAnalyzedTransactions,
//       setAnalysisData,
//       setAnalysisError 
//     } = get();
    
//     if (!bankTransactions.length) {
//       setAnalysisError('No transactions to analyze');
//       return;
//     }
    
//     setAnalyzing(true);
//     setAnalysisError(null);
    
//     try {
//       const response = await fetch('/api/analysis', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ transactions: bankTransactions }),
//       });
      
//       if (!response.ok) {
//         throw new Error(`Analysis failed: ${response.status}`);
//       }
      
//       const analysisData = await response.json();
//       setAnalyzedTransactions(analysisData.transactions);
//       setAnalysisData(analysisData);
      
//     } catch (error) {
//       setAnalysisError(error instanceof Error ? error.message : 'Unknown error analyzing transactions');
//     } finally {
//       setAnalyzing(false);
//     }
//   },
  
//   resetState: () => set({
//     bankTransactions: [],
//     analyzedTransactions: [],
//     analysisData: null,
//     isBankConnecting: false,
//     isAnalyzing: false,
//     bankError: null,
//     analysisError: null,
//   }),
// }));