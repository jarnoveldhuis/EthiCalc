// src/features/analysis/useCreditState.ts
import { useState, useEffect, useCallback, useRef } from "react";
import { db } from "@/shared/firebase/firebase";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  Timestamp,
  DocumentData,
} from "firebase/firestore";
import { User } from "firebase/auth";
import { Transaction } from "@/shared/types/transactions";

// Define the credit state interface
export interface UserCreditState {
  userId: string;
  availableCredit: number; // Credit earned but not yet applied
  appliedCredit: number; // Total credit that's been applied over time
  lastAppliedAmount: number;
  lastAppliedAt: Timestamp;
  // Tracking used transactions to avoid double-counting
  creditTransactionIds: string[];
}

interface UseCreditStateResult {
  creditState: UserCreditState | null;
  isLoading: boolean;
  error: string | null;
  applyCredit: (amount: number) => Promise<boolean>;
  calculateAvailableCredit: (transactions: Transaction[]) => number;
  refreshCreditState: () => Promise<void>;
}

// Helper function to create a unique ID for a transaction
function getTransactionId(tx: Transaction): string {
  return `${tx.date}-${tx.name}-${tx.amount}`;
}

export function useCreditState(user: User | null): UseCreditStateResult {
  const [creditState, setCreditState] = useState<UserCreditState | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Track mounted state to prevent state updates after unmount
  const mountedRef = useRef(true);
  // Cache the current transactions for credit calculation
  const transactionsRef = useRef<Transaction[]>([]);

  // Load credit state
  const loadCreditState =
    useCallback(async (): Promise<UserCreditState | null> => {
      if (!user) return null;

      setIsLoading(true);
      setError(null);

      try {
        // Check for existing credit state
        const creditDocRef = doc(db, "creditState", user.uid);
        const docSnap = await getDoc(creditDocRef);

        if (docSnap.exists()) {
          // We have existing credit state
          const data = docSnap.data() as DocumentData;

          return {
            userId: user.uid,
            availableCredit: data.availableCredit || 0,
            appliedCredit: data.appliedCredit || 0,
            lastAppliedAmount: data.lastAppliedAmount || 0,
            lastAppliedAt: data.lastAppliedAt || Timestamp.now(),
            creditTransactionIds: data.creditTransactionIds || [],
          };
        } else {
          // Initialize new credit state
          const initialState: UserCreditState = {
            userId: user.uid,
            availableCredit: 0,
            appliedCredit: 0,
            lastAppliedAmount: 0,
            lastAppliedAt: Timestamp.now(),
            creditTransactionIds: [],
          };

          // Create the initial document
          await setDoc(creditDocRef, initialState);
          return initialState;
        }
      } catch (err) {
        console.error("Error loading credit state:", err);
        setError("Failed to load credit state");
        return null;
      } finally {
        if (mountedRef.current) {
          setIsLoading(false);
        }
      }
    }, [user]);

  // Calculate available credit from transactions
  const calculateAvailableCredit = useCallback(
    (transactions: Transaction[]): number => {
      if (!transactions?.length) return 0;

      // Save transactions to ref for use in apply credit
      transactionsRef.current = transactions;

      // If we don't have creditState yet, return 0
      if (!creditState) return 0;

      // Get IDs of transactions that have been used for credit
      const usedTransactionIds = new Set(
        creditState.creditTransactionIds || []
      );

      // Debug log counts for development
      if (process.env.NODE_ENV === "development") {
        console.log("Calculate Credit:", {
          totalTransactions: transactions.length,
          usedTransactionIds: usedTransactionIds.size,
        });
      }

      // Sum positive impact from transactions that haven't been used
      let availableCredit = 0;

      transactions.forEach((tx) => {
        const txId = getTransactionId(tx);

        // Skip transactions that are already used for credit
        if (tx.creditApplied || usedTransactionIds.has(txId)) {
          return;
        }

        // Only count true net positive impacts:
        if (tx.societalDebt && tx.societalDebt < 0) {
          availableCredit += Math.abs(tx.societalDebt);
        }
      });

      if (process.env.NODE_ENV === "development") {
        console.log(`Available credit: $${availableCredit.toFixed(2)}`);
      }

      return availableCredit;
    },
    [creditState]
  );

  // Apply credit to reduce societal debt
  const applyCredit = useCallback(
    async (amount: number): Promise<boolean> => {
      if (!user || !creditState || amount <= 0) {
        console.error(
          "Cannot apply credit - user, creditState missing or amount <= 0"
        );
        return false;
      }

      setIsLoading(true);
      setError(null);

      try {
        // We need to find which transactions to mark as used for this credit amount
        const transactions = transactionsRef.current;
        if (!transactions || transactions.length === 0) {
          throw new Error("No transactions available to apply credit from");
        }

        // Get IDs of transactions that have already been used for credit
        const usedTransactionIds = new Set(
          creditState.creditTransactionIds || []
        );

        // Track transactions to use for this credit application
        const transactionsToUse: Transaction[] = [];
        const newTransactionIds: string[] = [];
        let creditToApply = amount;

        // Find positive impact transactions that haven't been used yet
        for (const tx of transactions) {
          const txId = getTransactionId(tx);

          // Skip if already used
          if (tx.creditApplied || usedTransactionIds.has(txId)) {
            continue;
          }

          // Check if this transaction has positive impact
          if (
            (tx.ethicalPractices && tx.ethicalPractices.length > 0) ||
            (tx.societalDebt && tx.societalDebt < 0)
          ) {
            const positiveAmount = Math.abs(tx.societalDebt || 0);

            // Add this transaction to the used list
            transactionsToUse.push(tx);
            newTransactionIds.push(txId);

            // Subtract its contribution from the remaining credit to apply
            creditToApply -= positiveAmount;

            // If we've found enough transactions, stop looking
            if (creditToApply <= 0) {
              break;
            }
          }
        }

        // If we couldn't find enough transactions, use what we have
        if (creditToApply > 0) {
          console.warn(
            `Could only find ${
              amount - creditToApply
            } of ${amount} credit to apply`
          );
        }

        // Debug logging
        if (process.env.NODE_ENV === "development") {
          console.log("Applying credit:", {
            requestedAmount: amount,
            foundAmount: amount - Math.max(0, creditToApply),
            transactionsUsed: transactionsToUse.length,
            newTransactionIds,
          });
        }

        // Mark these transactions as used in local storage
        transactionsToUse.forEach((tx) => {
          const txIndex = transactions.findIndex(
            (t) =>
              t.date === tx.date && t.name === tx.name && t.amount === tx.amount
          );

          if (txIndex >= 0) {
            transactions[txIndex] = {
              ...transactions[txIndex],
              creditApplied: true,
            };
          }
        });

        // Update the credit state
        const creditDocRef = doc(db, "creditState", user.uid);

        const updatedState: Partial<UserCreditState> = {
          appliedCredit:
            creditState.appliedCredit + (amount - Math.max(0, creditToApply)),
          lastAppliedAmount: amount - Math.max(0, creditToApply),
          lastAppliedAt: Timestamp.now(),
          creditTransactionIds: [
            ...creditState.creditTransactionIds,
            ...newTransactionIds,
          ],
        };

        // Update document in Firestore
        await updateDoc(creditDocRef, updatedState);

        // Update local state
        if (mountedRef.current) {
          setCreditState((prev) => {
            if (!prev) return null;

            return {
              ...prev,
              appliedCredit:
                prev.appliedCredit + (amount - Math.max(0, creditToApply)),
              lastAppliedAmount: amount - Math.max(0, creditToApply),
              lastAppliedAt: Timestamp.now(),
              creditTransactionIds: [
                ...prev.creditTransactionIds,
                ...newTransactionIds,
              ],
            };
          });
        }

        return true;
      } catch (err) {
        console.error("Error applying credit:", err);
        setError("Failed to apply credit");
        return false;
      } finally {
        if (mountedRef.current) {
          setIsLoading(false);
        }
      }
    },
    [user, creditState]
  );

  // Refresh credit state
  const refreshCreditState = useCallback(async (): Promise<void> => {
    if (!user) return;

    try {
      const newState = await loadCreditState();
      if (mountedRef.current && newState) {
        setCreditState(newState);
      }
    } catch (err) {
      console.error("Error refreshing credit state:", err);
      if (mountedRef.current) {
        setError("Failed to refresh credit state");
      }
    }
  }, [user, loadCreditState]);

  // Load credit state on mount and when user changes
  useEffect(() => {
    if (!user) {
      setCreditState(null);
      return;
    }

    refreshCreditState();
  }, [user, refreshCreditState]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return {
    creditState,
    isLoading,
    error,
    applyCredit,
    calculateAvailableCredit,
    refreshCreditState,
  };
}
