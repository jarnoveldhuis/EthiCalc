// src/shared/types/transactions.ts
export interface Charity {
  name: string;
  url: string;
}

export interface Citation {
    url: string;
    title?: string;
}

// *** NEW: Interface for Plaid Location Object ***
// (Define only the fields you might potentially use, or add more as needed from Plaid docs)
export interface PlaidLocation {
    address: string | null;
    city: string | null;
    region: string | null; // State or province
    postal_code: string | null;
    country: string | null;
    lat: number | null;
    lon: number | null;
    store_number: string | null;
}

export interface Transaction {
  id?: string;
  analyzed: boolean;
  date: string;
  name: string;
  merchant_name?: string;
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
  citations?: Record<string, Citation[]>;

  isCreditApplication?: boolean;
  creditApplied?: boolean;
  plaidTransactionId?: string;
  plaidCategories?: string[];
  // *** UPDATED: Use the specific PlaidLocation type ***
  location?: PlaidLocation | null; // Replaced Record<string, any> | string[]
}

// --- Other interfaces remain the same ---
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