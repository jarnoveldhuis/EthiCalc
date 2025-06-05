// src/core/calculations/impactService.ts
import { Transaction } from "@/shared/types/transactions";
import { ImpactAnalysis } from "@/core/calculations/type"; // Updated type
import { UserValueSettings } from "@/store/transactionStore";
import {
  NEGATIVE_PRACTICE_MULTIPLIERS,
  NEUTRAL_LEVEL,
  VALUE_CATEGORIES,
} from "@/config/valuesConfig";

// Helper function to get the multiplier based on user's value settings for a category.
const getNegativePracticeMultiplierForCategory = (
  practiceCategoryName: string | undefined,
  userValueSettings: UserValueSettings
): number => {
  if (!practiceCategoryName) return 1.0; // Default multiplier if no category
  const categoryDefinition = VALUE_CATEGORIES.find(
    (catDef) => catDef.name === practiceCategoryName
  );
  if (!categoryDefinition) return 1.0; // Default if category definition not found

  // Use the user's level for this category's ID, or the neutral level if not set.
  const userLevel = userValueSettings[categoryDefinition.id] || NEUTRAL_LEVEL;
  // Return the multiplier for that level, or 0 if not defined (should not happen with current config).
  return NEGATIVE_PRACTICE_MULTIPLIERS[userLevel] || 0;
};

export const calculationService = {
  /**
   * Calculates the total negative impact from transactions, adjusted by user values.
   */
  calculateNegativeImpact(
    transactions: Transaction[],
    userValueSettings?: UserValueSettings
  ): number {
    if (!transactions || transactions.length === 0) return 0;

    return transactions.reduce((totalTransactionDebt, tx) => {
      // Skip transactions that are credit applications themselves
      if (tx.isCreditApplication) return totalTransactionDebt;

      let currentTxNegativeImpact = 0;
      if (tx.unethicalPractices && tx.unethicalPractices.length > 0) {
        tx.unethicalPractices.forEach((practice) => {
          const weight = tx.practiceWeights?.[practice] || 0; // Default to 0 if no weight
          const basePracticeDebt = tx.amount * (weight / 100);
          let multiplier = 1.0; // Default multiplier

          // Apply user value settings if provided
          if (userValueSettings) {
            const practiceCategoryName = tx.practiceCategories?.[practice];
            multiplier = getNegativePracticeMultiplierForCategory(
              practiceCategoryName,
              userValueSettings
            );
          }
          currentTxNegativeImpact += basePracticeDebt * multiplier;
        });
      } else if (tx.societalDebt && tx.societalDebt > 0) {
        // Fallback for older data structure if societalDebt is directly assigned
        // Assuming this societalDebt is pre-value-adjusted or needs similar logic
        let directDebtMultiplier = 1.0;
        if (userValueSettings && tx.practiceCategories && tx.unethicalPractices?.[0]) {
            // Attempt to find a category for general societal debt if possible
            // This part might need refinement based on how general societalDebt is categorized
             const practiceCategoryName = tx.practiceCategories[tx.unethicalPractices[0]];
             directDebtMultiplier = getNegativePracticeMultiplierForCategory(practiceCategoryName, userValueSettings);
        }
        currentTxNegativeImpact += tx.societalDebt * directDebtMultiplier;
      }
      return totalTransactionDebt + currentTxNegativeImpact;
    }, 0);
  },

  /**
   * Calculates the total positive impact from transactions.
   * Positive impacts are not adjusted by user values in the current model.
   */
  calculatePositiveImpact(transactions: Transaction[]): number {
    if (!transactions || transactions.length === 0) return 0;

    return transactions.reduce((total, tx) => {
      // Skip if this transaction was applying credit (though this concept is changing)
      if (tx.creditApplied) return total;

      let transactionCredit = 0;
      if (tx.ethicalPractices && tx.ethicalPractices.length > 0) {
        tx.ethicalPractices.forEach((practice) => {
          const weight = tx.practiceWeights?.[practice] || 0;
          transactionCredit += tx.amount * (weight / 100);
        });
      } else if (tx.societalDebt && tx.societalDebt < 0) {
        // Fallback for older data: if societalDebt is negative, it's a positive impact
        transactionCredit = Math.abs(tx.societalDebt);
      }
      return total + transactionCredit;
    }, 0);
  },

  /**
   * Calculates and returns the overall impact analysis based on the new structure.
   */
  calculateImpactAnalysis(
    transactions: Transaction[],
    userValueSettings?: UserValueSettings // User settings are now primary for negative impact calculation
  ): ImpactAnalysis {
    const calculatedNegativeImpact = this.calculateNegativeImpact(
      transactions,
      userValueSettings
    );
    const calculatedPositiveImpact = this.calculatePositiveImpact(transactions);

    const netEthicalBalance = calculatedPositiveImpact - calculatedNegativeImpact;

    const totalSpentExcludingCreditApplications = transactions
      .filter((tx) => !tx.isCreditApplication) // Ensure credit applications don't count as "spending"
      .reduce((sum, tx) => sum + (tx.amount || 0), 0);

    const debtPercentage =
      totalSpentExcludingCreditApplications > 0 && calculatedNegativeImpact > 0
        ? (calculatedNegativeImpact / totalSpentExcludingCreditApplications) * 100
        : 0;

    return {
      positiveImpact: calculatedPositiveImpact,
      negativeImpact: calculatedNegativeImpact,
      netEthicalBalance: netEthicalBalance,
      debtPercentage: debtPercentage,
      totalTransactions: transactions.length,
      transactionsWithDebt: transactions.filter(tx => {
        // Recalculate this transaction's specific value-adjusted negative impact
        // to see if it contributes to overall negative impact.
        // This is a bit simplified; for perfect accuracy, we'd re-run a mini-negative calc.
        // Or, this count can be based on whether a transaction *has* unethical practices
        // and its category-adjusted multiplier isn't zero.
        if (tx.isCreditApplication) return false;
        let txSpecificNegativeImpact = 0;
        if (tx.unethicalPractices && tx.unethicalPractices.length > 0) {
            tx.unethicalPractices.forEach(practice => {
                const weight = tx.practiceWeights?.[practice] || 0;
                const baseDebt = tx.amount * (weight / 100);
                let multiplier = 1.0;
                if (userValueSettings) {
                    const categoryName = tx.practiceCategories?.[practice];
                    multiplier = getNegativePracticeMultiplierForCategory(categoryName, userValueSettings);
                }
                txSpecificNegativeImpact += baseDebt * multiplier;
            });
        } else if (tx.societalDebt && tx.societalDebt > 0) {
            // Simplified fallback check
             txSpecificNegativeImpact = tx.societalDebt;
        }
        return txSpecificNegativeImpact > 0.005; // Threshold to count
    }).length,
      transactionsWithCredit: transactions.filter(
        (tx) =>
          !tx.creditApplied && // Ensure it's not a credit application itself
          ((tx.ethicalPractices && tx.ethicalPractices.length > 0) ||
          (tx.societalDebt && tx.societalDebt < 0))
      ).length,
    };
  },

  /**
   * Calculates positive and negative impacts grouped by category.
   * Negative impacts are adjusted by userValueSettings.
   */
  calculateCategoryImpacts(
    transactions: Transaction[],
    userValueSettings?: UserValueSettings
  ): Record<
    string,
    { positiveImpact: number; negativeImpact: number; totalSpent: number }
  > {
    if (!transactions || transactions.length === 0) return {};

    const categoryNamesFromConfig = VALUE_CATEGORIES.map((vc) => vc.name);
    const categoryTotals: Record<
      string,
      {
        positiveImpact: number;
        negativeImpact: number;
        totalSpentOnCategory: number; // Total amount spent on transactions contributing to this category's impact
        contributingTransactionIds: Set<string>; // To avoid double-counting spending
      }
    > = {};

    categoryNamesFromConfig.forEach((catName) => {
      categoryTotals[catName] = {
        positiveImpact: 0,
        negativeImpact: 0,
        totalSpentOnCategory: 0,
        contributingTransactionIds: new Set<string>(),
      };
    });

    transactions.forEach((tx) => {
      if (tx.isCreditApplication) return; // Skip credit applications

      const txIdentifier = tx.plaidTransactionId || `${tx.date}-${tx.name}-${tx.amount}`;

      // Process unethical practices for negative impact
      (tx.unethicalPractices || []).forEach((practice) => {
        const practiceCategoryName = tx.practiceCategories?.[practice];
        if (practiceCategoryName && categoryTotals[practiceCategoryName]) {
          const weight = tx.practiceWeights?.[practice] || 0;
          const baseImpactAmount = tx.amount * (weight / 100);
          let multiplier = 1.0;
          if (userValueSettings) {
            multiplier = getNegativePracticeMultiplierForCategory(
              practiceCategoryName,
              userValueSettings
            );
          }
          const finalImpactAmount = baseImpactAmount * multiplier;

          if (!isNaN(finalImpactAmount) && Math.abs(finalImpactAmount) > 0.005) {
            categoryTotals[practiceCategoryName].negativeImpact += finalImpactAmount;
            categoryTotals[practiceCategoryName].contributingTransactionIds.add(txIdentifier);
          }
        }
      });

      // Process ethical practices for positive impact
      (tx.ethicalPractices || []).forEach((practice) => {
        const practiceCategoryName = tx.practiceCategories?.[practice];
        if (practiceCategoryName && categoryTotals[practiceCategoryName]) {
          const weight = tx.practiceWeights?.[practice] || 0;
          const impactAmount = tx.amount * (weight / 100); // Positive impacts don't use user value multipliers currently

          if (!isNaN(impactAmount) && Math.abs(impactAmount) > 0.005) {
            categoryTotals[practiceCategoryName].positiveImpact += impactAmount;
            categoryTotals[practiceCategoryName].contributingTransactionIds.add(txIdentifier);
          }
        }
      });
    });

    // Calculate total spent for each category based on unique contributing transactions
    Object.keys(categoryTotals).forEach((catName) => {
      const uniqueTxAmounts = new Map<string, number>();
      categoryTotals[catName].contributingTransactionIds.forEach((txId) => {
        const contributingTx = transactions.find(
          (tx) => (tx.plaidTransactionId || `${tx.date}-${tx.name}-${tx.amount}`) === txId
        );
        if (contributingTx && !uniqueTxAmounts.has(txId)) {
          uniqueTxAmounts.set(txId, contributingTx.amount);
        }
      });
      categoryTotals[catName].totalSpentOnCategory = Array.from(uniqueTxAmounts.values())
        .reduce((sum, amount) => sum + amount, 0);
    });

    const finalResult: Record<string, { positiveImpact: number; negativeImpact: number; totalSpent: number }> = {};
    categoryNamesFromConfig.forEach((catName) => {
      finalResult[catName] = {
        positiveImpact: categoryTotals[catName].positiveImpact,
        negativeImpact: categoryTotals[catName].negativeImpact,
        totalSpent: categoryTotals[catName].totalSpentOnCategory,
      };
    });
    return finalResult;
  },

  /**
   * Calculates top 5 categories contributing to negative impact.
   */
  calculateNegativeCategories(
    transactions: Transaction[],
    userValueSettings?: UserValueSettings
  ): Array<{ name: string; amount: number }> {
    const categoryImpacts = this.calculateCategoryImpacts(
      transactions,
      userValueSettings
    );
    return Object.entries(categoryImpacts)
      .filter((entry) => entry[1].negativeImpact > 0.005) // entry[1] is the impact object
      .map(([name, impactData]) => ({
        name,
        amount: impactData.negativeImpact,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  },

  /**
   * Calculates top 5 categories contributing to positive impact.
   */
  calculatePositiveCategories(
    transactions: Transaction[]
    // No userValueSettings needed as positive impact isn't currently value-adjusted
  ): Array<{ name: string; amount: number }> {
    const categoryImpacts = this.calculateCategoryImpacts(transactions); // No user settings needed here
    return Object.entries(categoryImpacts)
      .filter((entry) => entry[1].positiveImpact > 0.005) // entry[1] is the impact object
      .map(([name, impactData]) => ({
        name,
        amount: impactData.positiveImpact,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  },
};