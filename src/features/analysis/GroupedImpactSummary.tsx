"use client";

import { useState } from "react";
import { Transaction } from "@/shared/types/transactions";
import { DonationModal } from "@/features/charity/DonationModal";

interface GroupedImpactSummaryProps {
  transactions: Transaction[];
  totalSocietalDebt: number;
}

type PracticeImpact = {
  practice: string;
  amount: number;
  isPositive: boolean;
  information: string;
  searchTerm?: string;
  category?: string;
  weight: number;
  vendor: string;
};

type CategoryImpact = {
  category: string;
  practices: PracticeImpact[];
  totalImpact: number;
};

export function GroupedImpactSummary({
  transactions,
  totalSocietalDebt
}: GroupedImpactSummaryProps) {
  const [selectedImpact, setSelectedImpact] = useState<{
    category: string;
    vendor: string;
    practice: string;
    amount: number;
  } | null>(null);
  const [isDonationModalOpen, setIsDonationModalOpen] = useState(false);

  // Process transactions to group by category
  const groupedImpacts = processTransactionsIntoGroups(transactions);

  // Handle offset
  const handleOffset = (category: string, vendor: string, practice: string, amount: number) => {
    setSelectedImpact({ category, vendor, practice, amount });
    setIsDonationModalOpen(true);
  };

  // Process transactions to group by category
  function processTransactionsIntoGroups(transactions: Transaction[]): CategoryImpact[] {
    // First, collect all impacts grouped by category
    const categoriesMap: Record<string, CategoryImpact> = {};

    transactions.forEach(tx => {
      const vendorName = tx.name;
      
      // Process unethical practices (positive debt)
      (tx.unethicalPractices || []).forEach(practice => {
        const weight = tx.practiceWeights?.[practice] || 10;
        const amount = tx.amount * (weight / 100);
        const category = tx.practiceCategories?.[practice] || "Uncategorized";
        const information = tx.information?.[practice] || "No details available";
        const searchTerm = tx.practiceSearchTerms?.[practice];
        
        // Initialize category if needed
        if (!categoriesMap[category]) {
          categoriesMap[category] = {
            category,
            practices: [],
            totalImpact: 0
          };
        }
        
        // Add practice to category
        categoriesMap[category].practices.push({
          practice,
          amount,
          isPositive: false,
          information,
          searchTerm,
          category,
          weight,
          vendor: vendorName
        });
        
        // Update category total
        categoriesMap[category].totalImpact += amount;
      });
      
      // Process ethical practices (negative debt)
      (tx.ethicalPractices || []).forEach(practice => {
        const weight = tx.practiceWeights?.[practice] || 10;
        const amount = tx.amount * (weight / 100);
        const category = tx.practiceCategories?.[practice] || "Uncategorized";
        const information = tx.information?.[practice] || "No details available";
        const searchTerm = tx.practiceSearchTerms?.[practice];
        
        // Initialize category if needed
        if (!categoriesMap[category]) {
          categoriesMap[category] = {
            category,
            practices: [],
            totalImpact: 0
          };
        }
        
        // Add practice to category
        categoriesMap[category].practices.push({
          practice,
          amount: -amount, // Negative for ethical impact
          isPositive: true,
          information,
          searchTerm,
          category,
          weight,
          vendor: vendorName
        });
        
        // Update category total
        categoriesMap[category].totalImpact -= amount;
      });
    });

    // Convert to array and sort
    const result = Object.values(categoriesMap)
      .sort((a, b) => Math.abs(b.totalImpact) - Math.abs(a.totalImpact))
      .filter(category => category.practices.length > 0); // Only include categories with practices
    
    // Sort practices within each category
    result.forEach(category => {
      category.practices.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
    });
    
    return result;
  }

  // Get icon for a category
  const getCategoryIcon = (category: string): string => {
    const icons: Record<string, string> = {
      "Climate Change": "🌍",
      "Environmental Impact": "🌳",
      "Social Responsibility": "👥",
      "Labor Practices": "👷‍♂️",
      "Digital Rights": "💻",
      "Animal Welfare": "🐾",
      "Food Insecurity": "🍽️",
      "Poverty": "💰",
      "Conflict": "⚔️",
      "Inequality": "⚖️",
      "Public Health": "🏥",
      "Uncategorized": "❓"
    };
    
    return icons[category] || "❓";
  };

  // Get color class based on impact value
  const getImpactColorClass = (value: number): string => {
    if (value < 0) return "text-green-600"; // Positive ethical impact
    if (value === 0) return "text-gray-600"; // Neutral
    return "text-red-600"; // Negative ethical impact
  };

  // Get background color for a category header
  const getCategoryBgColor = (category: string): string => {
    const colors: Record<string, string> = {
      "Climate Change": "bg-blue-100",
      "Environmental Impact": "bg-green-100",
      "Social Responsibility": "bg-yellow-100",
      "Labor Practices": "bg-orange-100",
      "Digital Rights": "bg-purple-100",
      "Animal Welfare": "bg-pink-100",
      "Food Insecurity": "bg-red-100",
      "Poverty": "bg-indigo-100",
      "Conflict": "bg-gray-100",
      "Inequality": "bg-teal-100",
      "Public Health": "bg-cyan-100",
      "Uncategorized": "bg-gray-100"
    };
    
    return colors[category] || "bg-gray-100";
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold text-gray-800 mb-6">
        Ethical Impact By Category
      </h2>
      
      {groupedImpacts.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No ethical impact data available
        </div>
      ) : (
        <div className="space-y-6">
          {/* Loop through categories */}
          {groupedImpacts.map((category) => (
            <div key={category.category} className="border rounded-lg overflow-hidden shadow-sm">
              {/* Category Header */}
              <div className={`px-4 py-3 ${getCategoryBgColor(category.category)} flex justify-between items-center`}>
                <div className="flex items-center">
                  <span className="text-2xl mr-2">{getCategoryIcon(category.category)}</span>
                  <h3 className="font-bold text-gray-800">{category.category}</h3>
                  <span className="ml-2 text-sm text-gray-600">({category.practices.length} items)</span>
                </div>
                <div className={`font-bold ${getImpactColorClass(category.totalImpact)}`}>
                  Net: {category.totalImpact >= 0 ? '+' : ''}${Math.abs(category.totalImpact).toFixed(2)}
                </div>
              </div>
              
              {/* Column Headers */}
              <div className="grid grid-cols-10 gap-2 px-4 py-2 bg-gray-50 border-b border-t border-gray-200 text-xs font-semibold text-gray-600">
                <div className="col-span-2">Vendor</div>
                <div className="col-span-2">Practice</div>
                <div className="col-span-4">Details</div>
                <div className="col-span-1 text-right">Impact</div>
                <div className="col-span-1 text-center">Action</div>
              </div>
              
              {/* Practice Rows */}
              <div className="divide-y divide-gray-200">
                {category.practices.map((practice, pIndex) => (
                  <div 
                    key={`${practice.vendor}-${practice.practice}-${pIndex}`} 
                    className={`grid grid-cols-10 gap-2 px-4 py-3 ${
                      practice.isPositive ? "bg-green-50" : "bg-white"
                    }`}
                  >
                    {/* Vendor */}
                    <div className="col-span-2 truncate font-medium">
                      {practice.vendor}
                    </div>
                    
                    {/* Practice */}
                    <div className="col-span-2 truncate">
                      {practice.practice}
                    </div>
                    
                    {/* Information */}
                    <div className="col-span-4 text-sm">
                      <div className="text-gray-700 mb-1">
                        {practice.information}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <span className="text-xs bg-gray-200 text-gray-800 px-1 py-0.5 rounded-full">
                          {practice.weight}% of purchase
                        </span>
                        {practice.searchTerm && (
                          <span className="text-xs bg-blue-100 text-blue-800 px-1 py-0.5 rounded-full">
                            #{practice.searchTerm}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Amount */}
                    <div className={`col-span-1 text-right font-bold ${getImpactColorClass(practice.amount)}`}>
                      {practice.amount >= 0 ? '+' : ''}
                      ${Math.abs(practice.amount).toFixed(2)}
                    </div>
                    
                    {/* Action */}
                    <div className="col-span-1 text-center">
                      {practice.amount > 0 && (
                        <button 
                          className="text-xs bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded"
                          onClick={() => handleOffset(
                            category.category,
                            practice.vendor,
                            practice.practice,
                            practice.amount
                          )}
                        >
                          Offset
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          
          {/* Total Impact Summary */}
          <div className="mt-6 pt-4 border-t-2 border-gray-300 flex justify-between items-center">
            <div className="text-gray-700 font-medium">
              Total Entries: {groupedImpacts.reduce((sum, cat) => sum + cat.practices.length, 0)}
            </div>
            <div className={`text-xl font-bold ${totalSocietalDebt > 0 ? 'text-red-600' : 'text-green-600'}`}>
              Net Impact: ${Math.abs(totalSocietalDebt).toFixed(2)} {totalSocietalDebt > 0 ? 'Negative' : 'Positive'}
            </div>
          </div>
        </div>
      )}
      
      {/* Donation Modal */}
      {isDonationModalOpen && selectedImpact && (
        <DonationModal
          practice={`${selectedImpact.practice} (${selectedImpact.vendor})`}
          amount={selectedImpact.amount}
          isOpen={isDonationModalOpen}
          onClose={() => setIsDonationModalOpen(false)}
        />
      )}
    </div>
  );
}