"use client";

import React, { useState, useMemo, useCallback } from "react";
import { Transaction } from "@/shared/types/transactions";
import { DonationModal } from "@/features/charity/DonationModal";
import { useDonationModal } from "@/hooks/useDonationModal";

interface TransactionTableViewProps {
  transactions: Transaction[];
  totalSocietalDebt: number;
}

type SortKey = keyof Transaction | 'merchant' | 'debt' | 'credit';

interface SortConfig {
  key: SortKey;
  direction: 'asc' | 'desc';
}

export function TransactionTableView({
  transactions,
  totalSocietalDebt,
}: TransactionTableViewProps) {
  const { modalState, openDonationModal, closeDonationModal } = useDonationModal({ transactions });

  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: 'date',
    direction: 'desc'
  });
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  // Move getSortValue inside useMemo to fix the dependency warning
  const sortedTransactions = useMemo(() => {
    const getSortValue = (transaction: Transaction, key: SortKey): string | number => {
      switch (key) {
        case 'date':
          return new Date(transaction.date).getTime();
        case 'amount':
          return transaction.amount ?? 0;
        case 'societalDebt':
          return transaction.societalDebt ?? 0;
        case 'merchant':
          return transaction.name.toLowerCase();
        case 'debt':
          return getDebtAmount(transaction);
        case 'credit':
          return getCreditAmount(transaction);
        default:
          return String(transaction[key] ?? '');
      }
    };

    return [...transactions].sort((a, b) => {
      const aValue = getSortValue(a, sortConfig.key);
      const bValue = getSortValue(b, sortConfig.key);
      
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [transactions, sortConfig]);

  // Calculate totals
  const { totalDebt, totalCredit } = useMemo(() => {
    return sortedTransactions.reduce((acc, tx) => {
      return {
        totalDebt: acc.totalDebt + getDebtAmount(tx),
        totalCredit: acc.totalCredit + getCreditAmount(tx)
      };
    }, { totalDebt: 0, totalCredit: 0 });
  }, [sortedTransactions]);

  // Helper function to extract debt amount from a transaction
  function getDebtAmount(transaction: Transaction): number {
    let debtTotal = 0;
    
    // Sum up amounts from unethical practices
    if (transaction.unethicalPractices && transaction.unethicalPractices.length > 0) {
      transaction.unethicalPractices.forEach((practice: string) => {
        const weight = transaction.practiceWeights?.[practice] || 0;
        debtTotal += transaction.amount * (weight / 100);
      });
    } else if (transaction.societalDebt && transaction.societalDebt > 0) {
      // If we only have overall societal debt and it's positive, that's debt
      debtTotal = transaction.societalDebt;
    }
    
    return debtTotal;
  }

  // Helper function to extract credit amount from a transaction
  function getCreditAmount(transaction: Transaction): number {
    let creditTotal = 0;
    
    // Sum up amounts from ethical practices (as positive numbers)
    if (transaction.ethicalPractices && transaction.ethicalPractices.length > 0) {
      transaction.ethicalPractices.forEach((practice: string) => {
        const weight = transaction.practiceWeights?.[practice] || 0;
        creditTotal += transaction.amount * (weight / 100);
      });
    } else if (transaction.societalDebt && transaction.societalDebt < 0) {
      // If we only have overall societal debt and it's negative, that's credit
      creditTotal = Math.abs(transaction.societalDebt);
    }
    
    return creditTotal;
  }

  // Handle sort request
  const requestSort = useCallback((key: SortKey) => {
    let direction: 'asc' | 'desc' = 'asc';
    
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    
    setSortConfig({ key, direction });
  }, [sortConfig]);

  // Get sort indicator
  const getSortIndicator = useCallback((key: SortKey) => {
    if (sortConfig.key !== key) {
      return null;
    }
    
    return sortConfig.direction === 'asc' ? ' ↑' : ' ↓';
  }, [sortConfig]);

  // Handle donation modal
  const handleOpenDonationModal = (transaction: Transaction) => {
    openDonationModal(transaction.unethicalPractices?.[0] || "All Societal Debt", getDebtAmount(transaction) - getCreditAmount(transaction));
  };

  // Handle offset all
  const handleOffsetAll = () => {
    openDonationModal("All Societal Debt", totalSocietalDebt);
  };

  // Add this function to handle tooltip interactions
  const handleTooltipInteraction = (practice: string, event: React.MouseEvent | React.TouchEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setActiveTooltip(activeTooltip === practice ? null : practice);
  };

  // Helper function to render practice tags
  function renderPracticeTags(transaction: Transaction) {
    const unethicalPractices = transaction.unethicalPractices || [];
    const ethicalPractices = transaction.ethicalPractices || [];
    
    return (
      <>
        {unethicalPractices.map((practice, idx) => {
          const weight = transaction.practiceWeights?.[practice] || 0;
          const practiceAmount = transaction.amount * (weight / 100);
          const info = transaction.information?.[practice] || "";
          const tooltipId = `unethical-${transaction.id || transaction.name}-${idx}-${practice}`;
          
          return (
            <div 
              key={tooltipId}
              className="group relative inline-block"
              onTouchStart={(e) => handleTooltipInteraction(tooltipId, e)}
              onMouseEnter={() => setActiveTooltip(tooltipId)}
              onMouseLeave={() => setActiveTooltip(null)}
            >
              <div className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                {practice} <span className="ml-1 font-bold">${practiceAmount.toFixed(2)}</span>
                {info && (
                  <span className="ml-1 text-red-600">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </span>
                )}
              </div>
              {info && activeTooltip === tooltipId && (
                <div className="fixed md:absolute z-50 md:z-10 bg-gray-800 text-white text-xs rounded py-1 px-2 mt-1 left-0 min-w-[200px] max-w-[250px] shadow-lg">
                  {info}
                  <div className="absolute -top-1 left-4 w-2 h-2 bg-gray-800 transform rotate-45"></div>
                </div>
              )}
            </div>
          );
        })}
        
        {ethicalPractices.map((practice, idx) => {
          const weight = transaction.practiceWeights?.[practice] || 0;
          const practiceAmount = transaction.amount * (weight / 100);
          const info = transaction.information?.[practice] || "";
          const tooltipId = `ethical-${transaction.id || transaction.name}-${idx}-${practice}`;
          
          return (
            <div 
              key={tooltipId}
              className="group relative inline-block"
              onTouchStart={(e) => handleTooltipInteraction(tooltipId, e)}
              onMouseEnter={() => setActiveTooltip(tooltipId)}
              onMouseLeave={() => setActiveTooltip(null)}
            >
              <div className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                {practice} <span className="ml-1 font-bold">${practiceAmount.toFixed(2)}</span>
                {info && (
                  <span className="ml-1 text-green-600">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </span>
                )}
              </div>
              {info && activeTooltip === tooltipId && (
                <div className="fixed md:absolute z-50 md:z-10 bg-gray-800 text-white text-xs rounded py-1 px-2 mt-1 left-0 min-w-[200px] max-w-[250px] shadow-lg">
                  {info}
                  <div className="absolute -top-1 left-4 w-2 h-2 bg-gray-800 transform rotate-45"></div>
                </div>
              )}
            </div>
          );
        })}
      </>
    );
  }

  return (
    <div className="p-3 sm:p-6">
      <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-3">
        Transaction Analysis
      </h2>
      
      <p className="text-sm text-gray-600 mb-4">
        This view shows transactions with their ethical impact breakdown.
        Click column headers to sort. Hover over practice tags to see detailed descriptions.
      </p>
      
      {/* Table View */}
      <div className="mb-6">
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 border">
            <thead className="bg-gray-50">
              <tr>
                <th 
                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => requestSort('date')}
                >
                  Date{getSortIndicator('date')}
                </th>
                <th 
                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => requestSort('merchant')}
                >
                  Merchant{getSortIndicator('merchant')}
                </th>
                <th 
                  className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => requestSort('amount')}
                >
                  Amount{getSortIndicator('amount')}
                </th>
                <th 
                  className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => requestSort('debt')}
                >
                  Debt{getSortIndicator('debt')}
                </th>
                <th 
                  className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => requestSort('credit')}
                >
                  Credit{getSortIndicator('credit')}
                </th>
                <th 
                  className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedTransactions.map((transaction, index) => {
                const debtAmount = getDebtAmount(transaction);
                const creditAmount = getCreditAmount(transaction);
                
                return (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500">
                      {transaction.date}
                    </td>
                    <td className="px-3 py-3 text-sm">
                      <div className="font-medium text-gray-900">{transaction.name}</div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {renderPracticeTags(transaction)}
                      </div>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm text-right">
                      ${transaction.amount.toFixed(2)}
                    </td>
                    <td className="px-3 py-3 text-sm text-center">
                      {debtAmount > 0 ? (
                        <span className="font-medium text-red-600">${debtAmount.toFixed(2)}</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-sm text-center">
                      {creditAmount > 0 ? (
                        <span className="font-medium text-green-600">${creditAmount.toFixed(2)}</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {debtAmount > creditAmount ? (
                        <button
                          onClick={() => handleOpenDonationModal(transaction)}
                          className="bg-green-600 hover:bg-green-700 text-white text-xs px-2 py-1 rounded"
                        >
                          Offset
                        </button>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-gray-50">
              <tr>
                <td colSpan={3} className="px-3 py-3 text-sm font-medium text-gray-700 text-right border-t">
                  Totals:
                </td>
                <td className="px-3 py-3 text-sm text-center font-bold border-t">
                  <span className="text-red-600">${totalDebt.toFixed(2)}</span>
                </td>
                <td className="px-3 py-3 text-sm text-center font-bold border-t">
                  <span className="text-green-600">${totalCredit.toFixed(2)}</span>
                </td>
                <td className="px-3 py-3 text-sm text-center border-t">
                  {totalDebt > totalCredit && (
                    <button
                      onClick={handleOffsetAll}
                      className="bg-green-600 hover:bg-green-700 text-white text-xs px-2 py-1 rounded"
                    >
                      Offset All
                    </button>
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden space-y-4">
          {sortedTransactions.map((transaction, index) => {
            const debtAmount = getDebtAmount(transaction);
            const creditAmount = getCreditAmount(transaction);
            
            return (
              <div key={index} className="bg-white rounded-lg shadow-sm border p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-medium text-gray-900">{transaction.name}</div>
                    <div className="text-sm text-gray-500">{transaction.date}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">${transaction.amount.toFixed(2)}</div>
                    {debtAmount > creditAmount ? (
                      <button
                        onClick={() => handleOpenDonationModal(transaction)}
                        className="bg-green-600 hover:bg-green-700 text-white text-xs px-2 py-1 rounded mt-1"
                      >
                        Offset
                      </button>
                    ) : null}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div className="text-center">
                    <div className="text-xs text-gray-500">Debt</div>
                    {debtAmount > 0 ? (
                      <span className="font-medium text-red-600">${debtAmount.toFixed(2)}</span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-500">Credit</div>
                    {creditAmount > 0 ? (
                      <span className="font-medium text-green-600">${creditAmount.toFixed(2)}</span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1">
                  {renderPracticeTags(transaction)}
                </div>
              </div>
            );
          })}

          {/* Mobile Totals */}
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="grid grid-cols-2 gap-2">
              <div className="text-center">
                <div className="text-xs text-gray-500">Total Debt</div>
                <span className="font-bold text-red-600">${totalDebt.toFixed(2)}</span>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-500">Total Credit</div>
                <span className="font-bold text-green-600">${totalCredit.toFixed(2)}</span>
              </div>
            </div>
            {totalDebt > totalCredit && (
              <div className="text-center mt-3">
                <button
                  onClick={handleOffsetAll}
                  className="bg-green-600 hover:bg-green-700 text-white text-sm px-4 py-2 rounded"
                >
                  Offset All
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Donation Modal */}
      {modalState.isOpen && (
        <DonationModal
          practice={modalState.practice}
          amount={modalState.amount}
          isOpen={modalState.isOpen}
          onClose={closeDonationModal}
        />
      )}
    </div>
  );
}