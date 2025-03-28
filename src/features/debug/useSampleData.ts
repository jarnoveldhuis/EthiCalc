// src/features/debug/useSampleData.ts
import { useCallback } from 'react';
import { Transaction } from '@/shared/types/transactions';

/**
 * Hook to provide sample transaction data for testing
 */
export function useSampleData() {
  // Generate sample transactions
  const generateSampleTransactions = useCallback((): Transaction[] => {
    const currentDate = new Date();
    const formatDate = (daysAgo: number): string => {
      const date = new Date(currentDate.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
      return date.toISOString().split('T')[0];
    };
    
    return [
      {
        date: formatDate(1),
        name: "Whole Foods Market",
        amount: 84.73,
        unethicalPractices: ["Excessive Packaging"],
        ethicalPractices: ["Organic Farming"],
        practiceWeights: {
          "Excessive Packaging": 15,
          "Organic Farming": 25
        },
        information: {
          "Excessive Packaging": "Uses plastic containers for many organic items.",
          "Organic Farming": "Supports local organic farmers and sustainable agriculture."
        },
        practiceCategories: {
          "Excessive Packaging": "Environmental Impact",
          "Organic Farming": "Environmental Impact"
        },
        analyzed: true
      },
      {
        date: formatDate(2),
        name: "Amazon",
        amount: 37.49,
        unethicalPractices: ["Excessive Packaging", "Labor Exploitation"],
        ethicalPractices: [],
        practiceWeights: {
          "Excessive Packaging": 20,
          "Labor Exploitation": 15
        },
        information: {
          "Excessive Packaging": "Uses oversized boxes and plastic mailers.",
          "Labor Exploitation": "Reports of poor working conditions in warehouses."
        },
        practiceCategories: {
          "Excessive Packaging": "Environmental Impact",
          "Labor Exploitation": "Social Responsibility"
        },
        analyzed: true
      },
      {
        date: formatDate(3),
        name: "Starbucks",
        amount: 5.25,
        unethicalPractices: ["High Emissions", "Water Waste"],
        ethicalPractices: ["Fair Trade Support"],
        practiceWeights: {
          "High Emissions": 10,
          "Water Waste": 8,
          "Fair Trade Support": 20
        },
        information: {
          "High Emissions": "Coffee roasting and transport contributes to emissions.",
          "Water Waste": "Coffee production requires significant water resources.",
          "Fair Trade Support": "Participates in fair trade coffee practices."
        },
        practiceCategories: {
          "High Emissions": "Climate Change",
          "Water Waste": "Environmental Impact",
          "Fair Trade Support": "Social Responsibility"
        },
        analyzed: true
      },
      {
        date: formatDate(5),
        name: "Netflix",
        amount: 15.99,
        unethicalPractices: ["High Energy Usage", "Data Privacy Issues"],
        ethicalPractices: ["Content Diversity"],
        practiceWeights: {
          "High Energy Usage": 15,
          "Data Privacy Issues": 10,
          "Content Diversity": 25
        },
        information: {
          "High Energy Usage": "Streaming services consume significant server resources.",
          "Data Privacy Issues": "Collects extensive viewing history and preferences.",
          "Content Diversity": "Supports diverse content creators and storylines."
        },
        practiceCategories: {
          "High Energy Usage": "Climate Change",
          "Data Privacy Issues": "Digital Rights",
          "Content Diversity": "Social Responsibility"
        },
        analyzed: true
      },
      {
        date: formatDate(7),
        name: "Shell",
        amount: 48.22,
        unethicalPractices: ["High Emissions", "Environmental Degradation"],
        ethicalPractices: [],
        practiceWeights: {
          "High Emissions": 40,
          "Environmental Degradation": 25
        },
        information: {
          "High Emissions": "Fossil fuel products contribute significantly to carbon emissions.",
          "Environmental Degradation": "Oil extraction and processing has environmental impacts."
        },
        practiceCategories: {
          "High Emissions": "Climate Change",
          "Environmental Degradation": "Environmental Impact"
        },
        analyzed: true
      },
      {
        date: formatDate(10),
        name: "Patagonia",
        amount: 120.00,
        unethicalPractices: [],
        ethicalPractices: ["Sustainable Materials", "Ethical Investment"],
        practiceWeights: {
          "Sustainable Materials": 35,
          "Ethical Investment": 20
        },
        information: {
          "Sustainable Materials": "Uses recycled and organic materials in products.",
          "Ethical Investment": "Donates percentage of profits to environmental causes."
        },
        practiceCategories: {
          "Sustainable Materials": "Environmental Impact",
          "Ethical Investment": "Social Responsibility"
        },
        analyzed: true
      }
    ];
  }, []);
  
  // Calculate societal debt for the sample transactions
  const calculateSampleDebt = useCallback((transactions: Transaction[]): number => {
    let totalDebt = 0;
    
    transactions.forEach(tx => {
      let transactionDebt = 0;
      
      // Add debt from unethical practices
      (tx.unethicalPractices || []).forEach(practice => {
        const weight = tx.practiceWeights?.[practice] || 0;
        const practiceDebt = tx.amount * (weight / 100);
        transactionDebt += practiceDebt;
      });
      
      // Subtract debt from ethical practices
      (tx.ethicalPractices || []).forEach(practice => {
        const weight = tx.practiceWeights?.[practice] || 0;
        const practiceCredit = tx.amount * (weight / 100);
        transactionDebt -= practiceCredit;
      });
      
      // Add this transaction's debt to the total
      totalDebt += transactionDebt;
    });
    
    return totalDebt;
  }, []);

  // Return the sample data generation functions
  return {
    generateSampleTransactions,
    calculateSampleDebt
  };
}