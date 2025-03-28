// src/hooks/useImpactAnalysis.ts
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

export function useImpactAnalysis(
  transactions: Transaction[] | null,
  user: User | null
): UseImpactAnalysisResult {
  const [impactAnalysis, setImpactAnalysis] = useState<ImpactAnalysis | null>(null);
  const [isApplyingCredit, setIsApplyingCredit] = useState(false);
  
  const { 
    creditState, 
    applyCredit: applyCreditBase, 
    refreshCreditState,
    calculateAvailableCredit
  } = useCreditState(user, transactions);

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

    // Get applied credit amount from Firestore state
    const appliedCredit = creditState?.appliedCredit || 0;
    console.log("Recalculating impact with applied credit:", appliedCredit);
    
    // Use the service to calculate impact
    const analysis = calculationService.calculateImpactAnalysis(transactions, appliedCredit);
    
    // Set available credit from credit state
    if (creditState) {
      // Get available credit from credit state
      const available = calculateAvailableCredit(transactions);
      
      // Update the analysis with available credit
      analysis.availableCredit = available;
      
      console.log("Impact analysis calculated:", {
        totalPositive: analysis.positiveImpact,
        availableCredit: available,
        appliedCredit,
        effectiveDebt: analysis.effectiveDebt
      });
    }
    
    setImpactAnalysis(analysis);
  }, [transactions, creditState, calculateAvailableCredit]);

  // Apply credit handler - simplified!
  const handleApplyCredit = async (amount: number): Promise<boolean> => {
    if (!user || amount <= 0 || isApplyingCredit) {
      console.warn("Cannot apply credit - invalid parameters");
      return false;
    }
    
    // Don't allow applying if no impact analysis or more than available
    if (!impactAnalysis || impactAnalysis.availableCredit < amount) {
      console.warn(`Cannot apply ${amount} credit - only ${impactAnalysis?.availableCredit || 0} available`);
      return false;
    }

    setIsApplyingCredit(true);
    console.log(`Applying credit amount: ${amount}`);

    try {
      // Apply credit
      const success = await applyCreditBase(amount);
      
      if (success) {
        console.log("Credit applied successfully, refreshing state");
        
        // Refresh credit state
        await refreshCreditState();
        
        // Recalculate impact
        recalculateImpact();
        
        return true;
      } else {
        console.error("Failed to apply credit");
        return false;
      }
    } catch (error) {
      console.error("Error applying credit:", error);
      return false;
    } finally {
      setIsApplyingCredit(false);
    }
  };

  // Calculate impact analysis when transactions or credit state changes
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