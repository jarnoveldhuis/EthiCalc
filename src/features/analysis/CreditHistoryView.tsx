// src/features/analysis/CreditHistoryView.tsx
"use client";

import React, { useState } from "react";
import { UserCreditState } from "../../hooks/useCreditState";
import { Transaction } from "@/shared/types/transactions";

interface CreditHistoryViewProps {
  transactions: Transaction[];
  creditState: UserCreditState | null;
  positiveImpact: number;
}

export function CreditHistoryView({
  transactions,
  creditState,
  positiveImpact
}: CreditHistoryViewProps) {
  const [showAllTransactions, setShowAllTransactions] = useState(false);
  
  // No credit history to show
  if (!creditState) {
    return (
      <div className="p-6 text-center">
        <div className="text-gray-500">No credit history available</div>
      </div>
    );
  }

  // Get positive impact transactions
  const positiveTransactions = transactions.filter(tx => 
    (tx.ethicalPractices && tx.ethicalPractices.length > 0) || 
    (tx.societalDebt && tx.societalDebt < 0)
  ).sort((a, b) => {
    // Sort by date, most recent first
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });
  
  // Only show a subset unless "show all" is toggled
  const displayTransactions = showAllTransactions 
    ? positiveTransactions 
    : positiveTransactions.slice(0, 5);

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4">
        Social Credit History
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Credit Summary Card */}
        <div className="bg-white border rounded-lg shadow-sm p-4">
          <h3 className="font-semibold text-lg mb-2">Credit Summary</h3>
          
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Available Credit:</span>
              <span className="font-bold text-green-600">${positiveImpact.toFixed(2)}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-600">Applied Credit:</span>
              <span className="font-bold text-blue-600">${creditState.appliedCredit.toFixed(2)}</span>
            </div>
            
            <div className="flex justify-between border-t pt-2 mt-2">
              <span className="text-gray-700 font-medium">Total Credit Earned:</span>
              <span className="font-bold text-gray-800">
                ${(positiveImpact + creditState.appliedCredit).toFixed(2)}
              </span>
            </div>
          </div>
          
          {/* Last Applied Info */}
          {creditState.lastAppliedAmount > 0 && (
            <div className="mt-4 pt-3 border-t border-gray-200">
              <div className="text-sm text-gray-600">
                Last credit applied: <span className="font-medium text-green-600">${creditState.lastAppliedAmount.toFixed(2)}</span>
              </div>
              <div className="text-xs text-gray-500">
                {creditState.lastAppliedAt.toDate().toLocaleDateString()} at {creditState.lastAppliedAt.toDate().toLocaleTimeString()}
              </div>
            </div>
          )}
        </div>
        
        {/* Credit Progress Card */}
        <div className="bg-white border rounded-lg shadow-sm p-4">
          <h3 className="font-semibold text-lg mb-2">Credit Progress</h3>
          
          <div className="space-y-4">
            {/* Progress visualization */}
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Applied</span>
                <span className="text-gray-600">Available</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                {/* Calculate percentages for the progress bar */}
                {(() => {
                  const total = positiveImpact + creditState.appliedCredit;
                  const appliedPercent = total > 0 ? (creditState.appliedCredit / total) * 100 : 0;
                  const availablePercent = total > 0 ? (positiveImpact / total) * 100 : 0;
                  
                  return (
                    <>
                      <div 
                        className="bg-blue-500 h-full float-left" 
                        style={{ width: `${appliedPercent}%` }} 
                      />
                      <div 
                        className="bg-green-500 h-full float-right" 
                        style={{ width: `${availablePercent}%` }} 
                      />
                    </>
                  );
                })()}
              </div>
            </div>
            
            <div className="text-sm text-gray-600">
              <p>You&apos;ve applied <span className="font-medium text-blue-600">{Math.round((creditState.appliedCredit / (positiveImpact + creditState.appliedCredit || 1)) * 100)}%</span> of your total earned credit.</p>
            </div>
            
            {/* Encouragement message */}
            <div className="text-sm italic text-gray-600 border-t pt-3 mt-3">
              {positiveImpact > 0 ? (
                <p>You have ${positiveImpact.toFixed(2)} in available credit. Apply it to offset your social debt!</p>
              ) : (
                <p>Make positive impact purchases to earn more social credit.</p>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Positive Impact Transactions */}
      <div className="mb-6">
        <h3 className="font-semibold text-lg mb-3">Positive Impact Sources</h3>
        
        {positiveTransactions.length === 0 ? (
          <div className="text-center p-4 bg-gray-50 rounded border border-gray-200">
            <p className="text-gray-500">No positive impact transactions found.</p>
            <p className="text-sm text-gray-400 mt-1">Purchases with ethical practices generate positive credit.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border rounded-lg">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="py-2 px-4 border-b text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="py-2 px-4 border-b text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Merchant</th>
                    <th className="py-2 px-4 border-b text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ethical Practice</th>
                    <th className="py-2 px-4 border-b text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="py-2 px-4 border-b text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Credit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {displayTransactions.map((tx, index) => (
                    <tr key={index} className={tx.creditApplied ? "bg-blue-50" : ""}>
                      <td className="py-2 px-4 text-sm text-gray-500">{tx.date}</td>
                      <td className="py-2 px-4 text-sm font-medium text-gray-800">{tx.name}</td>
                      <td className="py-2 px-4 text-sm text-gray-600">
                        {tx.ethicalPractices && tx.ethicalPractices.length > 0 ? (
                          tx.ethicalPractices.join(", ")
                        ) : (
                          <span className="text-gray-400 italic">-</span>
                        )}
                      </td>
                      <td className="py-2 px-4 text-sm text-right font-medium">${tx.amount.toFixed(2)}</td>
                      <td className="py-2 px-4 text-sm text-right font-medium text-green-600">
                        {tx.societalDebt && tx.societalDebt < 0 ? (
                          `$${Math.abs(tx.societalDebt).toFixed(2)}`
                        ) : (
                          "$0.00"
                        )}
                        {tx.creditApplied && (
                          <span className="ml-1 text-xs text-blue-500">(Applied)</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {positiveTransactions.length > 5 && (
              <div className="mt-3 text-center">
                <button 
                  onClick={() => setShowAllTransactions(!showAllTransactions)}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  {showAllTransactions ? "Show Less" : `Show All (${positiveTransactions.length})`}
                </button>
              </div>
            )}
          </>
        )}
      </div>
      
      {/* Credit Usage Tips */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-800 mb-2">About Social Credit</h3>
        <p className="text-sm text-blue-700 mb-2">
          Social credit represents the positive ethical impact of your purchases. You can apply this credit to offset your social debt from less ethical purchases.
        </p>
        <ul className="text-sm text-blue-700 list-disc pl-5 space-y-1">
          <li>Credit is earned from purchases with positive ethical practices</li>
          <li>Apply your credit to offset your societal debt</li>
          <li>Track your progress and impact over time</li>
        </ul>
      </div>
    </div>
  );
}