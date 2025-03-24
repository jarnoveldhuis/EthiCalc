"use client";

import React, { useState, useMemo } from "react";
import { Transaction } from "@/shared/types/transactions";
import { DonationModal } from "@/features/charity/DonationModal";

interface TransactionTableViewProps {
  transactions: Transaction[];
  totalSocietalDebt: number;
}

export function TransactionTableView({
  transactions,
  totalSocietalDebt,
}: TransactionTableViewProps) {
  // Helper function for sorting - defined BEFORE it's used because JavaScript is a fucking monster
  const getValue = (tx: Transaction, key: string): string | number => {
    switch (key) {
      case 'date': return tx.date;
      case 'merchant': return tx.name;
      case 'amount': return tx.amount;
      case 'debit': return getDebitAmount(tx);
      case 'credit': return getCreditAmount(tx);
      default: return '';
    }
  };

  const [isDonationModalOpen, setIsDonationModalOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'ascending' | 'descending';
  }>({
    key: 'date',
    direction: 'descending'
  });

  // Helper function to extract debit amount from a transaction
  function getDebitAmount(transaction: Transaction): number {
    let debitTotal = 0;
    
    // Sum up amounts from unethical practices
    if (transaction.unethicalPractices && transaction.unethicalPractices.length > 0) {
      transaction.unethicalPractices.forEach((practice: string) => {
        const weight = transaction.practiceWeights?.[practice] || 0;
        debitTotal += transaction.amount * (weight / 100);
      });
    } else if (transaction.societalDebt && transaction.societalDebt > 0) {
      // If we only have overall societal debt and it's positive, that's debit
      debitTotal = transaction.societalDebt;
    }
    
    return debitTotal;
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

  // Sort transactions
  const sortedTransactions = useMemo(() => {
    return [...transactions].sort((a, b) => {
      const aValue = getValue(a, sortConfig.key);
      const bValue = getValue(b, sortConfig.key);
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortConfig.direction === 'ascending' 
          ? aValue.localeCompare(bValue) 
          : bValue.localeCompare(aValue);
      }
      
      return sortConfig.direction === 'ascending' 
        ? (aValue as number) - (bValue as number) 
        : (bValue as number) - (aValue as number);
    });
  }, [transactions, sortConfig]);

  // Calculate totals
  const { totalDebt, totalCredit } = useMemo(() => {
    return sortedTransactions.reduce((acc, tx) => {
      return {
        totalDebt: acc.totalDebt + getDebitAmount(tx),
        totalCredit: acc.totalCredit + getCreditAmount(tx)
      };
    }, { totalDebt: 0, totalCredit: 0 });
  }, [sortedTransactions]);

  // Handle sort request
  const requestSort = (key: string) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    
    setSortConfig({ key, direction });
  };

  // Get sort indicator
  const getSortIndicator = (key: string) => {
    if (sortConfig.key !== key) {
      return null;
    }
    
    return sortConfig.direction === 'ascending' ? ' ↑' : ' ↓';
  };

  // Handle donation modal
  const handleOpenDonationModal = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setIsDonationModalOpen(true);
  };

  // Function to handle donation for total societal debt
  const handleOffsetAll = () => {
    setSelectedTransaction(null);
    setIsDonationModalOpen(true);
  };

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
      <div className="mb-6 overflow-x-auto">
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
                onClick={() => requestSort('debit')}
              >
                Debit{getSortIndicator('debit')}
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
              const debitAmount = getDebitAmount(transaction);
              const creditAmount = getCreditAmount(transaction);
              const unethicalPractices = transaction.unethicalPractices || [];
              const ethicalPractices = transaction.ethicalPractices || [];
              
              return (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500">
                    {transaction.date}
                  </td>
                  <td className="px-3 py-3 text-sm">
                    <div className="font-medium text-gray-900">{transaction.name}</div>
                    
                    {/* Practice descriptions under the merchant as tooltips */}
                    {(unethicalPractices.length > 0 || ethicalPractices.length > 0) && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {unethicalPractices.map((practice, idx) => {
                          const weight = transaction.practiceWeights?.[practice] || 0;
                          const practiceAmount = transaction.amount * (weight / 100);
                          const info = transaction.information?.[practice] || "";
                          
                          return (
                            <div 
                              key={`unethical-${idx}`}
                              className="group relative inline-block"
                            >
                              <div className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                {practice} <span className="ml-1 font-bold">${practiceAmount.toFixed(2)}</span>
                              </div>
                              {info && (
                                <div className="absolute z-10 invisible group-hover:visible bg-gray-800 text-white text-xs rounded py-1 px-2 mt-1 left-0 min-w-[200px] max-w-[250px] shadow-lg">
                                  {info}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        
                        {ethicalPractices.map((practice, idx) => {
                          const weight = transaction.practiceWeights?.[practice] || 0;
                          const practiceAmount = transaction.amount * (weight / 100);
                          const info = transaction.information?.[practice] || "";
                          
                          return (
                            <div 
                              key={`ethical-${idx}`}
                              className="group relative inline-block"
                            >
                              <div className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                {practice} <span className="ml-1 font-bold">${practiceAmount.toFixed(2)}</span>
                              </div>
                              {info && (
                                <div className="absolute z-10 invisible group-hover:visible bg-gray-800 text-white text-xs rounded py-1 px-2 mt-1 left-0 min-w-[200px] max-w-[250px] shadow-lg">
                                  {info}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-right">
                    ${transaction.amount.toFixed(2)}
                  </td>
                  <td className="px-3 py-3 text-sm text-center">
                    {debitAmount > 0 ? (
                      <span className="font-medium text-red-600">${debitAmount.toFixed(2)}</span>
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
                    {debitAmount > creditAmount ? (
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
      
      {/* Donation Modal */}
      {isDonationModalOpen && (
        <DonationModal
          practice={selectedTransaction 
            ? `${selectedTransaction.name} Impact` 
            : "All Societal Debt"}
          amount={selectedTransaction 
            ? getDebitAmount(selectedTransaction) - getCreditAmount(selectedTransaction)
            : totalSocietalDebt}
          isOpen={isDonationModalOpen}
          onClose={() => {
            setIsDonationModalOpen(false);
            setSelectedTransaction(null);
          }}
        />
      )}
    </div>
  );
}