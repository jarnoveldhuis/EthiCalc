/**
 * The grand taxonomy of ethical accounting
 * Because categorizing guilt makes it more manageable
 */

export interface ImpactAnalysis {
    negativeImpact: number;       // The collective weight of your ethical failures
    positiveImpact: number;       // Your pathetic attempts at redemption
    netSocietalDebt: number;      // The final judgment (negative - positive - applied)
    effectiveDebt: number;        // What you still owe to society
    debtPercentage: number;       // Your guilt as a percentage of consumption
    appliedCredit: number;        // How much you've already atoned for
    availableCredit: number;      // How much more you could atone for if you tried
    totalTransactions: number;    // Total spending decisions judged
    transactionsWithDebt: number; // How many times you ethically failed
    transactionsWithCredit: number; // Your occasional moments of virtue
  }
  
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