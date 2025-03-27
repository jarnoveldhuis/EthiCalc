// src/features/analysis/useCreditState.ts
import { useState, useEffect, useCallback, useRef } from "react";
import { db } from "@/core/firebase/firebase";
import {
  doc,
  getDoc,
  setDoc,
  // updateDoc,
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
  calculateAvailableCredit: (transactions: Transaction[], totalPositiveImpact: number) => number;
  refreshCreditState: () => Promise<void>;
}

// Helper function to create a unique ID for a transaction
function getTransactionId(tx: Transaction): string {
  return `${tx.date}-${tx.name}-${tx.amount}`;
}

export function useCreditState(user: User | null, transactions: Transaction[] | null): UseCreditStateResult {
  const [creditState, setCreditState] = useState<UserCreditState | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Track mounted state to prevent state updates after unmount
  const mountedRef = useRef(true);
  // Cache the current transactions for credit calculation
  const transactionsRef = useRef<Transaction[]>([]);

  // Update transactionsRef when transactions change
  useEffect(() => {
    if (transactions) {
      transactionsRef.current = transactions;
    }
  }, [transactions]);

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

          // Ensure we preserve all fields, including lastAppliedAmount
          const state: UserCreditState = {
            userId: user.uid,
            availableCredit: data.availableCredit || 0,
            appliedCredit: data.appliedCredit || 0,
            lastAppliedAmount: data.lastAppliedAmount || 0,
            lastAppliedAt: data.lastAppliedAt || Timestamp.now(),
            creditTransactionIds: data.creditTransactionIds || [],
          };

          // Debug logging
          if (process.env.NODE_ENV === "development") {
            console.log("Loading credit state from Firestore:", {
              lastAppliedAmount: state.lastAppliedAmount,
              appliedCredit: state.appliedCredit,
              availableCredit: state.availableCredit,
            });
          }

          return state;
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
    (transactions: Transaction[], totalPositiveImpact: number): number => {
      if (!transactions?.length) return 0;
      console.log("transactionsRef.current", transactionsRef.current);

      // Save transactions to ref for use in apply credit
      transactionsRef.current = transactions;
      
      // If we don't have creditState yet, return 0
      if (!creditState) return 0;

      // Get IDs of transactions that have been used for credit
      const usedTransactionIds = new Set(
        creditState.creditTransactionIds || []
      );

      // Calculate available credit by subtracting used transactions from total positive impact
      let availableCredit = totalPositiveImpact;

      // Subtract credit from used transactions
      transactions.forEach((tx) => {
        const txId = getTransactionId(tx);
        if (tx.creditApplied || usedTransactionIds.has(txId)) {
          // Calculate credit for this transaction
          const creditPractices = (tx.ethicalPractices || []).map(practice => {
            const weight = tx.practiceWeights?.[practice] || 0;
            return tx.amount * (weight / 100);
          });
          const totalCredit = creditPractices.reduce((sum, amount) => sum + amount, 0);
          availableCredit -= totalCredit;
        }
      });

      // Ensure we don't return negative credit
      availableCredit = Math.max(0, availableCredit);

      if (process.env.NODE_ENV === "development") {
        console.log(`Available credit: $${availableCredit.toFixed(2)}`);
        console.log(`Total positive impact: $${totalPositiveImpact.toFixed(2)}`);
        console.log(`Applied credit: $${creditState.appliedCredit.toFixed(2)}`);
        console.log(`Used transaction IDs:`, Array.from(usedTransactionIds));
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

        // Calculate current total societal debt
        const currentDebt = transactions.reduce((total, tx) => {
          let transactionDebt = 0;
          if (tx.unethicalPractices && tx.unethicalPractices.length > 0) {
            tx.unethicalPractices.forEach(practice => {
              const weight = tx.practiceWeights?.[practice] || 0;
              transactionDebt += tx.amount * (weight / 100);
            });
          } else if (tx.societalDebt && tx.societalDebt > 0) {
            transactionDebt = tx.societalDebt;
          }
          return total + transactionDebt;
        }, 0);

        // Calculate how much credit we actually need to apply
        // Only apply enough to reduce debt to 0, keep the rest available
        const creditNeeded = Math.min(amount, currentDebt);
        let creditToApply = creditNeeded;

        // Get IDs of transactions that have already been used for credit
        const usedTransactionIds = new Set(
          creditState.creditTransactionIds || []
        );

        // Track transactions to use for this credit application
        const transactionsToUse: Transaction[] = [];
        const newTransactionIds: string[] = [];

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
            // Calculate the credit amount for this transaction
            let transactionCredit = 0;
            if (tx.ethicalPractices && tx.ethicalPractices.length > 0) {
              tx.ethicalPractices.forEach(practice => {
                const weight = tx.practiceWeights?.[practice] || 0;
                transactionCredit += tx.amount * (weight / 100);
              });
            } else if (tx.societalDebt && tx.societalDebt < 0) {
              transactionCredit = Math.abs(tx.societalDebt);
            }

            // Add this transaction to the used list
            transactionsToUse.push(tx);
            newTransactionIds.push(txId);

            // Subtract its contribution from the remaining credit to apply
            creditToApply -= transactionCredit;

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
              creditNeeded - creditToApply
            } of ${creditNeeded} credit to apply`
          );
        }

        const actualCreditApplied = creditNeeded - Math.max(0, creditToApply);

        // Debug logging
        if (process.env.NODE_ENV === "development") {
          console.log("Applying credit:", {
            requestedAmount: amount,
            creditNeeded,
            foundAmount: actualCreditApplied,
            transactionsUsed: transactionsToUse.length,
            newTransactionIds,
            currentLastAppliedAmount: creditState.lastAppliedAmount,
            currentDebt,
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

        const updatedState: UserCreditState = {
          ...creditState,
          appliedCredit: creditState.appliedCredit + actualCreditApplied,
          lastAppliedAmount: actualCreditApplied,
          lastAppliedAt: Timestamp.now(),
          creditTransactionIds: [
            ...creditState.creditTransactionIds,
            ...newTransactionIds,
          ],
        };

        // Update local state immediately
        if (mountedRef.current) {
          setCreditState(updatedState);
        }

        // Debug logging before Firestore update
        if (process.env.NODE_ENV === "development") {
          console.log("Updating Firestore with state:", {
            lastAppliedAmount: updatedState.lastAppliedAmount,
            appliedCredit: updatedState.appliedCredit,
            availableCredit: updatedState.availableCredit,
          });
        }

        // Update Firestore in the background
        try {
          let retryCount = 0;
          const maxRetries = 3;
          let success = false;

          while (!success && retryCount < maxRetries) {
            try {
              await setDoc(creditDocRef, updatedState);
              success = true;
            } catch (err) {
              retryCount++;
              if (retryCount === maxRetries) {
                console.error("Error updating Firestore after retries:", err);
                // Don't revert local state on Firestore failure
                console.warn("Firestore update failed, but local state remains updated");
              } else {
                // Wait before retrying (exponential backoff)
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
              }
            }
          }
        } catch (err) {
          console.error("Error updating Firestore:", err);
          // Don't revert local state on Firestore failure
          console.warn("Firestore update failed, but local state remains updated");
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

  // Refresh credit state with retry logic
  const refreshCreditState = useCallback(async (): Promise<void> => {
    if (!user) return;

    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        const newState = await loadCreditState();
        if (mountedRef.current && newState) {
          // Only update if the new state is different
          if (JSON.stringify(newState) !== JSON.stringify(creditState)) {
            setCreditState(newState);
          }
        }
        return;
      } catch (err) {
        retryCount++;
        if (retryCount === maxRetries) {
          console.error("Error refreshing credit state after retries:", err);
          if (mountedRef.current) {
            setError("Failed to refresh credit state");
          }
        } else {
          // Wait before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
        }
      }
    }
  }, [user, loadCreditState, creditState]);

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
