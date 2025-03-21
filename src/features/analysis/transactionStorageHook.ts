// src/features/analysis/transactionStorageHook.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '@/shared/firebase/firebase';
import { collection, addDoc, query, where, orderBy, getDocs, limit, Timestamp, DocumentData } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { Transaction } from '@/shared/types/transactions';

interface TransactionBatch {
  userId: string;
  transactions: Transaction[];
  totalSocietalDebt: number;
  debtPercentage: number;
  createdAt: Timestamp;
  accessToken?: string;
  id?: string;
}

interface UseTransactionStorageResult {
  savedTransactions: Transaction[] | null;
  totalSocietalDebt: number;
  isLoading: boolean;
  error: string | null;
  saveTransactions: (transactions: Transaction[], totalDebt: number) => Promise<void>;
  loadLatestTransactions: () => Promise<boolean>;
}

export function useTransactionStorage(user: User | null): UseTransactionStorageResult {
  const [savedTransactions, setSavedTransactions] = useState<Transaction[] | null>(null);
  const [totalSocietalDebt, setTotalSocietalDebt] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Use refs to prevent multiple calls and track mounted state
  const isLoadingRef = useRef(false);
  const mountedRef = useRef(true);
  
  // Reset state when user changes (login/logout)
  useEffect(() => {
    if (!user) {
      // Reset state on logout
      setSavedTransactions(null);
      setTotalSocietalDebt(0);
      setError(null);
    }
  }, [user]);

  // Save transactions to Firestore
  const saveTransactions = useCallback(async (transactions: Transaction[], totalDebt: number): Promise<void> => {
    if (!user || !mountedRef.current) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Calculate debt percentage
      const totalSpent = transactions.reduce((sum, tx) => sum + tx.amount, 0);
      const debtPercentage = totalSpent > 0 ? (totalDebt / totalSpent) * 100 : 0;

      // Create batch document
      const batch: Omit<TransactionBatch, 'id'> = {
        userId: user.uid,
        transactions,
        totalSocietalDebt: totalDebt,
        debtPercentage,
        createdAt: Timestamp.now(),
      };

      // Add to Firestore
      const docRef = await addDoc(collection(db, 'transactionBatches'), batch);
      console.log('Transaction batch saved with ID:', docRef.id);

      // Update local state
      if (mountedRef.current) {
        setSavedTransactions(transactions);
        setTotalSocietalDebt(totalDebt);
      }
    } catch (err) {
      console.error('Error saving transactions:', err);
      if (mountedRef.current) {
        setError('Failed to save transactions');
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [user]);

  // Load latest transaction batch for current user
  const loadLatestTransactions = useCallback(async (): Promise<boolean> => {
    if (!user || !mountedRef.current) {
      return false;
    }

    // Prevent concurrent loading attempts
    if (isLoadingRef.current) {
      return false;
    }

    isLoadingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      const q = query(
        collection(db, 'transactionBatches'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc'),
        limit(1)
      );

      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        console.log('No saved transactions found');
        if (mountedRef.current) {
          setIsLoading(false);
        }
        isLoadingRef.current = false;
        return false;
      }
      
      // Get the latest batch
      const doc = querySnapshot.docs[0];
      const data = doc.data() as DocumentData;
      const batch = {
        ...data as TransactionBatch,
        id: doc.id
      };

      console.log('Loaded transaction batch:', batch.id);

      // Update state with the loaded data
      if (mountedRef.current) {
        setSavedTransactions(batch.transactions);
        setTotalSocietalDebt(batch.totalSocietalDebt);
        setIsLoading(false);
      }
      
      isLoadingRef.current = false;
      return true;
    } catch (err) {
      console.error('Error loading transactions:', err);
      if (mountedRef.current) {
        setError('Failed to load saved transactions');
        setIsLoading(false);
      }
      isLoadingRef.current = false;
      return false;
    }
  }, [user]);

  // Auto-load latest transactions on mount and when user changes
  useEffect(() => {
    // Skip if no user, transactions already loaded, currently loading, or hook is cleaning up
    if (!user || savedTransactions || isLoadingRef.current || !mountedRef.current) {
      return;
    }

    // Set a small delay to prevent multiple rapid requests during auth state changes
    const loadTimeout = setTimeout(() => {
      if (mountedRef.current && user) {
        loadLatestTransactions().catch(err => {
          if (mountedRef.current) {
            console.error('Failed to auto-load transactions:', err);
          }
        });
      }
    }, 300);
    
    return () => {
      clearTimeout(loadTimeout);
    };
  }, [user, savedTransactions, loadLatestTransactions]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return {
    savedTransactions,
    totalSocietalDebt,
    isLoading,
    error,
    saveTransactions,
    loadLatestTransactions
  };
}