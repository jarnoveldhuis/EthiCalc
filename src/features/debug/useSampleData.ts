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
    name: "Target",
    merchant_name: "Target",
    amount: 67.45,
    analyzed: false,
    plaidCategories: ["Shops", "Department Stores"],
    location: {
      address: "1000 Nicollet Mall", city: "Minneapolis", region: "MN",
      postal_code: "55403", country: "US", lat: null, lon: null, store_number: "T-205"
    } as PlaidLocation,
  },
  {
    plaidTransactionId: generateSamplePlaidId(),
    date: formatDate(2),
    name: "Kroger",
    merchant_name: "Kroger",
    amount: 82.19,
    analyzed: false,
    plaidCategories: ["Shops", "Supermarkets and Groceries"],
    location: {
      address: "555 Market St", city: "Cincinnati", region: "OH",
      postal_code: "45202", country: "US", lat: null, lon: null, store_number: "KR-121"
    } as PlaidLocation,
  },
  {
    plaidTransactionId: generateSamplePlaidId(),
    date: formatDate(3),
    name: "Amazon Marketplace",
    merchant_name: "Amazon",
    amount: 33.74,
    analyzed: false,
    plaidCategories: ["Shops", "Digital Purchase"],
    location: null,
  },
  {
    plaidTransactionId: generateSamplePlaidId(),
    date: formatDate(4),
    name: "Chick-fil-A",
    merchant_name: "Chick-fil-A",
    amount: 12.36,
    analyzed: false,
    plaidCategories: ["Food and Drink", "Restaurants", "Fast Food"],
    location: {
      address: "123 Chicken Blvd", city: "Atlanta", region: "GA",
      postal_code: "30301", country: "US", lat: null, lon: null, store_number: "CFA-781"
    } as PlaidLocation,
  },
  {
    plaidTransactionId: generateSamplePlaidId(),
    date: formatDate(5),
    name: "DoorDash",
    merchant_name: "DoorDash",
    amount: 29.50,
    analyzed: false,
    plaidCategories: ["Food and Drink", "Delivery"],
    location: null,
  },
  {
    plaidTransactionId: generateSamplePlaidId(),
    date: formatDate(6),
    name: "Apple iCloud",
    merchant_name: "Apple",
    amount: 0.99,
    analyzed: false,
    plaidCategories: ["Service", "Cloud Storage", "Technology"],
    location: null,
  },
  {
    plaidTransactionId: generateSamplePlaidId(),
    date: formatDate(7),
    name: "Netflix",
    merchant_name: "Netflix.com",
    amount: 15.49,
    analyzed: false,
    plaidCategories: ["Service", "Subscription", "Entertainment"],
    location: null,
  },
  {
    plaidTransactionId: generateSamplePlaidId(),
    date: formatDate(8),
    name: "Microsoft 365",
    merchant_name: "Microsoft",
    amount: 6.99,
    analyzed: false,
    plaidCategories: ["Service", "Software", "Productivity"],
    location: null,
  },
  {
    plaidTransactionId: generateSamplePlaidId(),
    date: formatDate(9),
    name: "Chevron",
    merchant_name: "Chevron Gas Station",
    amount: 47.12,
    analyzed: false,
    plaidCategories: ["Transportation", "Gas"],
    location: {
      address: "800 Fuel Lane", city: "San Ramon", region: "CA",
      postal_code: "94583", country: "US", lat: null, lon: null, store_number: "CH-102"
    } as PlaidLocation,
  },
  {
    plaidTransactionId: generateSamplePlaidId(),
    date: formatDate(10),
    name: "EZ-Pass NY",
    merchant_name: "EZ-Pass",
    amount: 4.95,
    analyzed: false,
    plaidCategories: ["Transportation", "Tolls"],
    location: null,
  },
  {
    plaidTransactionId: generateSamplePlaidId(),
    date: formatDate(11),
    name: "Verizon Wireless",
    merchant_name: "Verizon",
    amount: 79.99,
    analyzed: false,
    plaidCategories: ["Bills and Utilities", "Mobile Phone"],
    location: null,
  },
  {
    plaidTransactionId: generateSamplePlaidId(),
    date: formatDate(12),
    name: "Venmo Payment",
    merchant_name: "Venmo",
    amount: 25.00,
    analyzed: false,
    plaidCategories: ["Transfer", "Peer-to-Peer Payment"],
    location: null,
  },
  {
    plaidTransactionId: generateSamplePlaidId(),
    date: formatDate(13),
    name: "Progressive Insurance",
    merchant_name: "Progressive",
    amount: 112.25,
    analyzed: false,
    plaidCategories: ["Insurance", "Auto Insurance"],
    location: null,
  },
  {
    plaidTransactionId: generateSamplePlaidId(),
    date: formatDate(14),
    name: "Con Edison",
    merchant_name: "Con Edison",
    amount: 61.30,
    analyzed: false,
    plaidCategories: ["Bills and Utilities", "Electricity"],
    location: null,
  },
  {
    plaidTransactionId: generateSamplePlaidId(),
    date: formatDate(15),
    name: "Dollar General",
    merchant_name: "Dollar General",
    amount: 18.22,
    analyzed: false,
    plaidCategories: ["Shops", "Discount Stores"],
    location: {
      address: "456 Budget St", city: "Goodlettsville", region: "TN",
      postal_code: "37072", country: "US", lat: null, lon: null, store_number: "DG-991"
    } as PlaidLocation,
  },
  {
    plaidTransactionId: generateSamplePlaidId(),
    date: formatDate(16),
    name: "Etsy Purchase",
    merchant_name: "Etsy",
    amount: 42.00,
    analyzed: false,
    plaidCategories: ["Shops", "Online Marketplaces"],
    location: null,
  },
  {
    plaidTransactionId: generateSamplePlaidId(),
    date: formatDate(17),
    name: "Planet Fitness",
    merchant_name: "Planet Fitness",
    amount: 10.00,
    analyzed: false,
    plaidCategories: ["Recreation", "Gyms and Fitness Centers"],
    location: {
      address: "777 Workout Blvd", city: "Hampton", region: "NH",
      postal_code: "03842", country: "US", lat: null, lon: null, store_number: "PF-303"
    } as PlaidLocation,
  },
  {
    plaidTransactionId: generateSamplePlaidId(),
    date: formatDate(18),
    name: "Airbnb",
    merchant_name: "Airbnb Inc",
    amount: 182.67,
    analyzed: false,
    plaidCategories: ["Travel", "Lodging"],
    location: null,
  },
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