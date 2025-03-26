import { Transaction } from "@/shared/types/transactions";

// Helper function to get color class for debt values
export function getColorClass(value: number): string {
  if (value < 0) return "text-green-600";
  if (value === 0) return "text-blue-600";
  if (value <= 10) return "text-yellow-600";
  if (value <= 20) return "text-orange-600";
  if (value <= 50) return "text-red-600";
  return "text-red-700";
}

// Calculate practice donations for the PracticeDebtTable
export function calculatePracticeDonations(transactions: Transaction[]) {
  if (!transactions || transactions.length === 0) {
    return {};
  }

  const donations: Record<
    string,
    { charity: { name: string; url: string } | null; amount: number }
  > = {};

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
}

// Calculate positive purchase amount
export function calculatePositiveAmount(transactions: Transaction[]) {
  let total = 0;

  // Iterate through all transactions
  transactions.forEach((tx) => {
    // Skip transactions that are credit applications
    if (tx.isCreditApplication) {
      return;
    }
    
    // Skip transactions that have already been used for credit
    if (tx.creditApplied) {
      return;
    }
    
    // If we have practice-level details
    if (tx.ethicalPractices && tx.ethicalPractices.length > 0) {
      total += tx.amount || 0;
    }
    // Or if we have overall societal debt that's negative (positive impact)
    else if (tx.societalDebt && tx.societalDebt < 0) {
      total += tx.amount || 0;
    }
  });

  return total;
}

// Calculate negative purchase amount
export function calculateNegativeAmount(transactions: Transaction[]) {
  let total = 0;

  // Iterate through all transactions
  transactions.forEach((tx) => {
    // If we have practice-level details
    if (tx.unethicalPractices && tx.unethicalPractices.length > 0) {
      total += tx.amount || 0;
    }
    // Or if we have overall societal debt that's positive (negative impact)
    else if (tx.societalDebt && tx.societalDebt > 0) {
      total += tx.amount || 0;
    }
  });

  return total;
}

// Calculate top negative impact categories for recommended offsets
export function calculateNegativeCategories(transactions: Transaction[]) {
  const categories: Record<string, number> = {};

  // Iterate through all transactions to collect category impact
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