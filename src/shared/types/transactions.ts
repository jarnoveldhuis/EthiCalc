// src/shared/types/transactions.ts
export interface Charity {
  name: string;
  url: string;
}

export interface Transaction {
  id?: string;
  analyzed: boolean; // <<< CHANGED: Made required
  date: string;
  name: string;
  merchant_name?: string; // Keep optional merchant name
  amount: number;
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
  isCreditApplication?: boolean;
  creditApplied?: boolean;
  plaidTransactionId?: string;
  plaidCategories?: string[];
}

// Keep other interfaces (AnalyzedTransactionData, PlaidError, AnalysisRequest)
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