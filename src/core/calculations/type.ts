// src/shared/types/calculations.ts

/**
 * The grand taxonomy of ethical accounting
 * Because categorizing guilt makes it more manageable
 */
export interface ImpactAnalysis {
    negativeImpact: number;       // The collective weight of your ethical failures
    positiveImpact: number;       // Your attempts at redemption
    netSocietalDebt: number;      // Negative minus positive
    balance: number;              // Positive minus negative
    debtPercentage: number;       // Your guilt as a percentage of consumption
    
    // Statistics
    totalTransactions: number;    // Total spending decisions judged
    transactionsWithDebt: number; // How many times you ethically failed
    transactionsWithCredit: number; // Your occasional moments of virtue
  }
  
  export interface PracticeImpact {
    name: string;
    amount: number;
    isPositive: boolean;
  }
  
  export interface CategoryImpact {
    name: string;
    amount: number;
    practices: PracticeImpact[];
  }