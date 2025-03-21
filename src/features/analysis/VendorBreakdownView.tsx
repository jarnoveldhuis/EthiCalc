// src/features/analysis/VendorBreakdownView.tsx
"use client";

import React, { useState, useMemo } from "react";
import { Transaction } from "@/shared/types/transactions";
import { DonationModal } from "@/features/charity/DonationModal";

interface VendorBreakdownViewProps {
  transactions: Transaction[];
  totalSocietalDebt: number;
  getColorClass: (value: number) => string;
}

interface VendorData {
  name: string;
  totalSpent: number;
  societalDebt: number;
  debtPercentage: number;
  transactions: Transaction[];
  practices: {
    name: string;
    isEthical: boolean;
    impact: number;
    information?: string;
  }[];
}

export function VendorBreakdownView({
  transactions,
  totalSocietalDebt,
  getColorClass,
}: VendorBreakdownViewProps) {
  const [expandedVendors, setExpandedVendors] = useState<Record<string, boolean>>({});
  const [selectedVendor, setSelectedVendor] = useState<string | null>(null);
  const [isDonationModalOpen, setIsDonationModalOpen] = useState(false);

  // Process transactions by vendor
  const vendorsData = useMemo(() => {
    const vendorMap = new Map<string, VendorData>();

    // Group transactions by vendor name
    transactions.forEach(transaction => {
      const vendorName = transaction.name;
      
      if (!vendorName) return;

      // Initialize vendor data if needed
      if (!vendorMap.has(vendorName)) {
        vendorMap.set(vendorName, {
          name: vendorName,
          totalSpent: 0,
          societalDebt: 0,
          debtPercentage: 0,
          transactions: [],
          practices: []
        });
      }

      const vendorData = vendorMap.get(vendorName)!;
      
      // Add transaction data
      vendorData.totalSpent += transaction.amount;
      vendorData.societalDebt += transaction.societalDebt || 0;
      vendorData.transactions.push(transaction);

      // Collect practice information from transaction
      const unethicalPractices = transaction.unethicalPractices || [];
      const ethicalPractices = transaction.ethicalPractices || [];
      const practiceDebts = transaction.practiceDebts || {};
      const information = transaction.information || {};
      
      // Add unethical practices
      unethicalPractices.forEach(practiceName => {
        // Check if this practice is already in the array
        const existingPractice = vendorData.practices.find(p => p.name === practiceName);
        
        if (existingPractice) {
          // Update existing practice
          existingPractice.impact += practiceDebts[practiceName] || 0;
        } else {
          // Add new practice
          vendorData.practices.push({
            name: practiceName,
            isEthical: false,
            impact: practiceDebts[practiceName] || 0,
            information: information[practiceName]
          });
        }
      });
      
      // Add ethical practices
      ethicalPractices.forEach(practiceName => {
        // Check if this practice is already in the array
        const existingPractice = vendorData.practices.find(p => p.name === practiceName);
        
        if (existingPractice) {
          // Update existing practice
          existingPractice.impact += practiceDebts[practiceName] || 0;
        } else {
          // Add new practice
          vendorData.practices.push({
            name: practiceName,
            isEthical: true,
            impact: practiceDebts[practiceName] || 0,
            information: information[practiceName]
          });
        }
      });
    });

    // Calculate debt percentage and filter out vendors with no transactions
    vendorMap.forEach(vendor => {
      vendor.debtPercentage = vendor.totalSpent > 0 
        ? (vendor.societalDebt / vendor.totalSpent) * 100 
        : 0;
        
      // Sort practices by absolute impact (highest first)
      vendor.practices.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
    });

    // Convert map to array and sort by total debt
    return Array.from(vendorMap.values())
      .filter(vendor => vendor.transactions.length > 0)
      .sort((a, b) => Math.abs(b.societalDebt) - Math.abs(a.societalDebt));
  }, [transactions]);

  // Toggle vendor expansion
  const toggleVendor = (vendorName: string) => {
    setExpandedVendors(prev => ({
      ...prev,
      [vendorName]: !prev[vendorName]
    }));
  };

  // Handle vendor offset button
  const handleOffsetVendor = (vendorName: string) => {
    setSelectedVendor(vendorName);
    setIsDonationModalOpen(true);
  };

  // Get amount to offset for the selected vendor
  const getSelectedAmount = (): number => {
    if (!selectedVendor) return 0;
    
    const vendor = vendorsData.find(v => v.name === selectedVendor);
    return vendor ? Math.max(0, vendor.societalDebt) : 0;
  };

  return (
    <div className="p-2 sm:p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">
        Vendor Impact Analysis
      </h2>
      
      {vendorsData.length === 0 ? (
        <div className="text-center text-gray-500 py-8">
          No vendor data available
        </div>
      ) : (
        <div className="space-y-4">
          {vendorsData.map((vendor) => (
            <div 
              key={vendor.name} 
              className="border rounded-lg overflow-hidden shadow-sm"
            >
              {/* Vendor header - clickable to expand */}
              <div 
                className="p-3 bg-gray-50 border-b border-gray-200 cursor-pointer"
                onClick={() => toggleVendor(vendor.name)}
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center">
                    <span className="mr-2 text-gray-600">
                      {expandedVendors[vendor.name] ? "▼" : "▶"}
                    </span>
                    <h3 className="font-bold text-gray-800">{vendor.name}</h3>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <div className="text-sm text-gray-600">
                      ${vendor.totalSpent.toFixed(2)} spent
                    </div>
                    <div className={`font-bold ${getColorClass(vendor.societalDebt)}`}>
                      ${Math.abs(vendor.societalDebt).toFixed(2)}
                      <span className="text-xs ml-1">
                        {vendor.societalDebt >= 0 ? "impact" : "benefit"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Vendor details when expanded */}
              {expandedVendors[vendor.name] && (
                <div className="p-4 bg-white">
                  {/* Summary stats */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="text-sm text-gray-600">Total Spent</div>
                      <div className="text-lg font-bold">${vendor.totalSpent.toFixed(2)}</div>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="text-sm text-gray-600">Impact</div>
                      <div className={`text-lg font-bold ${getColorClass(vendor.societalDebt)}`}>
                        ${Math.abs(vendor.societalDebt).toFixed(2)}
                      </div>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg sm:col-span-1 col-span-2">
                      <div className="text-sm text-gray-600">Impact Ratio</div>
                      <div className={`text-lg font-bold ${getColorClass(vendor.debtPercentage)}`}>
                        {Math.abs(vendor.debtPercentage).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                  
                  {/* Practices section */}
                  <div className="mb-4">
                    <h4 className="font-semibold text-gray-700 mb-2">Identified Practices</h4>
                    {vendor.practices.length === 0 ? (
                      <p className="text-gray-500 italic">No specific practices identified</p>
                    ) : (
                      <div className="space-y-3">
                        {vendor.practices.map((practice, idx) => (
                          <div 
                            key={idx} 
                            className={`p-3 rounded-lg border ${
                              practice.isEthical
                                ? "border-green-200 bg-green-50"
                                : "border-red-200 bg-red-50"
                            }`}
                          >
                            <div className="flex justify-between items-center mb-1">
                              <div className="font-medium">{practice.name}</div>
                              <div className={`font-bold ${getColorClass(practice.impact)}`}>
                                ${Math.abs(practice.impact).toFixed(2)}
                              </div>
                            </div>
                            
                            {practice.information && (
                              <div className="text-sm text-gray-700">
                                {practice.information}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* Transactions from this vendor */}
                  <div>
                    <h4 className="font-semibold text-gray-700 mb-2">Transaction History</h4>
                    <div className="max-h-60 overflow-y-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Impact</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {vendor.transactions.map((tx, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-600">{tx.date}</td>
                              <td className="px-3 py-2 whitespace-nowrap text-sm text-right">${tx.amount.toFixed(2)}</td>
                              <td className={`px-3 py-2 whitespace-nowrap text-sm text-right font-medium ${getColorClass(tx.societalDebt || 0)}`}>
                                ${Math.abs(tx.societalDebt || 0).toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      
                    </div>
                  </div>
                  
                  {/* Offset button - only for vendors with positive impact (negative is already good) */}
                  {vendor.societalDebt > 0 && (
                    <div className="mt-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOffsetVendor(vendor.name);
                        }}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
                      >
                        Offset ${vendor.societalDebt.toFixed(2)}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      
      {/* Donation modal */}
      {isDonationModalOpen && selectedVendor && (
        <DonationModal
          practice={`${selectedVendor} Impact`}
          amount={getSelectedAmount()}
          isOpen={isDonationModalOpen}
          onClose={() => setIsDonationModalOpen(false)}
        />
      )}
                      {totalSocietalDebt > 0 && (
                  <button
                    className="mt-2 bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-bold shadow transition-colors"
                  >
                    Offset All (${totalSocietalDebt.toFixed(2)})
                  </button>
                )}
    </div>
    
  );
}