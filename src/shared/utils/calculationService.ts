import { Transaction } from '@/shared/types/transactions';

/**
 * A consolidated service for all ethical calculations
 * Because apparently calculating guilt once wasn't traumatic enough
 */
export const calculationService = {
  /**
   * Calculate negative impact (societal debt from unethical practices)
   */
  calculateNegativeImpact(transactions: Transaction[]): number {
    if (!transactions || transactions.length === 0) return 0;
    
    return transactions.reduce((total, tx) => {
      // Skip credit applications
      if (tx.isCreditApplication) return total;
      
      let transactionDebt = 0;
      
      // If we have detailed practice information
      if (tx.unethicalPractices && tx.unethicalPractices.length > 0) {
        tx.unethicalPractices.forEach(practice => {
          const weight = tx.practiceWeights?.[practice] || 0;
          transactionDebt += tx.amount * (weight / 100);
        });
      } 
      // If we just have overall societal debt
      else if (tx.societalDebt && tx.societalDebt > 0) {
        transactionDebt = tx.societalDebt;
      }
      
      return total + transactionDebt;
    }, 0);
  },

  /**
   * Calculate positive impact (ethical credit from ethical practices)
   */
  calculatePositiveImpact(transactions: Transaction[]): number {
    if (!transactions || transactions.length === 0) return 0;
    
    return transactions.reduce((total, tx) => {
      // Skip if credit has already been applied to this transaction
      if (tx.creditApplied) return total;
      
      let transactionCredit = 0;
      
      // If we have detailed practice information
      if (tx.ethicalPractices && tx.ethicalPractices.length > 0) {
        tx.ethicalPractices.forEach(practice => {
          const weight = tx.practiceWeights?.[practice] || 0;
          transactionCredit += tx.amount * (weight / 100);
        });
      } 
      // If we just have overall societal debt that's negative (credit)
      else if (tx.societalDebt && tx.societalDebt < 0) {
        transactionCredit = Math.abs(tx.societalDebt);
      }
      
      return total + transactionCredit;
    }, 0);
  },

  /**
   * Calculate net societal debt (negative - positive - applied)
   */
  calculateNetSocietalDebt(transactions: Transaction[]): number {
    const negativeImpact = this.calculateNegativeImpact(transactions);
    const positiveImpact = this.calculatePositiveImpact(transactions);
    
    // Applied credit reduces the debt
    return negativeImpact - positiveImpact;
  },

  /**
   * Calculate available credit (positive impact minus already applied credit)
   */
  calculateAvailableCredit(transactions: Transaction[], appliedCredit: number = 0): number {
    const positiveImpact = this.calculatePositiveImpact(transactions);
    // Available credit is what's left after we've already applied some
    return Math.max(0, positiveImpact - appliedCredit);
  },

  /**
   * Calculate effective debt (debt after applied credit)
   */
  calculateEffectiveDebt(transactions: Transaction[], appliedCredit: number = 0): number {
    const negativeImpact = this.calculateNegativeImpact(transactions);
    return Math.max(0, negativeImpact - appliedCredit);
  },

  /**
   * Calculate debt percentage relative to total spending
   */
  calculateDebtPercentage(transactions: Transaction[]): number {
    if (!transactions || transactions.length === 0) return 0;
    
    const totalSpent = transactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);
    const totalDebt = this.calculateNegativeImpact(transactions);
    
    return totalSpent > 0 ? (totalDebt / totalSpent) * 100 : 0;
  },

  /**
   * Calculate practice donations (the emotional labor of offsetting guilt)
   */
  calculatePracticeDonations(transactions: Transaction[]): Record<string, { charity: { name: string; url: string } | null; amount: number }> {
    if (!transactions || transactions.length === 0) {
      return {};
    }

    const donations: Record<string, { charity: { name: string; url: string } | null; amount: number }> = {};

    transactions.forEach((tx) => {
      // Process unethical practices
      (tx.unethicalPractices || []).forEach((practice) => {
        if (!donations[practice]) {
          donations[practice] = {
            charity: tx.charities?.[practice] || null,
            amount: 0,
          };
        }

        // Add the debt amount for this practice
        const weight = tx.practiceWeights?.[practice] || 0;
        donations[practice].amount += tx.amount * (weight / 100);
      });

      // Process ethical practices (negative debt)
      (tx.ethicalPractices || []).forEach((practice) => {
        if (!donations[practice]) {
          donations[practice] = {
            charity: tx.charities?.[practice] || null,
            amount: 0,
          };
        }

        // Subtract the credit amount for this practice
        const weight = tx.practiceWeights?.[practice] || 0;
        donations[practice].amount -= tx.amount * (weight / 100);
      });
    });

    return donations;
  },

  /**
   * Generate a complete impact analysis
   */
  calculateImpactAnalysis(transactions: Transaction[], appliedCredit: number = 0) {
    const negativeImpact = this.calculateNegativeImpact(transactions);
    const positiveImpact = this.calculatePositiveImpact(transactions);
    const netSocietalDebt = negativeImpact - positiveImpact;
    const effectiveDebt = Math.max(0, negativeImpact - appliedCredit);
    const debtPercentage = this.calculateDebtPercentage(transactions);
    const availableCredit = Math.max(0, positiveImpact - appliedCredit);
    
    return {
      negativeImpact,
      positiveImpact,
      netSocietalDebt,
      effectiveDebt,
      debtPercentage,
      appliedCredit,
      availableCredit,
      // Statistics for transparency
      totalTransactions: transactions.length,
      transactionsWithDebt: transactions.filter(tx => 
        (tx.unethicalPractices && tx.unethicalPractices.length > 0) || 
        (tx.societalDebt && tx.societalDebt > 0)
      ).length,
      transactionsWithCredit: transactions.filter(tx => 
        (tx.ethicalPractices && tx.ethicalPractices.length > 0) || 
        (tx.societalDebt && tx.societalDebt < 0)
      ).length
    };
  },

  /**
   * Calculate top negative categories for guilt-induced recommendations
   */
  calculateNegativeCategories(transactions: Transaction[]): Array<{ name: string; amount: number }> {
    const categories: Record<string, number> = {};

    // Group by category
    transactions.forEach((tx) => {
      // Skip if no unethical practices or no practice categories
      if (!tx.unethicalPractices || !tx.practiceCategories) return;

      // Group by category
      tx.unethicalPractices.forEach((practice) => {
        const category = tx.practiceCategories?.[practice];
        if (category) {
          // Get practice weight or default to 10%
          const weight = tx.practiceWeights?.[practice] || 10;
          const impact = (tx.amount || 0) * (weight / 100);

          // Add to category total
          categories[category] = (categories[category] || 0) + impact;
        }
      });
    });

    // Convert to array and sort
    return Object.entries(categories)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3); // Top 3 categories
  }
};

// For those moments when we need to add emotional color to our ethical failings
export function getColorClass(value: number): string {
  if (value < 0) return "text-green-600"; // Virtue signaling
  if (value === 0) return "text-blue-600"; // Ethical Switzerland
  if (value <= 10) return "text-yellow-600"; // Minor moral infractions
  if (value <= 20) return "text-orange-600"; // Problematic behavior
  if (value <= 50) return "text-red-600"; // Significant ethical problems
  return "text-red-700"; // Full-blown moral catastrophe
}