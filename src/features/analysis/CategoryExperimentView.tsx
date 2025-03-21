"use client";

import React, { useState, useMemo } from "react";
import { Transaction } from "@/shared/types/transactions";
import { DonationModal } from "@/features/charity/DonationModal";

interface CategoryExperimentViewProps {
  transactions: Transaction[];
  totalSocietalDebt: number;
}

interface PracticeData {
  name: string;
  amount: number;
  isEthical: boolean;
  vendorContributions: {
    vendorName: string;
    amount: number;
    percentage: number;
  }[];
}

interface CategoryData {
  name: string;
  practices: PracticeData[];
  totalAmount: number;
  positiveAmount: number;
  negativeAmount: number;
}

export function CategoryExperimentView({
  transactions,
  totalSocietalDebt,
}: CategoryExperimentViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedPractice, setSelectedPractice] = useState<string | null>(null);
  const [isDonationModalOpen, setIsDonationModalOpen] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  // Toggle category expansion
  const toggleCategory = (categoryName: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryName]: !prev[categoryName]
    }));
  };

  // Process data to group by categories and practices
  const categoryData = useMemo(() => {
    // Guard against undefined or empty transactions
    if (!transactions || transactions.length === 0) {
      return [];
    }
    
    // First group practices
    const practiceMap: Record<string, PracticeData> = {};
    
    // Process all transactions to gather practice data
    transactions.forEach(transaction => {
      // Safely access arrays with defaults
      const unethicalPractices = transaction.unethicalPractices || [];
      const ethicalPractices = transaction.ethicalPractices || [];
      const practiceWeights = transaction.practiceWeights || {};
      
      // Process unethical practices (positive debt)
      unethicalPractices.forEach(practice => {
        const weight = practiceWeights[practice] || 0;
        const amount = transaction.amount * (weight / 100);
        
        // Initialize practice if needed
        if (!practiceMap[practice]) {
          practiceMap[practice] = {
            name: practice,
            amount: 0,
            isEthical: false,
            vendorContributions: []
          };
        }
        
        // Add to practice total
        practiceMap[practice].amount += amount;
        
        // Add vendor contribution
        const existingVendor = practiceMap[practice].vendorContributions.find(
          v => v.vendorName === transaction.name
        );
        
        if (existingVendor) {
          existingVendor.amount += amount;
        } else {
          practiceMap[practice].vendorContributions.push({
            vendorName: transaction.name,
            amount,
            percentage: 0 // Will calculate later
          });
        }
      });
      
      // Process ethical practices (negative debt)
      ethicalPractices.forEach(practice => {
        const weight = practiceWeights[practice] || 0;
        const amount = -1 * (transaction.amount * (weight / 100));
        
        // Initialize practice if needed
        if (!practiceMap[practice]) {
          practiceMap[practice] = {
            name: practice,
            amount: 0,
            isEthical: true,
            vendorContributions: []
          };
        }
        
        // Add to practice total
        practiceMap[practice].amount += amount;
        
        // Add vendor contribution
        const existingVendor = practiceMap[practice].vendorContributions.find(
          v => v.vendorName === transaction.name
        );
        
        if (existingVendor) {
          existingVendor.amount += amount;
        } else {
          practiceMap[practice].vendorContributions.push({
            vendorName: transaction.name,
            amount,
            percentage: 0 // Will calculate later
          });
        }
      });
    });
    
    // Calculate vendor percentages for each practice
    Object.values(practiceMap).forEach(practice => {
      const totalAmount = Math.abs(practice.amount);
      practice.vendorContributions.forEach(vendor => {
        vendor.percentage = totalAmount > 0 ? (Math.abs(vendor.amount) / totalAmount) * 100 : 0;
      });
      
      // Sort vendor contributions by percentage
      practice.vendorContributions.sort((a, b) => b.percentage - a.percentage);
    });
    
    // Now group by categories
    const categoriesMap: Record<string, CategoryData> = {};
    
    Object.entries(practiceMap).forEach(([practiceName, practiceData]) => {
      // Find the category from all transactions that mention this practice
      let categoryName = "Other";
      
      // Look through all transactions to find category for this practice
      for (const transaction of transactions) {
        if (
          (transaction.unethicalPractices?.includes(practiceName) || 
           transaction.ethicalPractices?.includes(practiceName)) &&
          transaction.practiceCategories?.[practiceName]
        ) {
          categoryName = transaction.practiceCategories[practiceName];
          break;
        }
      }
      
      // Initialize category if needed
      if (!categoriesMap[categoryName]) {
        categoriesMap[categoryName] = {
          name: categoryName,
          practices: [],
          totalAmount: 0,
          positiveAmount: 0,
          negativeAmount: 0
        };
      }
      
      // Add practice to category
      categoriesMap[categoryName].practices.push(practiceData);
      
      // Update category totals
      categoriesMap[categoryName].totalAmount += practiceData.amount;
      if (practiceData.amount < 0) {
        categoriesMap[categoryName].positiveAmount += Math.abs(practiceData.amount);
      } else {
        categoriesMap[categoryName].negativeAmount += practiceData.amount;
      }
    });
    
    // Convert to array and sort by absolute impact
    return Object.values(categoriesMap).sort(
      (a, b) => Math.abs(b.totalAmount) - Math.abs(a.totalAmount)
    );
  }, [transactions]);
  
  // Calculate overall positive and negative impacts
  const totalPositiveImpact = useMemo(() => 
    categoryData.reduce((sum, category) => sum + category.positiveAmount, 0),
  [categoryData]);
  
  const totalNegativeImpact = useMemo(() => 
    categoryData.reduce((sum, category) => sum + category.negativeAmount, 0),
  [categoryData]);

  // Handle offset buttons
  const handleOffsetAll = () => {
    setSelectedCategory(null);
    setSelectedPractice("all");
    setIsDonationModalOpen(true);
  };

  const handleOffsetCategory = (categoryName: string) => {
    setSelectedCategory(categoryName);
    setSelectedPractice(null);
    setIsDonationModalOpen(true);
  };

  const handleOffsetPractice = (practiceName: string) => {
    setSelectedCategory(null);
    setSelectedPractice(practiceName);
    setIsDonationModalOpen(true);
  };

  // Get selected amount for donation modal
  const getSelectedAmount = () => {
    if (selectedPractice === "all") {
      return Math.max(0, totalSocietalDebt);
    }
    
    if (selectedCategory) {
      const category = categoryData.find(c => c.name === selectedCategory);
      return category ? Math.max(0, category.negativeAmount) : 0;
    }
    
    if (selectedPractice) {
      // Find practice across all categories
      for (const category of categoryData) {
        const practice = category.practices.find(p => p.name === selectedPractice);
        if (practice && practice.amount > 0) {
          return practice.amount;
        }
      }
    }
    
    return 0;
  };
  
  return (
    <div className="p-2 sm:p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">
        Impact by Category
      </h2>
      
      {/* Overall impact visualization */}
      <div className="mb-8">
        <div className="flex justify-between text-sm mb-1">
          <div className="text-green-600 font-medium">
            ${totalPositiveImpact.toFixed(2)}
          </div>
          <div className="text-red-600 font-medium">
            ${totalNegativeImpact.toFixed(2)}
          </div>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
          {/* Positive impact (green) */}
          <div 
            className="bg-green-500 h-full float-left" 
            style={{ 
              width: `${Math.min(totalPositiveImpact / (totalPositiveImpact + totalNegativeImpact || 1) * 100, 100)}%` 
            }}
          />
          {/* Negative impact (red) */}
          <div 
            className="bg-red-500 h-full float-right" 
            style={{ 
              width: `${Math.min(totalNegativeImpact / (totalPositiveImpact + totalNegativeImpact || 1) * 100, 100)}%` 
            }}
          />
        </div>
      </div>
      
      {/* Categories */}
      <div className="space-y-4">
        {categoryData.map((category, index) => (
          <div key={index} className="border rounded-lg overflow-hidden shadow-sm">
            {/* Category header - table-like layout */}
            <div 
              className={`p-2 sm:p-3 bg-gray-50 border-b cursor-pointer`}
              onClick={() => toggleCategory(category.name)}
            >
              <div className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-5 sm:col-span-5 flex items-center">
                  {expandedCategories[category.name] ? (
                    <span className="text-gray-600 mr-2">▲</span>
                  ) : (
                    <span className="text-gray-600 mr-2">▼</span>
                  )}
                  <h3 className="font-bold text-gray-800 truncate">{category.name}</h3>
                </div>
                
                {/* Category visualization - wider bar showing positive/negative ratio */}
                <div className="col-span-3 sm:col-span-3">
                  <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="bg-green-500 h-full float-left" 
                      style={{ 
                        width: `${category.positiveAmount / (category.positiveAmount + category.negativeAmount || 1) * 100}%` 
                      }}
                    />
                    <div 
                      className="bg-red-500 h-full float-right" 
                      style={{ 
                        width: `${category.negativeAmount / (category.positiveAmount + category.negativeAmount || 1) * 100}%` 
                      }}
                    />
                  </div>
                </div>
                
                <div className="col-span-2 sm:col-span-2 text-right">
                  <span className={`font-bold ${category.totalAmount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    ${Math.abs(category.totalAmount).toFixed(2)}
                  </span>
                </div>
                
                <div className="col-span-2 sm:col-span-2 text-right">
                  {category.negativeAmount > 0 ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOffsetCategory(category.name);
                      }}
                      className="bg-green-100 hover:bg-green-200 text-green-800 px-2 py-1 rounded text-xs w-full sm:w-auto"
                    >
                      Offset
                    </button>
                  ) : (
                    <button
                      disabled
                      className="bg-gray-100 text-gray-400 px-2 py-1 rounded text-xs cursor-not-allowed w-full sm:w-auto"
                    >
                      Offset
                    </button>
                  )}
                </div>
              </div>
            </div>
            
            {/* Category details when expanded */}
            {expandedCategories[category.name] && (
              <div className="p-3 pt-0">
                {/* Practices within this category */}
                <div className="space-y-3">
                  {category.practices.map((practice, idx) => (
                    <div 
                      key={idx} 
                      className={`p-1 sm:p-2 rounded border ${
                        practice.amount > 0 
                          ? 'border-red-200 bg-red-50' 
                          : 'border-green-200 bg-green-50'
                      }`}
                    >
                      <div className="grid grid-cols-12 gap-2 items-center mb-1">
                        <span className="col-span-5 sm:col-span-5 font-medium text-gray-800 truncate max-w-full">
                          {practice.name}
                        </span>
                        <div className="col-span-3 sm:col-span-3">
                          {/* Empty space for alignment with header */}
                        </div>
                        <div className="col-span-2 sm:col-span-2 text-right">
                          <span className={`font-medium ${practice.amount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            ${Math.abs(practice.amount).toFixed(2)}
                          </span>
                        </div>
                        <div className="col-span-2 sm:col-span-2 text-right">
                          {practice.amount > 0 ? (
                            <button
                              onClick={() => handleOffsetPractice(practice.name)}
                              className="text-xs bg-green-100 hover:bg-green-200 text-green-800 px-2 py-0.5 rounded w-full sm:w-auto"
                            >
                              Offset
                            </button>
                          ) : (
                            <button
                              disabled
                              className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded cursor-not-allowed w-full sm:w-auto"
                            >
                              Offset
                            </button>
                          )}
                        </div>
                      </div>
                      
                      {/* Vendor contributions */}
                      <div className="flex flex-wrap gap-1 mt-1">
                        {practice.vendorContributions.length > 0 ? (
                          practice.vendorContributions.map((vendor, vIdx) => (
                            <span 
                              key={vIdx} 
                              className={`inline-flex items-center px-1 sm:px-2 py-0.5 rounded-full text-xs font-medium ${
                                vendor.amount > 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                              }`}
                            >
                              <span className="truncate max-w-[80px] sm:max-w-full">{vendor.vendorName}</span>
                              <span className="ml-1 opacity-75 whitespace-nowrap">
                                ${Math.abs(vendor.amount).toFixed(2)}
                              </span>
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-gray-500 italic">No vendor contributions</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      
      {/* Total section */}
      <div className="mt-8 pt-4 border-t-2 border-gray-300">
        <div className="flex justify-center items-center">
          <div className="text-center">
            <div className={`text-xl font-bold ${totalSocietalDebt > 0 ? 'text-red-600' : 'text-green-600'}`}>
              Net {totalSocietalDebt > 0 ? 'Damage' : 'Benefit'}: ${Math.abs(totalSocietalDebt).toFixed(2)}
            </div>
            
            {totalSocietalDebt > 0 && (
              <button
                onClick={handleOffsetAll}
                className="mt-2 bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-bold shadow transition-colors"
              >
                Offset All (${totalSocietalDebt.toFixed(2)})
              </button>
            )}
          </div>
        </div>
      </div>
      
      {/* Donation modal */}
      {isDonationModalOpen && (
        <DonationModal
          practice={selectedPractice === "all" 
            ? "All Societal Debt" 
            : selectedCategory || selectedPractice || ""}
          amount={getSelectedAmount()}
          isOpen={isDonationModalOpen}
          onClose={() => setIsDonationModalOpen(false)}
        />
      )}
    </div>
  );
}