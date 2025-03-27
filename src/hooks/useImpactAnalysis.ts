// src/features/analysis/useImpactAnalysis.ts
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Transaction } from '@/shared/types/transactions';
import { ImpactAnalysis } from '@/core/calculations/type';
import { calculationService } from '@/core/calculations/impactService';
import { useCreditState } from './useCreditState';
import { User } from 'firebase/auth';

interface UseImpactAnalysisResult {
  impactAnalysis: ImpactAnalysis | null;
  recalculateImpact: () => void;
  isApplyingCredit: boolean;
  applyCredit: (amount: number) => Promise<boolean>;
  negativeCategories: Array<{ name: string; amount: number }>;
  positiveCategories: Array<{ name: string; amount: number }>;
}

/**
 * A hook that combines calculation service with React state management
 * This provides reactive impact analysis calculations based on transactions and credit state
 */
export function useImpactAnalysis(
  transactions: Transaction[] | null,
  user: User | null
): UseImpactAnalysisResult {
  const [impactAnalysis, setImpactAnalysis] = useState<ImpactAnalysis | null>(null);
  const [isApplyingCredit, setIsApplyingCredit] = useState(false);
  const { creditState, applyCredit, refreshCreditState } = useCreditState(user, transactions);

  // Calculate categories for recommendations
  const { negativeCategories, positiveCategories } = useMemo(() => {
    if (!transactions || transactions.length === 0) return { negativeCategories: [], positiveCategories: [] };
    return {
      negativeCategories: calculationService.calculateNegativeCategories(transactions),
      positiveCategories: calculationService.calculatePositiveCategories(transactions)
    };
  }, [transactions]);

  // Force recalculation of impact
  const recalculateImpact = useCallback(() => {
    if (!transactions || transactions.length === 0) {
      setImpactAnalysis(null);
      return;
    }

    const appliedCredit = creditState?.appliedCredit || 0;
    
    // Calculate analysis with latest credit state
    const analysis = calculationService.calculateImpactAnalysis(transactions, appliedCredit);
    
    // No need for manual calculation - use the existing service
    if (creditState) {
      // The calculateImpactAnalysis already includes availableCredit calculation
      // If you need to adjust with additional business logic, you can do it here
    }
    
    setImpactAnalysis(analysis);
  }, [transactions, creditState]);

  // Apply credit to reduce societal debt
  const handleApplyCredit = async (amount: number): Promise<boolean> => {
    if (!user || amount <= 0) {
      return false;
    }

    setIsApplyingCredit(true);

    try {
      
      const success = await applyCredit(amount);
      if (success) {
        // Refresh credit state after successful application
        await refreshCreditState();
        
        // Recalculate impact analysis with new credit values
        recalculateImpact();
      }
      return success;
    } catch (error) {
      console.error("Error applying credit:", error);
      return false;
    } finally {
      setIsApplyingCredit(false);
    }
  };

  // Calculate impact analysis on transactions or credit state change
  useEffect(() => {
    recalculateImpact();
  }, [transactions, creditState, recalculateImpact]);

  return {
    impactAnalysis,
    recalculateImpact,
    isApplyingCredit,
    applyCredit: handleApplyCredit,
    negativeCategories,
    positiveCategories
  };
}