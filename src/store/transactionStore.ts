// src/store/transactionStore.ts
import { create } from 'zustand';
import { Transaction } from '@/shared/types/transactions';
import { ImpactAnalysis } from '@/core/calculations/type';
import { calculationService } from '@/core/calculations/impactService';

interface TransactionState {
  // Data
  transactions: Transaction[];
  impactAnalysis: ImpactAnalysis | null;
  
  // UI State
  activeView: string;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setTransactions: (transactions: Transaction[]) => void;
  setActiveView: (view: string) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  
  // Computed values - these recalculate when dependencies change
  getImpactAnalysis: () => ImpactAnalysis | null;
}

export const useTransactionStore = create<TransactionState>((set, get) => ({
  // Initial state
  transactions: [],
  impactAnalysis: null,
  activeView: 'balance-sheet',
  isLoading: false,
  error: null,
  
  // Actions
  setTransactions: (transactions) => {
    set({ transactions });
    // Automatically update impact analysis when transactions change
    const state = get();
    set({ impactAnalysis: state.getImpactAnalysis() });
  },
  setActiveView: (activeView) => set({ activeView }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  
  // Computed value
  getImpactAnalysis: () => {
    const { transactions } = get();
    if (!transactions || transactions.length === 0) return null;
    
    // Use your existing calculation service
    return calculationService.calculateImpactAnalysis(transactions);
  }
}));