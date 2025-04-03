// src/tsx/core/plaid/transactionMapper.ts (Relevant Part)
import { Transaction } from '@/shared/types/transactions';

// Interface for Plaid transaction data (ensure it includes transaction_id)
interface PlaidTransaction {
  transaction_id?: string; // <-- Make sure this is included
  date?: string;
  name?: string;
  merchant_name?: string;
  amount?: number;
  category?: string[];
  [key: string]: unknown;
}

export function mapPlaidTransactions(plaidTransactions: PlaidTransaction[]): Transaction[] {
  if (!plaidTransactions || !Array.isArray(plaidTransactions)) {
    console.error('Invalid Plaid transaction data:', plaidTransactions);
    return [];
  }

  return plaidTransactions.map(tx => {
    const date = tx.date || new Date().toISOString().split('T')[0];
    const name = tx.merchant_name || tx.name || 'Unknown Merchant';
    const rawAmount = typeof tx.amount === 'number' ? tx.amount : 0;
    const amount = Math.abs(rawAmount); // Use absolute amount

    return {
      date,
      name,
      amount,
      societalDebt: 0,
      unethicalPractices: [],
      ethicalPractices: [],
      information: {},
      practiceWeights: {}, // Initialize potential missing fields
      practiceDebts: {},
      practiceSearchTerms: {},
      practiceCategories: {},
      charities: {},
      analyzed: false,
      // *** ENSURE THIS LINE IS CORRECT ***
      plaidTransactionId: tx.transaction_id, // Map from Plaid's transaction_id
      // *** END ENSURE ***
      plaidCategories: tx.category // Optional: keep plaid categories
      // Ensure all fields from Transaction type are initialized if not mapped
    } as Transaction; // Cast to Transaction, ensure all fields are present or optional
  });
}

// Keep mergeTransactions and deduplicateTransactions as they are
// ... rest of the file (mergeTransactions, deduplicateTransactions) ...

export function deduplicateTransactions(transactions: Transaction[]): Transaction[] {
  const seen = new Set<string>();
  return transactions.filter(tx => {

    const identifier = tx.plaidTransactionId || `${tx.date}-${tx.name}-${tx.amount.toFixed(2)}`;
    if (seen.has(identifier)) {
      return false;
    }
    seen.add(identifier);
    return true;
  });
}

export function mergeTransactions(
  existingTransactions: Transaction[],
  newTransactions: Transaction[]
): Transaction[] {
  const transactionMap = new Map<string, Transaction>();

  // Add existing transactions first, prioritizing analyzed ones
  existingTransactions.forEach(tx => {

    const identifier = tx.plaidTransactionId || `${tx.date}-${tx.name}-${tx.amount.toFixed(2)}`;
    // If already in map, only overwrite if the new one is analyzed and the old one wasn't
    if (!transactionMap.has(identifier) || (tx.analyzed && !transactionMap.get(identifier)?.analyzed)) {
         transactionMap.set(identifier, tx);
     }
  });

  // Add or overwrite with new transactions
  newTransactions.forEach(tx => {

     const identifier = tx.plaidTransactionId || `${tx.date}-${tx.name}-${tx.amount.toFixed(2)}`;
     // Always prefer the newer transaction data if identifier matches, especially if analyzed
     if (!transactionMap.has(identifier) || tx.analyzed || !transactionMap.get(identifier)?.analyzed) {
        transactionMap.set(identifier, tx);
     }
  });

  return Array.from(transactionMap.values())
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}