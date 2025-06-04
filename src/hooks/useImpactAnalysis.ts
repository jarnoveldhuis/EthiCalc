// src/hooks/useImpactAnalysis.ts
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Transaction } from '@/shared/types/transactions';
import { ImpactAnalysis } from '@/core/calculations/type';
import { calculationService } from '@/core/calculations/impactService';
import { User } from 'firebase/auth';

interface UseImpactAnalysisResult {
  impactAnalysis: ImpactAnalysis | null;
  recalculateImpact: () => void;
  negativeCategories: Array<{ name: string; amount: number }>;
  positiveCategories: Array<{ name: string; amount: number }>;
}

export function useImpactAnalysis(
  transactions: Transaction[] | null,
  _user: User | null
): UseImpactAnalysisResult {
  const [impactAnalysis, setImpactAnalysis] = useState<ImpactAnalysis | null>(null);

  // Calculate categories for recommendations
  const { negativeCategories, positiveCategories } = useMemo(() => {
    if (!transactions || transactions.length === 0) {
      return { negativeCategories: [], positiveCategories: [] };
    }
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

    const analysis = calculationService.calculateImpactAnalysis(transactions);
    setImpactAnalysis(analysis);
  }, [transactions]);

  // Calculate impact analysis when transactions change
  useEffect(() => {
    recalculateImpact();
  }, [transactions, recalculateImpact]);

  return {
    impactAnalysis,
    recalculateImpact,
    negativeCategories,
    positiveCategories
  };
}