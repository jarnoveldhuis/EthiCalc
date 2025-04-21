
// src/features/analysis/transactionStorageService.ts
// Domain logic for storing and retrieving transactions - no HTTP concerns

// --- IMPORTS ---
import { firebaseAdminDb } from '@/lib/firebaseAdmin'; // Admin Firestore instance (possibly null)
import { Timestamp as AdminTimestamp } from 'firebase-admin/firestore'; // Admin Timestamp
import { Timestamp as ClientTimestamp } from "firebase/firestore"; // For type definitions
import { Transaction, AnalyzedTransactionData } from "@/shared/types/transactions";
import { firebaseDebug } from "@/core/firebase/debugUtils";
import { DocumentData } from "firebase/firestore"; // Need this type for admin data()

// --- INTERFACES (Unchanged) ---
export interface TransactionBatchDocument {
  userId: string;
  transactions: Transaction[];
  totalSocietalDebt: number;
  debtPercentage: number;
  createdAt: ClientTimestamp; // Use client Timestamp for type hint consistency
}
export interface TransactionBatch extends TransactionBatchDocument {
  id?: string;
}

// --- HELPER FUNCTION (Keep for early exit) ---
function ensureAdminDbIsInitialized() {
    if (!firebaseAdminDb) {
        console.error("Firestore Admin SDK is not initialized. Cannot perform database operation.");
        throw new Error("Firestore Admin SDK not initialized. Check server logs.");
    }
}

/**
 * Save a batch of analyzed transactions to Firestore using ADMIN SDK
 */
export async function saveAnalyzedTransactions(
  userId: string,
  data: AnalyzedTransactionData
): Promise<string> {
  ensureAdminDbIsInitialized(); // Initial check for early exit

  if (!userId) { throw new Error("User ID is required to save transactions"); }
  if (!data || !data.transactions) { throw new Error("Analyzed transaction data with transactions array is required"); }

  try {
    const batchToSave = {
      userId,
      transactions: data.transactions,
      totalSocietalDebt: data.totalSocietalDebt ?? 0,
      debtPercentage: data.debtPercentage ?? 0,
      createdAt: AdminTimestamp.now(), // Use Admin Timestamp for writing
    };

    firebaseDebug.logWrite('transactionBatches', batchToSave, { status: 'pending' });

    // --- STRICT NULL CHECK ADDED (redundant but satisfies TS) ---
    if (!firebaseAdminDb) {
       // This should theoretically not be reached if ensureAdminDbIsInitialized works,
       // but it satisfies the compiler's check at the point of use.
       throw new Error("Firestore Admin SDK became unavailable unexpectedly.");
    }
    // --- END STRICT NULL CHECK ---

    const docRef = await firebaseAdminDb.collection("transactionBatches").add(batchToSave);

    console.log("(Admin) Transaction batch saved with ID:", docRef.id);
    firebaseDebug.logWrite('transactionBatches', batchToSave, { id: docRef.id });

    return docRef.id;
  } catch (error: unknown) {
    console.error("Error saving transactions to Firestore (Admin SDK):", error);
    // --- CORRECTED 'any' FIX ---
    let errorCode: string | number | undefined = undefined;
    let errorMessage: string = "Unknown error";

    if (typeof error === 'object' && error !== null) {
        // Check common error structures
        if ('code' in error) {
           errorCode = (error as { code: string | number }).code;
        }
         if ('message' in error && typeof (error as { message: unknown }).message === 'string') {
             errorMessage = (error as { message: string }).message;
        } else if (error instanceof Error) {
             errorMessage = error.message; // Fallback for standard errors
        }
    } else if (error instanceof Error) {
        errorMessage = error.message; // Handle if error itself is an Error instance
    }
    // --- END CORRECTED 'any' FIX ---

    if (errorMessage.includes('invalid data')) {
        if (errorMessage.includes('Timestamp')) {
            console.error("Firestore Error Detail: Timestamp type mismatch likely.");
        }
        console.error("Firestore data validation failed. Data being saved:", JSON.stringify(data));
        throw new Error(`Firestore Error: Invalid data format. ${errorMessage}`);
    }
    // Use the extracted code for permission check
    if (errorCode === 7 || errorCode === 'permission-denied') { // Check code explicitly
         console.error("Firestore permission denied despite using Admin SDK. Check Service Account IAM roles.");
         throw new Error(`Firestore Permission Denied (Admin SDK). Check Service Account Roles. Original: ${errorMessage}`);
    }
    throw new Error(`Failed to save transactions: ${errorMessage}`);
  }
}

/**
 * Get all transaction batches for a user using ADMIN SDK
 */
export async function getUserTransactionBatches(userId: string): Promise<TransactionBatch[]> {
  ensureAdminDbIsInitialized(); // Initial check

  if (!userId) { throw new Error("User ID is required to get transaction batches"); }

  // --- STRICT NULL CHECK ADDED ---
  if (!firebaseAdminDb) { throw new Error("Firestore Admin SDK became unavailable unexpectedly."); }
  // --- END STRICT NULL CHECK ---

  try {
    const q = firebaseAdminDb.collection("transactionBatches")
        .where("userId", "==", userId)
        .orderBy("createdAt", "desc");

    firebaseDebug.logRead('transactionBatches', { userId, orderBy: 'createdAt desc'}, { status: 'pending' });
    const querySnapshot = await q.get();
    firebaseDebug.logRead('transactionBatches', { userId, orderBy: 'createdAt desc'}, { count: querySnapshot.size });

    const batches: TransactionBatch[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data() as DocumentData;
      const createdAtFromServer = data.createdAt;
      batches.push({
        id: doc.id,
        userId: data.userId,
        transactions: data.transactions || [],
        totalSocietalDebt: data.totalSocietalDebt ?? 0,
        debtPercentage: data.debtPercentage ?? 0,
        createdAt: createdAtFromServer as ClientTimestamp,
      });
    });
    return batches;
  } catch (error: unknown) {
    console.error("Error getting user transaction batches (Admin SDK):", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Failed to load transaction history via Admin SDK: ${message}`);
  }
}

/**
 * Get the most recent transaction batch for a user using ADMIN SDK
 */
export async function getLatestTransactionBatch(userId: string): Promise<TransactionBatch | null> {
  ensureAdminDbIsInitialized(); // Initial check

  if (!userId) { throw new Error("User ID is required to get the latest transaction batch"); }

  // --- STRICT NULL CHECK ADDED ---
  if (!firebaseAdminDb) { throw new Error("Firestore Admin SDK became unavailable unexpectedly."); }
  // --- END STRICT NULL CHECK ---

  try {
    const q = firebaseAdminDb.collection("transactionBatches")
        .where("userId", "==", userId)
        .orderBy("createdAt", "desc")
        .limit(1);

    firebaseDebug.logRead('transactionBatches', { userId, orderBy: 'createdAt desc', limit: 1}, { status: 'pending' });
    const querySnapshot = await q.get();
    firebaseDebug.logRead('transactionBatches', { userId, orderBy: 'createdAt desc', limit: 1}, { count: querySnapshot.size });

    if (querySnapshot.empty) {
      return null;
    }

    const doc = querySnapshot.docs[0];
    const data = doc.data() as DocumentData;
    const createdAtFromServer = data.createdAt;
    return {
        id: doc.id,
        userId: data.userId,
        transactions: data.transactions || [],
        totalSocietalDebt: data.totalSocietalDebt ?? 0,
        debtPercentage: data.debtPercentage ?? 0,
        createdAt: createdAtFromServer as ClientTimestamp,
    };
  } catch (error: unknown) {
    console.error("Error getting latest transaction batch (Admin SDK):", error);
     const message = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Failed to load latest transactions via Admin SDK: ${message}`);
  }
}
