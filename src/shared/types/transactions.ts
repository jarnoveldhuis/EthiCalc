// src/shared/types/transactions.ts
export interface Charity {
  name: string;
  url: string;
}

export interface Transaction {
  id?: string; // Optional since some transactions might not have an ID yet
  analyzed?: boolean;
  date: string;
  name: string;
  amount: number;
  societalDebt?: number;
  unethicalPractices?: string[];
  ethicalPractices?: string[];
  practiceWeights?: Record<string, number>; // percentages
  practiceDebts?: Record<string, number>; // + or -
  practiceSearchTerms?: Record<string, string>; // search terms for charity lookup
  practiceCategories?: Record<string, string>; // categories for practices like "Climate Change", "Poverty", etc.
  charities?: Record<string, Charity>;
  information?: Record<string, string>; // Information per practice
  isCreditApplication?: boolean; // Flag to identify when this transaction is a credit application
  creditApplied?: boolean; // Flag to identify when this transaction has been used for credit
  plaidTransactionId?: string;
  plaidCategories?: string[];
}

export interface AnalyzedTransactionData {
  transactions: Transaction[];
  totalSocietalDebt: number;
  debtPercentage: number;
  totalPositiveImpact: number;
  totalNegativeImpact: number;
}

export interface PlaidError {
  error_code: string;
  error_message: string;
  display_message: string | null;
}

export interface AnalysisRequest {
  transactions: Transaction[];
}