// src/core/calculations/impactService.ts
import { Transaction } from "@/shared/types/transactions";
import { ImpactAnalysis } from "@/core/calculations/type";
import { UserValueSettings } from "@/store/transactionStore";
import {
  NEGATIVE_PRACTICE_MULTIPLIERS,
  NEUTRAL_LEVEL,
  VALUE_CATEGORIES,
} from "@/config/valuesConfig";

// Helper function (remains the same)
const getNegativePracticeMultiplierForCategory = (
  practiceCategoryName: string | undefined,
  userValueSettings: UserValueSettings
): number => {
  if (!practiceCategoryName) return 1.0;
  const categoryDefinition = VALUE_CATEGORIES.find(
    (catDef) => catDef.name === practiceCategoryName
  );
  if (!categoryDefinition) return 1.0;
  const userLevel = userValueSettings[categoryDefinition.id] || NEUTRAL_LEVEL;
  return NEGATIVE_PRACTICE_MULTIPLIERS[userLevel] || 1.0;
};

// src/core/calculations/impactService.ts LINT FIX

// ... (imports and helper function remain the same) ...

export const calculationService = {
  // ... (calculateNegativeImpact, calculatePositiveImpact, calculateCategoryImpacts, calculateImpactAnalysis remain the same) ...
  calculateNegativeImpact(
    transactions: Transaction[],
    userValueSettings?: UserValueSettings
  ): number {
    /* ... */ if (!transactions || transactions.length === 0) return 0;
    return transactions.reduce((totalTransactionDebt, tx) => {
      if (tx.isCreditApplication) return totalTransactionDebt;
      let currentTxNegativeImpact = 0;
      if (tx.unethicalPractices && tx.unethicalPractices.length > 0) {
        tx.unethicalPractices.forEach((practice) => {
          const weight = tx.practiceWeights?.[practice] || 0;
          const basePracticeDebt = tx.amount * (weight / 100);
          let multiplier = 1.0;
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
        currentTxNegativeImpact += tx.societalDebt;
      }
      return totalTransactionDebt + currentTxNegativeImpact;
    }, 0);
  },
  calculatePositiveImpact(transactions: Transaction[]): number {
    /* ... */ if (!transactions || transactions.length === 0) return 0;
    return transactions.reduce((total, tx) => {
      if (tx.creditApplied) return total;
      let transactionCredit = 0;
      if (tx.ethicalPractices && tx.ethicalPractices.length > 0) {
        tx.ethicalPractices.forEach((practice) => {
          const weight = tx.practiceWeights?.[practice] || 0;
          transactionCredit += tx.amount * (weight / 100);
        });
      } else if (tx.societalDebt && tx.societalDebt < 0) {
        transactionCredit = Math.abs(tx.societalDebt);
      }
      return total + transactionCredit;
    }, 0);
  },
  calculateCategoryImpacts(
    transactions: Transaction[],
    userValueSettings?: UserValueSettings
  ): Record<
    string,
    { positiveImpact: number; negativeImpact: number; totalSpent: number }
  > {
    /* ... */ if (!transactions || transactions.length === 0) return {};
    const categoryNamesFromConfig = VALUE_CATEGORIES.map((vc) => vc.name);
    const categoryTotals: Record<
      string,
      {
        positiveImpact: number;
        negativeImpact: number;
        totalSpentOnCategory: number;
        contributingTransactionIds: Set<string>;
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
      const txIdentifier =
        tx.plaidTransactionId || `${tx.date}-${tx.name}-${tx.amount}`;
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
          if (
            !isNaN(finalImpactAmount) &&
            Math.abs(finalImpactAmount) > 0.005
          ) {
            categoryTotals[practiceCategoryName].negativeImpact +=
              finalImpactAmount;
            categoryTotals[practiceCategoryName].contributingTransactionIds.add(
              txIdentifier
            );
          }
        }
      });
      (tx.ethicalPractices || []).forEach((practice) => {
        const practiceCategoryName = tx.practiceCategories?.[practice];
        if (practiceCategoryName && categoryTotals[practiceCategoryName]) {
          const weight = tx.practiceWeights?.[practice] || 0;
          const impactAmount = tx.amount * (weight / 100);
          if (!isNaN(impactAmount) && Math.abs(impactAmount) > 0.005) {
            categoryTotals[practiceCategoryName].positiveImpact += impactAmount;
            categoryTotals[practiceCategoryName].contributingTransactionIds.add(
              txIdentifier
            );
          }
        }
      });
    });
    Object.keys(categoryTotals).forEach((catName) => {
      const uniqueTxAmounts = new Map<string, number>();
      categoryTotals[catName].contributingTransactionIds.forEach((txId) => {
        const contributingTx = transactions.find(
          (tx) =>
            (tx.plaidTransactionId || `${tx.date}-${tx.name}-${tx.amount}`) ===
            txId
        );
        if (contributingTx && !uniqueTxAmounts.has(txId)) {
          uniqueTxAmounts.set(txId, contributingTx.amount);
        }
      });
      categoryTotals[catName].totalSpentOnCategory = Array.from(
        uniqueTxAmounts.values()
      ).reduce((sum, amount) => sum + amount, 0);
    });
    const finalResult: Record<
      string,
      { positiveImpact: number; negativeImpact: number; totalSpent: number }
    > = {};
    categoryNamesFromConfig.forEach((catName) => {
      finalResult[catName] = {
        positiveImpact: categoryTotals[catName].positiveImpact,
        negativeImpact: categoryTotals[catName].negativeImpact,
        totalSpent: categoryTotals[catName].totalSpentOnCategory,
      };
    });
    return finalResult;
  },
  calculateImpactAnalysis(
    transactions: Transaction[],
    appliedCredit: number = 0,
    userValueSettings?: UserValueSettings
  ): ImpactAnalysis {
    /* ... */ const valueAdjustedNegativeImpact = this.calculateNegativeImpact(
      transactions,
      userValueSettings
    );
    const totalPositiveImpact = this.calculatePositiveImpact(transactions);
    const netSocietalDebt = valueAdjustedNegativeImpact - totalPositiveImpact;
    const effectiveDebt = Math.max(
      0,
      valueAdjustedNegativeImpact - appliedCredit
    );
    const totalSpentExcludingCreditApplications = transactions
      .filter((tx) => !tx.isCreditApplication)
      .reduce((sum, tx) => sum + (tx.amount || 0), 0);
    const debtPercentage =
      totalSpentExcludingCreditApplications > 0
        ? (valueAdjustedNegativeImpact /
            totalSpentExcludingCreditApplications) *
          100
        : 0;
    const availableCredit = Math.max(0, totalPositiveImpact - appliedCredit);
    return {
      negativeImpact: valueAdjustedNegativeImpact,
      positiveImpact: totalPositiveImpact,
      netSocietalDebt,
      effectiveDebt,
      debtPercentage,
      appliedCredit,
      availableCredit,
      totalTransactions: transactions.length,
      transactionsWithDebt: transactions.filter(
        (tx) =>
          (tx.unethicalPractices && tx.unethicalPractices.length > 0) ||
          (tx.societalDebt && tx.societalDebt > 0)
      ).length,
      transactionsWithCredit: transactions.filter(
        (tx) =>
          (tx.ethicalPractices && tx.ethicalPractices.length > 0) ||
          (tx.societalDebt && tx.societalDebt < 0)
      ).length,
    };
  },

  calculateNegativeCategories(
    transactions: Transaction[],
    userValueSettings?: UserValueSettings
  ): Array<{ name: string; amount: number }> {
    const categoryImpacts = this.calculateCategoryImpacts(
      transactions,
      userValueSettings
    );
    return (
      Object.entries(categoryImpacts)
        // LINT FIX: Access data object by index [1] in filter
        .filter((entry) => entry[1].negativeImpact > 0.005)
        .map(([name, impactData]) => ({
          name,
          amount: impactData.negativeImpact,
        }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5)
    );
  },

  calculatePositiveCategories(
    transactions: Transaction[]
  ): Array<{ name: string; amount: number }> {
    const categoryImpacts = this.calculateCategoryImpacts(transactions);
    return (
      Object.entries(categoryImpacts)
        // LINT FIX: Access data object by index [1] in filter
        .filter((entry) => entry[1].positiveImpact > 0.005)
        .map(([name, impactData]) => ({
          name,
          amount: impactData.positiveImpact,
        }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5)
    );
  },
};
