"use client";

import { useState, useMemo, useCallback } from "react";
import { Transaction } from "@/shared/types/transactions";
import { DonationModal } from "@/features/charity/DonationModal";


interface GroupedImpactSummaryProps {
  transactions: Transaction[];
  totalSocietalDebt: number;
}

interface Practice {
  name: string;
  amount: number;
  information: string;
  category?: string;
  isPositive: boolean;
  vendor?: string;
  weight?: number;
}

interface CategorySummary {
  name: string;
  totalAmount: number;
  practices: Practice[];
  netImpact: number;
}

export function GroupedImpactSummary({
  transactions,
  totalSocietalDebt
}: GroupedImpactSummaryProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedImpact, setSelectedImpact] = useState<{
    category: string;
    vendor: string;
    practice: string;
    amount: number;
  } | null>(null);
  const [isDonationModalOpen, setIsDonationModalOpen] = useState(false);

  // Process transactions to group by category
  const groupedTransactions = useMemo(() => {
    const grouped = transactions.reduce((acc, transaction) => {
      // Process unethical practices
      (transaction.unethicalPractices || []).forEach((practiceName) => {
        const weight = transaction.practiceWeights?.[practiceName] || 0;
        const amount = transaction.amount * (weight / 100);
        const category = transaction.practiceCategories?.[practiceName] || "Uncategorized";
        const information = transaction.information?.[practiceName] || "";
        
        if (!acc[category]) {
          acc[category] = {
            name: category,
            totalAmount: 0,
            practices: [],
            netImpact: 0,
          };
        }
        acc[category].practices.push({
          name: practiceName,
          amount: -amount,
          information,
          category,
          isPositive: false,
        });
        acc[category].totalAmount += amount;
        acc[category].netImpact -= amount;
      });

      // Process ethical practices
      (transaction.ethicalPractices || []).forEach((practiceName) => {
        const weight = transaction.practiceWeights?.[practiceName] || 0;
        const amount = transaction.amount * (weight / 100);
        const category = transaction.practiceCategories?.[practiceName] || "Uncategorized";
        const information = transaction.information?.[practiceName] || "";
        
        if (!acc[category]) {
          acc[category] = {
            name: category,
            totalAmount: 0,
            practices: [],
            netImpact: 0,
          };
        }
        acc[category].practices.push({
          name: practiceName,
          amount,
          information,
          category,
          isPositive: true,
        });
        acc[category].totalAmount += amount;
        acc[category].netImpact += amount;
      });

      return acc;
    }, {} as Record<string, CategorySummary>);

    // Sort categories by absolute total amount
    return Object.values(grouped).sort((a, b) => Math.abs(b.totalAmount) - Math.abs(a.totalAmount));
  }, [transactions]);

  // Filter categories based on search term
  const filteredCategories = useMemo(() => {
    if (!searchTerm) return groupedTransactions;
    return groupedTransactions.filter((category) =>
      category.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [groupedTransactions, searchTerm]);

  // Handle category selection
  const handleCategorySelect = useCallback((category: string) => {
    setSelectedCategory(category === selectedCategory ? null : category);
  }, [selectedCategory]);

  // Handle search input change
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  }, []);

  // Handle offset
  const handleOffset = (category: string, vendor: string, practice: string, amount: number) => {
    setSelectedImpact({ category, vendor, practice, amount });
    setIsDonationModalOpen(true);
  };

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

  // Function to render markdown links as clickable links
  const renderMarkdownLinks = (text: string): React.ReactNode => {
    // Split text by markdown links
    const parts = text.split(/(\[[^\]]+\]\([^)]+\))/g);
    
    return (
      <>
        {parts.map((part, index) => {
          // Check if this part is a markdown link
          const linkMatch = part.match(/\[([^\]]+)\]\(([^)]+)\)/);
          if (linkMatch) {
            const [, text, url] = linkMatch;
            return (
              <a
                key={index}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline"
                onClick={(e) => e.stopPropagation()}
              >
                {text}
              </a>
            );
          }
          return part;
        })}
      </>
    );
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-800">
          Ethical Impact By Category
        </h2>
        <div className="w-64">
          <input
            type="text"
            placeholder="Search categories..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
      </div>
      
      {filteredCategories.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No ethical impact data available
        </div>
      ) : (
        <div className="space-y-6">
          {/* Loop through categories */}
          {filteredCategories.map((category) => (
            <div 
              key={category.name} 
              className={`border rounded-lg overflow-hidden shadow-sm cursor-pointer transition-colors ${
                selectedCategory === category.name ? 'ring-2 ring-blue-400' : ''
              }`}
              onClick={() => handleCategorySelect(category.name)}
            >
              {/* Category Header */}
              <div className={`px-4 py-3 ${getCategoryBgColor(category.name)} flex justify-between items-center`}>
                <div className="flex items-center">
                  <span className="text-2xl mr-2">{getCategoryIcon(category.name)}</span>
                  <h3 className="font-bold text-gray-800">{category.name}</h3>
                  <span className="ml-2 text-sm text-gray-600">({category.practices.length} items)</span>
                </div>
                <div className={`font-bold ${getImpactColorClass(category.netImpact)}`}>
                  Net: ${Math.abs(category.netImpact).toFixed(2)}
                </div>
              </div>
              
              {/* Column Headers */}
              <div className="grid grid-cols-7 gap-2 px-4 py-2 bg-gray-50 border-b border-t border-gray-200 text-xs font-semibold text-gray-600">
                <div className="col-span-4">Details</div>
                <div className="col-span-2 text-right">Impact</div>
                <div className="col-span-1 text-right">Action</div>
              </div>
              
              {/* Practice Rows */}
              <div className="divide-y divide-gray-200">
                {category.practices
                  .sort((a, b) => {
                    // Sort negative impacts first (most negative to least)
                    if (!a.isPositive && !b.isPositive) {
                      return a.amount - b.amount;
                    }
                    // Sort positive impacts last (most positive to least)
                    if (a.isPositive && b.isPositive) {
                      return b.amount - a.amount;
                    }
                    // Negative impacts come before positive impacts
                    return a.isPositive ? 1 : -1;
                  })
                  .map((practice, pIndex) => (
                  <div 
                    key={`${practice.name}-${pIndex}`} 
                    className={`grid grid-cols-7 gap-2 px-4 py-3 ${
                      practice.isPositive ? "bg-green-50" : "bg-white"
                    }`}
                  >
                    <div className="col-span-4">
                      <div className="flex flex-wrap gap-1 mb-1">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {practice.name}
                        </span>
                        {practice.weight && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            {practice.weight}%
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{renderMarkdownLinks(practice.information)}</p>
                    </div>
                    <div className="col-span-2 text-right">
                      <span className={`font-medium ${practice.isPositive ? "text-green-600" : "text-red-600"}`}>
                        ${Math.abs(practice.amount).toFixed(2)}
                      </span>
                    </div>
                    <div className="col-span-1 text-right">
                      {!practice.isPositive && (
                        <button
                          className="text-xs bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOffset(
                              category.name,
                              practice.vendor || "",
                              practice.name,
                              practice.amount
                            );
                          }}
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
              Total Entries: {filteredCategories.reduce((sum, cat) => sum + cat.practices.length, 0)}
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