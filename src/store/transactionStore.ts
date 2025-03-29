// src/store/transactionStore.ts
import { create } from 'zustand';
import { Transaction, AnalyzedTransactionData } from '@/shared/types/transactions';


interface TransactionState {
  // Original transactions from bank
  bankTransactions: Transaction[];
  // Analyzed transactions with ethical impact
  analyzedTransactions: Transaction[];
  // Analysis summary data
  analysisData: AnalyzedTransactionData | null;
  // Loading states
  isBankConnecting: boolean;
  isAnalyzing: boolean;
  // Error states
  bankError: string | null;
  analysisError: string | null;
  
  // Actions
  setBankTransactions: (transactions: Transaction[]) => void;
  setAnalyzedTransactions: (transactions: Transaction[]) => void;
  setAnalysisData: (data: AnalyzedTransactionData | null) => void;
  setBankConnecting: (isConnecting: boolean) => void;
  setAnalyzing: (isAnalyzing: boolean) => void;
  setBankError: (error: string | null) => void;
  setAnalysisError: (error: string | null) => void;
  
  // Complex actions (these will use the simpler actions internally)
  connectToBank: (publicToken: string) => Promise<void>;
  analyzeTransactions: () => Promise<void>;
  resetState: () => void;
}

export const useTransactionStore = create<TransactionState>((set) => ({
    // State
  bankTransactions: [],
  analyzedTransactions: [],
  analysisData: null,
  isBankConnecting: false,
  isAnalyzing: false,
  bankError: null,
  analysisError: null,
  
  // Simple actions
  setBankTransactions: (transactions) => set({ bankTransactions: transactions }),
  setAnalyzedTransactions: (transactions) => set({ analyzedTransactions: transactions }),
  setAnalysisData: (data) => set({ analysisData: data }),
  setBankConnecting: (isBankConnecting) => set({ isBankConnecting }),
  setAnalyzing: (isAnalyzing) => set({ isAnalyzing }),
  setBankError: (error) => set({ bankError: error }),
  setAnalysisError: (error) => set({ analysisError: error }),
  
  // Complex actions
  connectToBank: async () => {
    // REFACTOR: This logic should be handled by the useBankConnection hook.
    // The hook will interact with the API and then call simple store setters
    // (e.g., setBankConnecting, setBankTransactions, setBankError).
    console.warn("connectToBank called on store - refactor to useBankConnection hook.");
    throw new Error("connectToBank logic not implemented in store. Use useBankConnection hook.");
  },
  
  analyzeTransactions: async () => {
    // REFACTOR: This logic should be handled by the useTransactionAnalysis hook.
    // The hook will take bankTransactions from the store state, call the analysis API,
    // and then call simple store setters (e.g., setAnalyzing, setAnalyzedTransactions, setAnalysisData, setAnalysisError).
    console.warn("analyzeTransactions called on store - refactor to useTransactionAnalysis hook.");
    throw new Error("analyzeTransactions logic not implemented in store. Use useTransactionAnalysis hook.");
  },
  
  resetState: () => set({
    bankTransactions: [],
    analyzedTransactions: [],
    analysisData: null,
    isBankConnecting: false,
    isAnalyzing: false,
    bankError: null,
    analysisError: null,
  }),
}));