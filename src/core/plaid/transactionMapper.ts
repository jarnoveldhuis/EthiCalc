// src/core/plaid/transactionMapper.ts
import { Transaction } from '@/shared/types/transactions'; // Import PlaidLocation

// Define the expected structure from Plaid's raw transaction more accurately
interface PlaidRawTransaction {
  transaction_id?: string;
  date?: string;
  name?: string;
  merchant_name?: string;
  amount?: number;
  category?: string[];
  // Define the location property based on Plaid's structure
  location?: {
    address: string | null;
    city: string | null;
    region: string | null;
    postal_code: string | null;
    country: string | null;
    lat: number | null;
    lon: number | null;
    store_number: string | null;
    // Add other potential Plaid location fields if needed
  } | null; // It can be null
  // Allow other unknown properties from Plaid
  [key: string]: unknown;
}


export function mapPlaidTransactions(plaidTransactions: PlaidRawTransaction[]): Transaction[] {
  if (!plaidTransactions || !Array.isArray(plaidTransactions)) {
    console.error('Invalid Plaid transaction data:', plaidTransactions);
    return [];
  }

  return plaidTransactions.map((tx: PlaidRawTransaction): Transaction => { // Ensure return type matches Transaction
    const date = tx.date || new Date().toISOString().split('T')[0];
    const name = tx.merchant_name || tx.name || 'Unknown Merchant';
    const rawAmount = typeof tx.amount === 'number' ? tx.amount : 0;
    const amount = Math.abs(rawAmount);

    // Ensure all required fields from Transaction type are initialized
    const newTransaction: Transaction = {
      date,
      name,
      merchant_name: tx.merchant_name ?? undefined, // Use ?? undefined for optional fields
      amount,
      analyzed: false, // Explicitly initialize required 'analyzed' field
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
      plaidCategories: tx.category || [],
      // *** UPDATED: Assign Plaid location object or null ***
      // Use nullish coalescing to default to null if tx.location is undefined or null
      location: tx.location ?? null,
    };
    return newTransaction;
  });
}

// --- mergeTransactions ---
// (No change needed here unless it directly manipulates location type)
export function mergeTransactions(
  existingTransactions: Transaction[],
  newTransactions: Transaction[]
): Transaction[] {
   const transactionMap = new Map<string, Transaction>();
   existingTransactions.forEach(tx => {
     const txToAdd = { ...tx, analyzed: tx.analyzed ?? false };
     const identifier = getTransactionIdentifier(txToAdd);
     if (identifier) {
       const existingInMap = transactionMap.get(identifier);
       if (!existingInMap || (!existingInMap.analyzed && txToAdd.analyzed)) {
            transactionMap.set(identifier, txToAdd);
        }
     }
   });
   newTransactions.forEach(tx => {
      const txToAdd = { ...tx, analyzed: tx.analyzed ?? false };
      const identifier = getTransactionIdentifier(txToAdd);
      if (identifier) {
         const existingInMap = transactionMap.get(identifier);
         if (!existingInMap || txToAdd.analyzed || !existingInMap.analyzed) {
            transactionMap.set(identifier, txToAdd);
         }
      }
   });
   return Array.from(transactionMap.values())
     .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
 }

// --- deduplicateTransactions ---
// (No change needed here)
export function deduplicateTransactions(transactions: Transaction[]): Transaction[] {
   const seen = new Set<string>();
   const results: Transaction[] = [];
   transactions.forEach(tx => {
     const identifier = getTransactionIdentifier(tx);
     if (identifier && !seen.has(identifier)) {
       seen.add(identifier);
       results.push({ ...tx, analyzed: tx.analyzed ?? false });
     }
   });
   return results;
 }


// --- Helper: getTransactionIdentifier (No change needed here) ---
function getTransactionIdentifier(transaction: Transaction): string | null {
    const plaidId: string | undefined = transaction.plaidTransactionId;
    if (plaidId && typeof plaidId === "string" && plaidId.trim() !== "") return `plaid-${plaidId}`;
    if (transaction.date && transaction.name && typeof transaction.amount === "number") {
        const normalizedName = transaction.name.trim().toUpperCase();
        return `${transaction.date}-${normalizedName}-${transaction.amount.toFixed(2)}`;
    }
    return null;
}