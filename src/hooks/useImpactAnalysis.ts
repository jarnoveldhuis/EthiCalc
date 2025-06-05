// src/hooks/useImpactAnalysis.ts
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Transaction } from '@/shared/types/transactions';
import { ImpactAnalysis } from '@/core/calculations/type';
import { calculationService } from '@/core/calculations/impactService';
// User import is no longer needed here: import { User } from 'firebase/auth';
import { useTransactionStore } from '@/store/transactionStore';

interface UseImpactAnalysisResult {
  impactAnalysis: ImpactAnalysis | null;
  recalculateImpact: () => void;
  negativeCategories: Array<{ name: string; amount: number }>;
  positiveCategories: Array<{ name: string; amount: number }>;
}

export function useImpactAnalysis(
  transactions: Transaction[] | null
  // user: User | null // REMOVED user parameter
): UseImpactAnalysisResult {
  const [impactAnalysis, setImpactAnalysis] = useState<ImpactAnalysis | null>(null);
  const userValueSettings = useTransactionStore((state) => state.userValueSettings);

  const { negativeCategories, positiveCategories } = useMemo(() => {
    if (!transactions || transactions.length === 0) {
      return { negativeCategories: [], positiveCategories: [] };
    }
    return {
      negativeCategories: calculationService.calculateNegativeCategories(transactions, userValueSettings),
      positiveCategories: calculationService.calculatePositiveCategories(transactions)
    };
  }, [transactions, userValueSettings]);

  const recalculateImpact = useCallback(() => {
    if (!transactions || transactions.length === 0) {
      setImpactAnalysis(null);
      return;
    }
    const analysis = calculationService.calculateImpactAnalysis(
      transactions,
      userValueSettings
    );
    console.log("[useImpactAnalysis] Recalculated impact analysis:", analysis);
    setImpactAnalysis(analysis);
  }, [transactions, userValueSettings]);

  useEffect(() => {
    console.log("[useImpactAnalysis] Transactions or userValueSettings changed, recalculating impact.");
    recalculateImpact();
  }, [transactions, userValueSettings, recalculateImpact]);

  return {
    impactAnalysis,
    recalculateImpact,
    negativeCategories,
    positiveCategories,
  };
}