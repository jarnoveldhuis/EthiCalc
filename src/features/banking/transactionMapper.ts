// src/features/banking/transactionMapper.ts
import { Transaction } from '@/shared/types/transactions';

/**
 * Interface for Plaid transaction data
 * Only includes fields we actually use
 */
interface PlaidTransaction {
  transaction_id?: string;
  date?: string;
  name?: string;
  merchant_name?: string;
  amount?: number;
  category?: string[];
  [key: string]: unknown; // Allow additional fields
}

/**
 * Maps Plaid transaction data to our application's Transaction type
 * @param plaidTransactions Raw transactions from Plaid API
 * @returns Formatted transactions ready for our application
 */
export function mapPlaidTransactions(plaidTransactions: PlaidTransaction[]): Transaction[] {
  if (!plaidTransactions || !Array.isArray(plaidTransactions)) {
    console.error('Invalid Plaid transaction data:', plaidTransactions);
    return [];
  }
  
  return plaidTransactions.map(tx => {
    // Get the date in YYYY-MM-DD format
    const date = tx.date || new Date().toISOString().split('T')[0];
    
    // Use merchant_name if available, otherwise fall back to name
    const name = tx.merchant_name || tx.name || 'Unknown Merchant';
    
    // Plaid amounts are negative for outflows (spending), but we want positive values
    // Also handle potentially missing amount values
    const rawAmount = typeof tx.amount === 'number' ? tx.amount : 0;
    const amount = Math.abs(rawAmount);
    
    // Map to our Transaction type
    return {
      date,
      name,
      amount,
      // Add placeholder fields for analysis
      societalDebt: 0,
      unethicalPractices: [],
      ethicalPractices: [],
      information: {},
      analyzed: false,
      // Optional: store original Plaid transaction ID for reference
      plaidTransactionId: tx.transaction_id,
      // Optional: store categories from Plaid for potential use in analysis
      plaidCategories: tx.category
    } as Transaction;
  });
}

/**
 * Deduplicate transactions based on date, name, and amount
 * @param transactions Array of transactions that may contain duplicates
 * @returns Deduplicated array of transactions
 */
export function deduplicateTransactions(transactions: Transaction[]): Transaction[] {
  // Create a Set of transaction identifiers to track duplicates
  const seen = new Set<string>();
  
  return transactions.filter(tx => {
    // Create a unique identifier for each transaction
    const identifier = `${tx.date}-${tx.name}-${tx.amount}`;
    
    // If we've seen this transaction before, filter it out
    if (seen.has(identifier)) {
      return false;
    }
    
    // Otherwise, add it to the set and keep it
    seen.add(identifier);
    return true;
  });
}

/**
 * Merge existing transactions with new ones, avoiding duplicates
 * @param existingTransactions Current transactions in the system
 * @param newTransactions New transactions to add
 * @returns Combined transactions without duplicates
 */
export function mergeTransactions(
  existingTransactions: Transaction[], 
  newTransactions: Transaction[]
): Transaction[] {
  // Convert existing transactions to a Map for quick lookup
  const existingMap = new Map<string, Transaction>();
  
  existingTransactions.forEach(tx => {
    const identifier = `${tx.date}-${tx.name}-${tx.amount}`;
    existingMap.set(identifier, tx);
  });
  
  // Process new transactions, replacing or adding as needed
  newTransactions.forEach(tx => {
    const identifier = `${tx.date}-${tx.name}-${tx.amount}`;
    
    // If this transaction exists and is already analyzed, keep it
    // Otherwise, use the new transaction
    if (!existingMap.has(identifier) || !existingMap.get(identifier)?.analyzed) {
      existingMap.set(identifier, tx);
    }
  });
  
  // Convert back to array and sort by date (newest first)
  return Array.from(existingMap.values())
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}