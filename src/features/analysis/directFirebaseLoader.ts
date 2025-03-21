// src/features/analysis/directFirebaseLoader.ts
import { db } from '@/shared/firebase/firebase';
import { collection, query, where, orderBy, getDocs, limit, writeBatch } from 'firebase/firestore';
import { Transaction } from '@/shared/types/transactions';

/**
 * Directly load transactions from Firebase without relying on React state
 * This is useful for debugging and can be used when the hooks aren't working
 */
export async function loadUserTransactions(userId: string): Promise<{
  transactions: Transaction[] | null;
  totalSocietalDebt: number;
  error: string | null;
}> {
  if (!userId) {
    return {
      transactions: null,
      totalSocietalDebt: 0,
      error: "No user ID provided"
    };
  }
  
  console.log(`🔍 Direct Firebase Loader: fetching data for user ${userId}`);
  
  try {
    const q = query(
      collection(db, 'transactionBatches'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(1)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      console.log(`🔍 Direct Firebase Loader: no data found for user ${userId}`);
      return {
        transactions: null,
        totalSocietalDebt: 0,
        error: null // Not an error, just no data
      };
    }
    
    // Get the most recent batch
    const doc = querySnapshot.docs[0];
    const data = doc.data();
    
    console.log(`🔍 Direct Firebase Loader: found batch ${doc.id} with ${data.transactions?.length || 0} transactions`);
    
    return {
      transactions: data.transactions || [],
      totalSocietalDebt: data.totalSocietalDebt || 0,
      error: null
    };
  } catch (error) {
    console.error('🔍 Direct Firebase Loader: error fetching data:', error);
    return {
      transactions: null,
      totalSocietalDebt: 0,
      error: error instanceof Error ? error.message : 'Unknown error loading data'
    };
  }
}

/**
 * Check if a user has any data in Firebase
 * Returns true if data exists, false otherwise
 */
export async function userHasData(userId: string): Promise<boolean> {
  if (!userId) return false;
  
  try {
    const q = query(
      collection(db, 'transactionBatches'),
      where('userId', '==', userId),
      limit(1)
    );
    
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  } catch (error) {
    console.error('🔍 Direct Firebase Loader: error checking user data:', error);
    return false;
  }
}

/**
 * Get transaction count for a user 
 * Returns the total number of transaction batches stored for this user
 */
export async function getUserTransactionCount(userId: string): Promise<number> {
  if (!userId) return 0;
  
  try {
    const q = query(
      collection(db, 'transactionBatches'),
      where('userId', '==', userId)
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.size;
  } catch (error) {
    console.error('🔍 Direct Firebase Loader: error counting user transactions:', error);
    return 0;
  }
}

/**
 * Delete all transaction batches for a user
 * USE WITH CAUTION - this is destructive and cannot be undone
 */
export async function deleteAllUserTransactions(userId: string): Promise<boolean> {
  if (!userId) {
    console.error("Cannot delete transactions: No user ID provided");
    return false;
  }
  
  try {
    console.log(`🗑️ Deleting all transaction batches for user: ${userId}`);
    
    // First get all transaction batches for this user
    const q = query(
      collection(db, 'transactionBatches'),
      where('userId', '==', userId)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      console.log("No transactions found to delete");
      return true; // Nothing to delete is still a success
    }
    
    // Use batched writes for better performance if many documents
    const batchSize = 500; // Firestore limit is 500 operations per batch
    let totalDeleted = 0;
    
    // For smaller sets, use a single batch
    if (querySnapshot.size <= batchSize) {
      const batch = writeBatch(db);
      
      querySnapshot.forEach(doc => {
        batch.delete(doc.ref);
        totalDeleted++;
      });
      
      await batch.commit();
    } else {
      // For larger sets, use multiple batches
      let currentBatch = writeBatch(db);
      let operationCount = 0;
      
      for (const doc of querySnapshot.docs) {
        currentBatch.delete(doc.ref);
        operationCount++;
        totalDeleted++;
        
        // If we've reached the batch limit, commit and start a new batch
        if (operationCount >= batchSize) {
          await currentBatch.commit();
          currentBatch = writeBatch(db);
          operationCount = 0;
        }
      }
      
      // Commit any remaining operations
      if (operationCount > 0) {
        await currentBatch.commit();
      }
    }
    
    console.log(`🗑️ Successfully deleted ${totalDeleted} transaction batches`);
    return true;
  } catch (error) {
    console.error('🗑️ Error deleting user transactions:', error);
    throw error; // Re-throw to allow proper error handling
  }
}