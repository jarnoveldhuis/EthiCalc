// src/features/analysis/calculateImpactScore.ts
import { Transaction } from "@/shared/types/transactions";

/**
 * Calculate an impact score based on transactions
 * Formula: (neutral impact + (negative impact * 2)) / positive impact
 * Higher scores indicate worse ethical impact
 */
export function calculateImpactScore(transactions: Transaction[]): number {
  if (!transactions || transactions.length === 0) {
    return 0;
  }
  
  let positiveImpact = 0;
  let negativeImpact = 0;
  let neutralImpact = 0;
  
  // Process each transaction
  transactions.forEach(transaction => {
    // Skip transactions without analysis
    if (!transaction.practiceDebts && !transaction.societalDebt) {
      return;
    }
    
    // If we have detailed practice debts, use those
    if (transaction.practiceDebts) {
      Object.values(transaction.practiceDebts).forEach(debtValue => {
        if (debtValue < 0) {
          // Negative debt value = positive ethical impact
          positiveImpact += Math.abs(debtValue);
        } else if (debtValue > 0) {
          // Positive debt value = negative ethical impact
          negativeImpact += debtValue;
        }
      });
    } 
    // Otherwise use the overall societal debt
    else if (transaction.societalDebt !== undefined) {
      if (transaction.societalDebt < 0) {
        positiveImpact += Math.abs(transaction.societalDebt);
      } else if (transaction.societalDebt > 0) {
        negativeImpact += transaction.societalDebt;
      } else {
        neutralImpact += transaction.amount || 0;
      }
    } 
    // If no debt calculations, consider it neutral
    else {
      neutralImpact += transaction.amount || 0;
    }
  });
  
  // Ensure we don't divide by zero
  if (positiveImpact === 0) {
    // If no positive impact, score based only on negative + neutral
    // Higher values = worse scores
    return neutralImpact + (negativeImpact * 2);
  }
  
  // Calculate score using the formula
  const rawScore = (neutralImpact + (negativeImpact * 2)) / positiveImpact;
  
  // Scale the score to a 0-100 range for better UX
  // Values over 100 are possible for very unethical spending patterns
  const scaledScore = Math.min(100, Math.round(rawScore * 25));
  
  return scaledScore;
}