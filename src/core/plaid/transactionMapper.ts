// src/core/plaid/transactionMapper.ts
import { Transaction } from '@/shared/types/transactions';

interface PlaidTransaction {
  transaction_id?: string;
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
    const amount = Math.abs(rawAmount);

    // Ensure all required fields from Transaction type are initialized
    const newTransaction: Transaction = {
      date,
      name,
      merchant_name: tx.merchant_name, // Store specific merchant_name if available
      amount,
      analyzed: false, // <<< CHANGED: Explicitly initialize required 'analyzed' field
      // Initialize other potentially missing optional fields to avoid runtime issues
      societalDebt: 0,
      unethicalPractices: [],
      ethicalPractices: [],
      information: {},
      practiceWeights: {},
      practiceDebts: {},
      practiceSearchTerms: {},
      practiceCategories: {},
      charities: {},
      citations: {},
      isCreditApplication: false,
      creditApplied: false,
      plaidTransactionId: tx.transaction_id,
      plaidCategories: tx.category || [], // Ensure array
    };
    return newTransaction;
  });
}

// --- mergeTransactions ---
// Ensures 'analyzed' remains boolean during merge
export function mergeTransactions(
  existingTransactions: Transaction[],
  newTransactions: Transaction[]
): Transaction[] {
  const transactionMap = new Map<string, Transaction>();

  existingTransactions.forEach(tx => {
    // Ensure analyzed is boolean when putting into map
    const txToAdd = { ...tx, analyzed: tx.analyzed ?? false };
    const identifier = getTransactionIdentifier(txToAdd); // Use helper defined below
    if (identifier) {
      // If already in map, only overwrite if the existing one wasn't analyzed and new one is
      const existingInMap = transactionMap.get(identifier);
      if (!existingInMap || (!existingInMap.analyzed && txToAdd.analyzed)) {
           transactionMap.set(identifier, txToAdd);
       }
    }
  });

  newTransactions.forEach(tx => {
     // Ensure analyzed is boolean when putting into map
     const txToAdd = { ...tx, analyzed: tx.analyzed ?? false };
     const identifier = getTransactionIdentifier(txToAdd);
     if (identifier) {
        const existingInMap = transactionMap.get(identifier);
        // Always prefer newer transaction if IDs match, especially if new one is analyzed
        // or if existing one wasn't analyzed
        if (!existingInMap || txToAdd.analyzed || !existingInMap.analyzed) {
           transactionMap.set(identifier, txToAdd);
        }
     }
  });

  return Array.from(transactionMap.values())
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

// --- deduplicateTransactions ---
// Ensure analyzed is boolean after deduplication
export function deduplicateTransactions(transactions: Transaction[]): Transaction[] {
  const seen = new Set<string>();
  const results: Transaction[] = [];
  transactions.forEach(tx => {
    const identifier = getTransactionIdentifier(tx);
    if (identifier && !seen.has(identifier)) {
      seen.add(identifier);
      // Ensure analyzed is boolean in the final array
      results.push({ ...tx, analyzed: tx.analyzed ?? false });
    }
  });
  return results;
}


// --- Helper: getTransactionIdentifier (copied from store for use here) ---
function getTransactionIdentifier(transaction: Transaction): string | null {
    const plaidId: string | undefined = transaction.plaidTransactionId;
    if (plaidId && typeof plaidId === "string" && plaidId.trim() !== "") return `plaid-${plaidId}`;
    if (transaction.date && transaction.name && typeof transaction.amount === "number") {
        const normalizedName = transaction.name.trim().toUpperCase();
        return `${transaction.date}-${normalizedName}-${transaction.amount.toFixed(2)}`;
    }
    return null;
}