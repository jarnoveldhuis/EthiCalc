// src/features/transactions/PracticeDebtTable.tsx
import { Transaction } from "@/shared/types/transactions";
import React, { useState } from "react";
import { DonationModal } from "@/features/charity/DonationModal";

interface PracticeDebtTableProps {
  practiceDonations: Record<string, { charity: { name: string; url: string } | null; amount: number }>;
  transactions: Transaction[];
  totalSocietalDebt: number;
  selectedCharity?: string | null;
}

export function PracticeDebtTable({
  practiceDonations,
  transactions,
  totalSocietalDebt,
}: PracticeDebtTableProps) {
  const [selectedPractice, setSelectedPractice] = useState<string | null>(null);
  const [isDonationModalOpen, setIsDonationModalOpen] = useState(false);

  // Early return if no data
  if (totalSocietalDebt === 0 || Object.keys(practiceDonations).length === 0) {
    return null;
  }

  // Prepare sorted practices for the table rows
  const sortedPractices = Object.entries(practiceDonations)
    .sort(([, a], [, b]) => Math.abs(b.amount) - Math.abs(a.amount));
  
  const debtColorClass = totalSocietalDebt > 0 ? "text-red-500" : "text-green-500";

  // Helper function to find information for a practice
  const findPracticeInfo = (practice: string): string => {
    // Check all transactions for information about this practice
    for (const tx of transactions) {
      if (tx.information && tx.information[practice]) {
        return tx.information[practice];
      }
    }
    return "No details available";
  };

  // Find search term for a practice if available
  const getPracticeSearchTerm = (practice: string): string | undefined => {
    for (const tx of transactions) {
      if (tx.practiceSearchTerms && tx.practiceSearchTerms[practice]) {
        return tx.practiceSearchTerms[practice];
      }
    }
    return undefined;
  };

  // Handle offset click for a specific practice
  const handleOffsetPractice = (practice: string) => {
    setSelectedPractice(practice);
    setIsDonationModalOpen(true);
  };

  // Handle offset all button
  const handleOffsetAll = () => {
    setSelectedPractice("All Societal Debt");
    setIsDonationModalOpen(true);
  };

  return (
    <div className="bg-gray-50 p-4 rounded-lg shadow-sm mt-4">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">
        Ethical Impact Summary
      </h2>
      
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-gray-300">
              <th className="text-left text-gray-700 p-2">Practice</th>
              <th className="text-left text-gray-700 p-2">Impact</th>
              <th className="text-right text-gray-700 p-2">Amount</th>
              <th className="text-center text-gray-700 p-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {sortedPractices.map(([practice, { amount }], i) => {
              const practiceInfo = findPracticeInfo(practice);
              const amountColorClass = amount >= 0 ? "text-red-600" : "text-green-600";
              const searchTerm = getPracticeSearchTerm(practice);
              
              return (
                <tr key={i} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className={`p-2 font-medium ${amountColorClass}`}>
                    {practice}
                    {searchTerm && (
                      <span className="text-xs ml-2 text-gray-500">
                        #{searchTerm}
                      </span>
                    )}
                  </td>
                  <td className="p-2 text-gray-700 italic">
                    {practiceInfo || "No information available"}
                  </td>
                  <td className={`p-2 text-right font-bold ${amountColorClass}`}>
                    ${Math.abs(amount).toFixed(2)}
                  </td>
                  <td className="p-2 text-center">
                    {amount > 0 && (
                      <button
                        onClick={() => handleOffsetPractice(practice)}
                        className="bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded text-sm"
                      >
                        Offset
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}

            {/* Total Debt Row */}
            <tr className="border-t-2 border-gray-300 font-bold">
              <td colSpan={2} className="p-2 text-right text-gray-800 font-bold">
                Total Impact:
              </td>
              <td className={`p-2 text-right text-xl ${debtColorClass}`}>
                ${Math.abs(totalSocietalDebt).toFixed(2)}
              </td>
              <td className="p-2 text-center">
                {totalSocietalDebt > 0 && (
                  <button
                    onClick={handleOffsetAll}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold shadow"
                  >
                    Offset All
                  </button>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Donation Modal */}
      {isDonationModalOpen && (
        <DonationModal
          practice={selectedPractice || "All Societal Debt"}
          amount={selectedPractice && selectedPractice !== "All Societal Debt" 
            ? practiceDonations[selectedPractice].amount 
            : totalSocietalDebt!}
          isOpen={isDonationModalOpen}
          onClose={() => setIsDonationModalOpen(false)}
        />
      )}
    </div>
  );
}