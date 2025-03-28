// src/hooks/useCreditState.ts
import { useState, useEffect, useCallback, useRef } from "react";
import { db } from "@/core/firebase/firebase";
import { doc, getDoc, setDoc, Timestamp, DocumentData } from "firebase/firestore";
import { User } from "firebase/auth";
import { Transaction } from "@/shared/types/transactions";

// Define the credit state interface
export interface UserCreditState {
  userId: string;
  availableCredit: number;
  appliedCredit: number;
  lastAppliedAmount: number;
  lastAppliedAt: Timestamp;
}

interface UseCreditStateResult {
  creditState: UserCreditState | null;
  isLoading: boolean;
  error: string | null;
  applyCredit: (amount: number) => Promise<boolean>;
  calculateAvailableCredit: (transactions: Transaction[]) => number;
  refreshCreditState: () => Promise<void>;
}

export function useCreditState(user: User | null, transactions: Transaction[] | null): UseCreditStateResult {
  const [creditState, setCreditState] = useState<UserCreditState | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Track mounted state
  const isMounted = useRef(true);
  // Cache the current transactions
  const transactionsCache = useRef<Transaction[]>([]);

  // Update cached transactions when they change
  useEffect(() => {
    if (transactions) {
      transactionsCache.current = [...transactions];
    }
  }, [transactions]);

  // Load or initialize credit state
  const loadCreditState = useCallback(async (): Promise<UserCreditState | null> => {
    if (!user) return null;
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log("Loading credit state for user:", user.uid);
      const creditDocRef = doc(db, "creditState", user.uid);
      const docSnap = await getDoc(creditDocRef);
      
      if (docSnap.exists()) {
        // Found existing credit state
        const data = docSnap.data() as DocumentData;
        console.log("Found existing credit state:", data);
        
        // Ensure we have all required fields
        const state: UserCreditState = {
          userId: user.uid,
          availableCredit: typeof data.availableCredit === 'number' ? data.availableCredit : 0,
          appliedCredit: typeof data.appliedCredit === 'number' ? data.appliedCredit : 0,
          lastAppliedAmount: typeof data.lastAppliedAmount === 'number' ? data.lastAppliedAmount : 0,
          lastAppliedAt: data.lastAppliedAt instanceof Timestamp ? data.lastAppliedAt : Timestamp.now(),
        };
        
        return state;
      } else {
        // Initialize new credit state with total positive impact from transactions
        const totalPositiveImpact = calculateTotalPositiveImpact(transactionsCache.current);
        
        // Create new credit state
        console.log("Creating new credit state for user:", user.uid);
        const initialState: UserCreditState = {
          userId: user.uid,
          availableCredit: totalPositiveImpact,
          appliedCredit: 0,
          lastAppliedAmount: 0,
          lastAppliedAt: Timestamp.now(),
        };
        
        await setDoc(creditDocRef, initialState);
        return initialState;
      }
    } catch (err) {
      console.error("Error loading credit state:", err);
      setError(`Failed to load credit state: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  }, [user]);

  // Calculate available credit
  const calculateAvailableCredit = useCallback((currentTransactions: Transaction[]): number => {
    // Calculate total positive impact from current transactions
    const totalPositiveImpact = calculateTotalPositiveImpact(currentTransactions);
    
    // Subtract any applied credit from the credit state
    const appliedCredit = creditState?.appliedCredit || 0;
    console.log("appliedCredit", appliedCredit);
    return Math.max(0, totalPositiveImpact - appliedCredit);
  }, [creditState?.appliedCredit]);

  // Helper function to calculate total societal debt
  function calculateTotalDebt(currentTransactions: Transaction[]): number {
    return currentTransactions.reduce((total, tx) => {
      let debt = 0;
      if (tx.societalDebt && tx.societalDebt > 0) {
        debt = tx.societalDebt;
      } else if (tx.unethicalPractices && tx.unethicalPractices.length > 0) {
        tx.unethicalPractices.forEach(practice => {
          const weight = tx.practiceWeights?.[practice] || 0;
          debt += tx.amount * (weight / 100);
        });
      }
      return total + debt;
    }, 0);
  }

  // Helper function to calculate total positive impact
  function calculateTotalPositiveImpact(currentTransactions: Transaction[]): number {
    return currentTransactions.reduce((total, tx) => {
      let credit = 0;
      if (tx.societalDebt && tx.societalDebt < 0) {
        credit = Math.abs(tx.societalDebt);
      } else if (tx.ethicalPractices && tx.ethicalPractices.length > 0) {
        tx.ethicalPractices.forEach(practice => {
          const weight = tx.practiceWeights?.[practice] || 0;
          credit += tx.amount * (weight / 100);
        });
      }
      return total + credit;
    }, 0);
  }

  // Apply credit function - simplified!
  const applyCredit = useCallback(async (amount: number): Promise<boolean> => {
    if (!user || !creditState || amount <= 0) {
      console.error("Cannot apply credit - invalid parameters");
      return false;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Calculate how much credit we can actually apply
      // Only apply enough to cover the current debt
      const totalDebt = calculateTotalDebt(transactionsCache.current);
      const availableCredit = calculateAvailableCredit(transactionsCache.current);
      const creditToApply = Math.min(amount, totalDebt, availableCredit);
      
      console.log(`Applying ${creditToApply} credit (debt: ${totalDebt}, requested: ${amount}, available: ${availableCredit})`);
      
      if (creditToApply <= 0) {
        console.log("No credit to apply");
        setIsLoading(false);
        return false;
      }
      
      // Calculate remaining credit after application
      const remainingCredit = availableCredit - creditToApply;
      
      // Update credit state
      const updatedState: UserCreditState = {
        ...creditState,
        availableCredit: remainingCredit,
        appliedCredit: creditState.appliedCredit + creditToApply,
        lastAppliedAmount: creditToApply,
        lastAppliedAt: Timestamp.now()
      };
      
      // Update Firestore
      const creditDocRef = doc(db, "creditState", user.uid);
      await setDoc(creditDocRef, updatedState);
      
      // Update local state
      if (isMounted.current) {
        setCreditState(updatedState);
      }
      
      console.log(`Credit applied successfully. Remaining: ${remainingCredit}`);
      return true;
    } catch (err) {
      console.error("Error applying credit:", err);
      setError("Failed to apply credit");
      return false;
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  }, [user, creditState, calculateAvailableCredit]);

  // Refresh credit state
  const refreshCreditState = useCallback(async (): Promise<void> => {
    if (!user) return;
    
    try {
      const newState = await loadCreditState();
      if (isMounted.current && newState) {
        console.log("Refreshed credit state:", newState);
        setCreditState(newState);
      }
    } catch (err) {
      console.error("Error refreshing credit state:", err);
      if (isMounted.current) {
        setError(`Failed to refresh credit state: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }, [user, loadCreditState]);

  // Load initial credit state
  useEffect(() => {
    if (user) {
      refreshCreditState();
    } else {
      setCreditState(null);
    }
  }, [user, refreshCreditState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
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