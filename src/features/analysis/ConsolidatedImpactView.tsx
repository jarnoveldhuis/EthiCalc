"use client";

import React, { useState, useMemo } from "react";
import { Transaction } from "@/shared/types/transactions";
import { DonationModal } from "@/features/charity/DonationModal";

interface ConsolidatedImpactViewProps {
  transactions: Transaction[];
  totalSocietalDebt: number;
}

interface PracticeImpact {
  name: string;
  amount: number;
  isEthical: boolean;
  vendorContributions: {
    vendorName: string;
    amount: number;
    percentage: number;
  }[];
}

export function ConsolidatedImpactView({
  transactions,
  totalSocietalDebt,
}: ConsolidatedImpactViewProps) {
  const [selectedPractice, setSelectedPractice] = useState<string | null>(null);
  const [isDonationModalOpen, setIsDonationModalOpen] = useState(false);

  // Group by practice directly - safely handling empty arrays
  const practiceImpacts = useMemo(() => {
    // Guard against undefined or empty transactions
    if (!transactions || transactions.length === 0) {
      return [];
    }
    
    // Create a mapping to track practice impacts
    const impactsByPractice: Record<string, PracticeImpact> = {};
    
    // Process all transactions
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
        if (!impactsByPractice[practice]) {
          impactsByPractice[practice] = {
            name: practice,
            amount: 0,
            isEthical: false,
            vendorContributions: []
          };
        }
        
        // Add to practice total
        impactsByPractice[practice].amount += amount;
        
        // Add vendor contribution
        const existingVendor = impactsByPractice[practice].vendorContributions.find(
          v => v.vendorName === transaction.name
        );
        
        if (existingVendor) {
          existingVendor.amount += amount;
        } else {
          impactsByPractice[practice].vendorContributions.push({
            vendorName: transaction.name,
            amount,
            percentage: 0 // Will calculate after all contributions are added
          });
        }
      });
      
      // Process ethical practices (negative debt)
      ethicalPractices.forEach(practice => {
        const weight = practiceWeights[practice] || 0;
        const amount = -1 * (transaction.amount * (weight / 100));
        
        // Initialize practice if needed
        if (!impactsByPractice[practice]) {
          impactsByPractice[practice] = {
            name: practice,
            amount: 0,
            isEthical: true,
            vendorContributions: []
          };
        }
        
        // Add to practice total
        impactsByPractice[practice].amount += amount;
        
        // Add vendor contribution
        const existingVendor = impactsByPractice[practice].vendorContributions.find(
          v => v.vendorName === transaction.name
        );
        
        if (existingVendor) {
          existingVendor.amount += amount;
        } else {
          impactsByPractice[practice].vendorContributions.push({
            vendorName: transaction.name,
            amount,
            percentage: 0 // Will calculate after all contributions are added
          });
        }
      });
    });
    
    // Calculate percentages for vendor contributions
    Object.values(impactsByPractice).forEach(practice => {
      const totalAmount = Math.abs(practice.amount);
      
      practice.vendorContributions.forEach(vendor => {
        vendor.percentage = totalAmount > 0 ? (Math.abs(vendor.amount) / totalAmount) * 100 : 0;
      });
      
      // Sort vendor contributions by percentage (descending)
      practice.vendorContributions.sort((a, b) => b.percentage - a.percentage);
    });
    
    // Convert to array and sort by absolute impact (descending)
    return Object.values(impactsByPractice).sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  }, [transactions]);

  // Calculate positive and negative impact totals
  const positiveImpact = useMemo(() => {
    return practiceImpacts
      .filter(practice => practice.amount < 0) // Note: negative amount = positive impact
      .reduce((sum, practice) => sum + practice.amount, 0);
  }, [practiceImpacts]);

  const negativeImpact = useMemo(() => {
    return practiceImpacts
      .filter(practice => practice.amount > 0) // Note: positive amount = negative impact
      .reduce((sum, practice) => sum + practice.amount, 0);
  }, [practiceImpacts]);

  // Handle offset all
  const handleOffsetAll = () => {
    setSelectedPractice("all");
    setIsDonationModalOpen(true);
  };

  // Handle practice offset
  const handleOffsetPractice = (practiceName: string) => {
    setSelectedPractice(practiceName);
    setIsDonationModalOpen(true);
  };

  // Get selected amount for the donation modal
  const getSelectedAmount = () => {
    if (selectedPractice === "all") {
      return Math.max(0, totalSocietalDebt); // Only allow offsetting positive societal debt
    }
    
    const practice = practiceImpacts.find(p => p.name === selectedPractice);
    return practice && practice.amount > 0 ? practice.amount : 0;
  };

  // Helper function to get practice color based on ethical status
  function getPracticeColorClass(isEthical: boolean, amount: number): string {
    if (isEthical || amount < 0) {
      return "border-green-500 bg-green-50";
    }
    return "border-red-500 bg-red-50";
  }
  
  return (
    <div className="p-2 sm:p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">
        Your Spending Impact
      </h2>
      
      {/* Impact visualization bar */}
      <div className="mb-6">
        <div className="flex justify-between text-sm mb-1">
          <div className="text-green-600 font-medium">
            ${Math.abs(positiveImpact).toFixed(2)}
          </div>
          <div className="text-red-600 font-medium">
            ${Math.abs(negativeImpact).toFixed(2)}
          </div>
        </div>
        <div className="flex items-center mb-2">
          <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
            {/* Positive impact (green) */}
            <div 
              className="bg-green-500 h-full float-left" 
              style={{ 
                width: `${Math.min(Math.abs(positiveImpact) / (Math.abs(positiveImpact) + Math.abs(negativeImpact) || 1) * 100, 100)}%` 
              }}
            />
            {/* Negative impact (red) */}
            <div 
              className="bg-red-500 h-full float-right" 
              style={{ 
                width: `${Math.min(Math.abs(negativeImpact) / (Math.abs(positiveImpact) + Math.abs(negativeImpact) || 1) * 100, 100)}%` 
              }}
            />
          </div>
        </div>
      </div>
      
      {/* Practice impacts */}
      <div className="space-y-3 mt-4 mb-6 sm:mb-8">
        {practiceImpacts.map((practice, index) => (
          <div 
            key={index} 
            className="border rounded-lg overflow-hidden shadow-sm"
          >
            <div className={`p-2 sm:p-3 border-l-4 ${getPracticeColorClass(practice.isEthical, practice.amount)}`}>
              <div className="grid grid-cols-12 gap-2 items-center mb-2">
                <h4 className="col-span-5 sm:col-span-5 font-bold text-gray-800 truncate max-w-full">{practice.name}</h4>
                <div className="col-span-3 sm:col-span-3">
                  {/* Empty space for consistency with category view */}
                </div>
                <div className="col-span-2 sm:col-span-2 text-right">
                  <div className={`font-bold ${practice.amount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    ${Math.abs(practice.amount).toFixed(2)}
                  </div>
                </div>
                <div className="col-span-2 sm:col-span-2 text-right">
                  {practice.amount > 0 ? (
                    <button
                      onClick={() => handleOffsetPractice(practice.name)}
                      className="bg-green-100 hover:bg-green-200 text-green-800 px-3 py-1 rounded text-sm transition-colors w-full sm:w-auto"
                    >
                      Offset
                    </button>
                  ) : (
                    <button
                      disabled
                      className="bg-gray-100 text-gray-400 px-3 py-1 rounded text-sm cursor-not-allowed w-full sm:w-auto"
                    >
                      Offset
                    </button>
                  )}
                </div>
              </div>
              
              {/* Vendor contributions */}
              <div className="mt-1 sm:mt-2">
                {practice.vendorContributions.length === 0 ? (
                  <p className="text-xs sm:text-sm text-gray-500 italic">No specific vendors identified</p>
                ) : (
                  <div className="flex flex-wrap gap-1 sm:gap-2">
                    {practice.vendorContributions.map((vendor, idx) => (
                      <div 
                        key={idx} 
                        className={`inline-flex items-center px-1 sm:px-2 py-0.5 rounded-full text-xs font-medium ${
                          vendor.amount > 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                        }`}
                      >
                        <span className="truncate max-w-[100px] sm:max-w-full">{vendor.vendorName}</span>
                        <span className="ml-1 opacity-75">
                          ${Math.abs(vendor.amount).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Total section - balance sheet style */}
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
          practice={selectedPractice === "all" ? "All Societal Debt" : selectedPractice || ""}
          amount={getSelectedAmount()}
          isOpen={isDonationModalOpen}
          onClose={() => setIsDonationModalOpen(false)}
        />
      )}
    </div>
  );
}