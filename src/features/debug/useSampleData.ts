// src/features/debug/useSampleData.ts
import { useCallback } from 'react';
import { Transaction, PlaidLocation } from '@/shared/types/transactions'; // Added PlaidLocation

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

    // Helper to create a unique plaidTransactionId for sample data
    const generateSamplePlaidId = () => `sample-tx-${crypto.randomUUID()}`;

    return [
      {
        plaidTransactionId: generateSamplePlaidId(),
        date: formatDate(1),
        name: "Whole Foods Market",
        merchant_name: "Whole Foods Market",
        amount: 84.73,
        analyzed: false, // Will be analyzed by the system
        plaidCategories: ["Shops", "Supermarkets and Groceries"],
        location: {
          address: "101 Healthy Way", city: "Austin", region: "TX",
          postal_code: "78701", country: "US", lat: null, lon: null, store_number: "1021"
        } as PlaidLocation, // Ensure type correctness
        // Removed pre-analyzed fields: unethicalPractices, ethicalPractices, practiceWeights, information, etc.
      },
      {
        plaidTransactionId: generateSamplePlaidId(),
        date: formatDate(2),
        name: "Amazon",
        merchant_name: "Amazon Marketplace",
        amount: 37.49,
        analyzed: false,
        plaidCategories: ["Shops", "Digital Purchase"],
        location: null, // Example with no location
      },
      {
        plaidTransactionId: generateSamplePlaidId(),
        date: formatDate(3),
        name: "Starbucks",
        merchant_name: "Starbucks Coffee",
        amount: 5.25,
        analyzed: false,
        plaidCategories: ["Food and Drink", "Restaurants", "Coffee Shop"],
        location: {
          address: "789 Cafe Lane", city: "Seattle", region: "WA",
          postal_code: "98101", country: "US", lat: null, lon: null, store_number: "567"
        } as PlaidLocation,
      },
      {
        plaidTransactionId: generateSamplePlaidId(),
        date: formatDate(5),
        name: "Netflix",
        merchant_name: "Netflix.com",
        amount: 15.99,
        analyzed: false,
        plaidCategories: ["Service", "Subscription", "Entertainment"],
        location: null,
      },
      {
        plaidTransactionId: generateSamplePlaidId(),
        date: formatDate(7),
        name: "Shell",
        merchant_name: "Shell Oil",
        amount: 48.22,
        analyzed: false,
        plaidCategories: ["Transportation", "Gas"],
        location: {
          address: "456 Fuel Rd", city: "Houston", region: "TX",
          postal_code: "77002", country: "US", lat: null, lon: null, store_number: "S-1234"
        } as PlaidLocation,
      },
      {
        plaidTransactionId: generateSamplePlaidId(),
        date: formatDate(10),
        name: "Patagonia",
        merchant_name: "Patagonia Inc.",
        amount: 120.00,
        analyzed: false,
        plaidCategories: ["Shops", "Clothing"],
        location: {
          address: "259 W Santa Clara St", city: "Ventura", region: "CA",
          postal_code: "93001", country: "US", lat: null, lon: null, store_number: null
        } as PlaidLocation,
      }
    ];
  }, []);
  
  // Calculate societal debt for the sample transactions (this might be less relevant now as analysis is live)
  const calculateSampleDebt = useCallback((transactions: Transaction[]): number => {
    let totalDebt = 0;
    transactions.forEach(tx => {
      // This logic would need to be updated if we're not pre-calculating societalDebt
      // For now, it will assume societalDebt is populated by the live analysis
      totalDebt += (tx.societalDebt || 0);
    });
    return totalDebt;
  }, []);

  return {
    generateSampleTransactions,
    calculateSampleDebt
  };
}