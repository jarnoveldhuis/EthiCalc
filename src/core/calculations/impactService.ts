// src/core/calculations/impactService.ts
import { Transaction } from '@/shared/types/transactions';
import { ImpactAnalysis } from '@/core/calculations/type';

/**
 * A consolidated service for all ethical calculations
 */
export const calculationService = {
  /**
   * Calculate negative impact (societal debt from unethical practices) - Overall
   */
  calculateNegativeImpact(transactions: Transaction[]): number {
    if (!transactions || transactions.length === 0) return 0;
    return transactions.reduce((total, tx) => {
      if (tx.isCreditApplication) return total;
      let transactionDebt = 0;
      if (tx.unethicalPractices && tx.unethicalPractices.length > 0) {
        tx.unethicalPractices.forEach(practice => {
          const weight = tx.practiceWeights?.[practice] || 0;
          transactionDebt += tx.amount * (weight / 100);
        });
      } else if (tx.societalDebt && tx.societalDebt > 0) {
        // Fallback if only societalDebt is present
        transactionDebt = tx.societalDebt;
      }
      return total + transactionDebt;
    }, 0);
  }, // Comma here

  /**
   * Calculate positive impact (ethical credit from ethical practices) - Overall
   */
  calculatePositiveImpact(transactions: Transaction[]): number {
    if (!transactions || transactions.length === 0) return 0;
    return transactions.reduce((total, tx) => {
      if (tx.creditApplied) return total; // Don't count credit already applied towards total positive impact earned
      let transactionCredit = 0;
      if (tx.ethicalPractices && tx.ethicalPractices.length > 0) {
        tx.ethicalPractices.forEach(practice => {
          const weight = tx.practiceWeights?.[practice] || 0;
          transactionCredit += tx.amount * (weight / 100);
        });
      } else if (tx.societalDebt && tx.societalDebt < 0) {
         // Fallback if only societalDebt is present and negative
        transactionCredit = Math.abs(tx.societalDebt);
      }
      return total + transactionCredit;
    }, 0);
  }, // Comma here

  /**
   * NEW: Calculate positive and negative impact aggregated by category, and total spending contributing to each category.
   */
  calculateCategoryImpacts(transactions: Transaction[]): Record<string, { positiveImpact: number; negativeImpact: number; totalSpent: number }> {
      if (!transactions || transactions.length === 0) return {};

      // Define categories - ensure these match categories used in analysis/data
      const categories = ["Environment", "Labor Ethics", "Animal Welfare", "Political Ethics", "Transparency", "Digital Rights", "Community Support"];
      const categoryValues: Record<string, { positiveImpact: number; negativeImpact: number; totalSpent: number; transactionIds: Set<string> }> = {};

      // Initialize structure for each category
      categories.forEach(cat => {
          categoryValues[cat] = { positiveImpact: 0, negativeImpact: 0, totalSpent: 0, transactionIds: new Set<string>() };
      });

      transactions.forEach((tx) => {
          const txId = tx.plaidTransactionId || `${tx.date}-${tx.name}-${tx.amount}`; // Unique ID for the transaction

          // Aggregate Negative Impact (Harm) per category
          (tx.unethicalPractices || []).forEach(practice => {
              const category = tx.practiceCategories?.[practice];
              // Check if the category is one we are tracking
              if (category && categoryValues[category]) {
                  const weight = tx.practiceWeights?.[practice] || 0;
                  const impactAmount = tx.amount * (weight / 100);
                  if (!isNaN(impactAmount)) {
                      categoryValues[category].negativeImpact += impactAmount;
                      categoryValues[category].transactionIds.add(txId); // Track contributing transaction
                  }
              }
          });

          // Aggregate Positive Impact (Help) per category
          (tx.ethicalPractices || []).forEach(practice => {
              const category = tx.practiceCategories?.[practice];
               // Check if the category is one we are tracking
              if (category && categoryValues[category]) {
                  const weight = tx.practiceWeights?.[practice] || 0;
                  const impactAmount = tx.amount * (weight / 100);
                  if (!isNaN(impactAmount)) {
                      categoryValues[category].positiveImpact += impactAmount;
                      categoryValues[category].transactionIds.add(txId); // Track contributing transaction
                  }
              }
          });
      });

      // Calculate totalSpent based on unique transactions contributing to each category
      Object.keys(categoryValues).forEach(category => {
          const contributingTransactions = new Map<string, number>();
           categoryValues[category].transactionIds.forEach(txId => {
                const contributingTx = transactions.find(tx => (tx.plaidTransactionId || `${tx.date}-${tx.name}-${tx.amount}`) === txId);
                if (contributingTx && !contributingTransactions.has(txId)) { // Ensure unique transaction amounts are added
                    contributingTransactions.set(txId, contributingTx.amount);
                }
           });
           // Sum the amounts of unique contributing transactions
          categoryValues[category].totalSpent = Array.from(contributingTransactions.values()).reduce((sum, amount) => sum + amount, 0);
      });


      // Prepare final result object without transactionIds
      const finalCategoryValues: Record<string, { positiveImpact: number; negativeImpact: number; totalSpent: number }> = {};
      Object.keys(categoryValues).forEach(cat => {
              finalCategoryValues[cat] = {
                  positiveImpact: categoryValues[cat].positiveImpact,
                  negativeImpact: categoryValues[cat].negativeImpact,
                  totalSpent: categoryValues[cat].totalSpent,
              };
   
      });

      return finalCategoryValues;
  }, // Add comma


  /**
   * Calculate net societal debt (negative - positive) - Overall
   * Note: This doesn't account for applied credit
   */
  calculateNetSocietalDebt(transactions: Transaction[]): number {
    const negativeImpact = this.calculateNegativeImpact(transactions);
    const positiveImpact = this.calculatePositiveImpact(transactions);
    // Note: This is raw difference, not capped at 0
    return negativeImpact - positiveImpact;
  }, // Comma here

  /**
   * Calculate available credit (overall positive impact minus already applied credit)
   */
  calculateAvailableCredit(transactions: Transaction[], appliedCredit: number = 0): number {
    const positiveImpact = this.calculatePositiveImpact(transactions);
    return Math.max(0, positiveImpact - appliedCredit);
  }, // Comma here

  /**
   * Calculate effective debt (overall negative impact after applied credit)
   */
  calculateEffectiveDebt(transactions: Transaction[], appliedCredit: number = 0): number {
    const negativeImpact = this.calculateNegativeImpact(transactions);
    return Math.max(0, negativeImpact - appliedCredit);
  }, // Comma here

  /**
   * Calculate overall debt percentage relative to total spending
   */
  calculateDebtPercentage(transactions: Transaction[]): number {
    if (!transactions || transactions.length === 0) return 0;
    const totalSpent = transactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);
    const totalDebt = this.calculateNegativeImpact(transactions); // Use overall negative impact
    return totalSpent > 0 ? (totalDebt / totalSpent) * 100 : 0;
  }, // Comma here

  /**
   * Calculate practice donations (legacy or potentially different aggregation)
   * Note: This structure might differ from calculateCategoryImpacts. Review if still needed.
   */
  calculatePracticeDonations(transactions: Transaction[]): Record<string, { charity: { name: string; url: string } | null; amount: number }> {
    if (!transactions || transactions.length === 0) return {};

    const donations: Record<string, { charity: { name: string; url: string } | null; amount: number }> = {};

    transactions.forEach((tx) => {
        // Aggregate debt per practice
        (tx.unethicalPractices || []).forEach((practice) => {
            if (!donations[practice]) {
                donations[practice] = { charity: tx.charities?.[practice] || null, amount: 0 };
            }
            const weight = tx.practiceWeights?.[practice] || 0;
            donations[practice].amount += tx.amount * (weight / 100);
        });
         // Aggregate credit per practice (subtracts from practice 'debt'/amount)
        (tx.ethicalPractices || []).forEach((practice) => {
            // This assumes ethical practices might offset debt *within the same practice name*, which might be complex.
            // Often, ethical practices are different names (e.g., 'Organic Farming' vs 'Pesticide Use').
            // Consider if a separate aggregation for positive practice impacts is needed.
            if (!donations[practice]) {
                 donations[practice] = { charity: tx.charities?.[practice] || null, amount: 0 };
            }
            const weight = tx.practiceWeights?.[practice] || 0;
            donations[practice].amount -= tx.amount * (weight / 100); // Subtracts credit
        });
    });
    return donations;
  }, // Comma here

  /**
   * Generate a complete overall impact analysis (using overall functions)
   */
  calculateImpactAnalysis(transactions: Transaction[], appliedCredit: number = 0): ImpactAnalysis {
    const negativeImpact = this.calculateNegativeImpact(transactions);
    const positiveImpact = this.calculatePositiveImpact(transactions);
    const netSocietalDebt = negativeImpact - positiveImpact; // Raw difference
    const effectiveDebt = this.calculateEffectiveDebt(transactions, appliedCredit); // Debt remaining after credit
    const debtPercentage = this.calculateDebtPercentage(transactions);
    const availableCredit = this.calculateAvailableCredit(transactions, appliedCredit); // Credit available to apply

    return {
      negativeImpact,
      positiveImpact,
      netSocietalDebt,
      effectiveDebt,
      debtPercentage,
      appliedCredit,
      availableCredit,
      totalTransactions: transactions.length,
      transactionsWithDebt: transactions.filter(tx => (tx.unethicalPractices && tx.unethicalPractices.length > 0) || (tx.societalDebt && tx.societalDebt > 0)).length,
      transactionsWithCredit: transactions.filter(tx => (tx.ethicalPractices && tx.ethicalPractices.length > 0) || (tx.societalDebt && tx.societalDebt < 0)).length
    };
  }, // Comma here

  /**
   * Calculate top negative categories based on impact amount
   */
  calculateNegativeCategories(transactions: Transaction[]): Array<{ name: string; amount: number }> {
    const categories: Record<string, number> = {};
    transactions.forEach((tx) => {
      if (!tx.unethicalPractices || !tx.practiceCategories) return;
      tx.unethicalPractices.forEach((practice) => {
        const category = tx.practiceCategories?.[practice];
        if (category) {
          const weight = tx.practiceWeights?.[practice] || 0; // Use 0 if weight missing
          const impact = (tx.amount || 0) * (weight / 100);
          if (!isNaN(impact)) {
              categories[category] = (categories[category] || 0) + impact;
          }
        }
      });
    });
    return Object.entries(categories)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount) // Sort descending by amount
      .slice(0, 5); // Return top 5 or fewer
  }, // Comma here

  /**
   * Calculate top positive categories based on impact amount
   */
  calculatePositiveCategories(transactions: Transaction[]): Array<{ name: string; amount: number }> {
    const categories: Record<string, number> = {};
    transactions.forEach((tx) => {
      if (!tx.ethicalPractices || !tx.practiceCategories) return;
      tx.ethicalPractices.forEach((practice) => {
        const category = tx.practiceCategories?.[practice];
        if (category) {
          const weight = tx.practiceWeights?.[practice] || 0; // Use 0 if weight missing
          const impact = (tx.amount || 0) * (weight / 100);
           if (!isNaN(impact)) {
             categories[category] = (categories[category] || 0) + impact;
           }
        }
      });
    });
    return Object.entries(categories)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount) // Sort descending by amount
      .slice(0, 5); // Return top 5 or fewer
  } // No comma needed for the last function in the object
};

// --- Helper Functions (can be kept if used elsewhere, or removed if only used internally) ---

// Example: Color function (might be in a UI utils file)
export function getColorClass(value: number): string {
  if (value < 0) return "text-green-600"; // Credit/benefit
  if (value === 0) return "text-blue-600"; // Neutral
  if (value <= 10) return "text-yellow-600"; // Minor debt
  if (value <= 20) return "text-orange-600"; // Moderate debt
  if (value <= 50) return "text-red-600"; // Significant debt
  return "text-red-700"; // High debt
}