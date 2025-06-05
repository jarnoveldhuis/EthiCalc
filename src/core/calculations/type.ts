// src/core/calculations/type.ts

/**
 * The grand taxonomy of ethical accounting.
 * This structure reflects an automatically netted balance.
 */
export interface ImpactAnalysis {
  /** Total positive impact generated from ethical practices. */
  positiveImpact: number;

  /** Total negative impact from unethical practices, adjusted by user values. */
  negativeImpact: number;

  /**
   * The net ethical balance: positiveImpact - negativeImpact.
   * A positive value indicates an ethical surplus.
   * A negative value indicates an ethical debt.
   */
  netEthicalBalance: number;

  /**
   * The percentage of total spending that results in value-adjusted negative impact.
   * Calculated as (negativeImpact / totalSpending) * 100, if negativeImpact > 0.
   */
  debtPercentage: number;

  // Statistics
  totalTransactions: number;    // Total spending decisions judged
  transactionsWithDebt: number; // How many times transactions contributed to negative impact (post-value-adjustment)
  transactionsWithCredit: number; // How many times transactions contributed to positive impact
}

// These types can remain if they are used for other specific breakdowns,
// but are not directly part of the main ImpactAnalysis structure above.
export interface PracticeImpact {
  name: string;
  amount: number;
  isPositive: boolean;
}

export interface CategoryImpact {
  name: string;
  amount: number;
  practices: PracticeImpact[];
}