// src/features/dashboard/views/BalanceSheetView.jsx
"use client";

import React, { useState, useMemo } from "react";
import { useTransactionStore } from "@/store/transactionStore";
import { Transaction } from "@/shared/types/transactions"; // Make sure Transaction type includes 'citations'
import { DonationModal } from "@/features/charity/DonationModal";
import { useDonationModal } from "@/hooks/useDonationModal";
import { LoadingSpinner } from "@/shared/ui/LoadingSpinner";

// Define props expected from Dashboard parent
interface BalanceSheetViewProps {
  transactions: Transaction[];
}

// Internal data structure interfaces
interface ImpactDetail {
    category: string;
    practice: string;
    transactionDate: string;
    transactionName: string;
    transactionAmount: number;
    impactAmount: number;
    information?: string;
    // We don't need citation here as we'll look it up from the main transaction list
}

// Helper function to format currency
const formatCurrency = (value: number | undefined | null): string => {
    return `$${(value ?? 0).toFixed(2)}`;
};

// Helper to get category icon
const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
        "Climate Change": "🌍", "Environmental Impact": "🌳", "Social Responsibility": "👥",
        "Labor Practices": "👷‍♂️", "Digital Rights": "💻", "Animal Welfare": "🐾",
        "Food Insecurity": "🍽️", Poverty: "💰", Conflict: "⚔️", Inequality: "⚖️",
        "Public Health": "🏥", Uncategorized: "❓",
        "Uncategorized Positive": "✨", "Uncategorized Negative": "💀", // More distinct defaults
         /* Add others if needed */
    };
    return icons[category] || "❓";
};


export function BalanceSheetView({ transactions }: BalanceSheetViewProps) {
    // --- Get impactAnalysis and other relevant states from the store ---
    const { impactAnalysis } = useTransactionStore();
    const { modalState, openDonationModal, closeDonationModal } = useDonationModal();

    // State for expanding categories
    const [expandedPositiveCategories, setExpandedPositiveCategories] = useState<Record<string, boolean>>({});
    const [expandedNegativeCategories, setExpandedNegativeCategories] = useState<Record<string, boolean>>({});

    // --- Derived State from Store ---
    const positiveImpactTotalFromStore = impactAnalysis?.positiveImpact ?? 0;
    const negativeImpactTotalFromStore = impactAnalysis?.negativeImpact ?? 0;
    // const effectiveDebt = impactAnalysis?.effectiveDebt ?? 0; // If needed for offset all

    // --- Process Transactions PROP for Detailed View ---
    const { detailedPositiveImpacts, detailedNegativeImpacts, positiveCategoryTotals, negativeCategoryTotals } = useMemo(() => {
        const posImpacts: Record<string, ImpactDetail[]> = {};
        const negImpacts: Record<string, ImpactDetail[]> = {};
        const posCategoryTotals: Record<string, number> = {};
        const negCategoryTotals: Record<string, number> = {};

        // Use the transactions prop passed from the Dashboard
        transactions?.forEach(tx => {
            // Process Positive Impacts
            (tx.ethicalPractices || []).forEach(practice => {
                const category = tx.practiceCategories?.[practice] || "Uncategorized Positive";
                const weight = tx.practiceWeights?.[practice] || 0;
                const impactAmount = Math.abs(tx.amount * (weight / 100));

                if (!posImpacts[category]) posImpacts[category] = [];
                if (!posCategoryTotals[category]) posCategoryTotals[category] = 0;

                posCategoryTotals[category] += impactAmount;
                posImpacts[category].push({
                    category, practice, transactionDate: tx.date, transactionName: tx.name,
                    transactionAmount: tx.amount, impactAmount: impactAmount,
                    information: tx.information?.[practice] || undefined,
                    // No citation here, we look it up later
                });
            });

            // Process Negative Impacts
            (tx.unethicalPractices || []).forEach(practice => {
                const category = tx.practiceCategories?.[practice] || "Uncategorized Negative";
                const weight = tx.practiceWeights?.[practice] || 0;
                const impactAmount = tx.amount * (weight / 100);

                if (!negImpacts[category]) negImpacts[category] = [];
                 if (!negCategoryTotals[category]) negCategoryTotals[category] = 0;

                negCategoryTotals[category] += impactAmount;
                negImpacts[category].push({
                    category, practice, transactionDate: tx.date, transactionName: tx.name,
                    transactionAmount: tx.amount, impactAmount: impactAmount,
                    information: tx.information?.[practice] || undefined,
                    // No citation here, we look it up later
                });
            });
        });

        // Sort transactions within each category by impact amount
        Object.values(posImpacts).forEach(arr => arr.sort((a, b) => b.impactAmount - a.impactAmount));
        Object.values(negImpacts).forEach(arr => arr.sort((a, b) => b.impactAmount - a.impactAmount));

        // Convert totals to sorted array format
        const sortedPositiveTotals = Object.entries(posCategoryTotals)
            .map(([name, amount]) => ({ name, amount }))
            .sort((a, b) => b.amount - a.amount);
        const sortedNegativeTotals = Object.entries(negCategoryTotals)
            .map(([name, amount]) => ({ name, amount }))
            .sort((a, b) => b.amount - a.amount);

        return {
            detailedPositiveImpacts: posImpacts,
            detailedNegativeImpacts: negImpacts,
            positiveCategoryTotals: sortedPositiveTotals,
            negativeCategoryTotals: sortedNegativeTotals
        };
    }, [transactions]); // Recalculate only when transactions prop changes


    // --- Action Handlers ---
    const handleOffsetCategory = (categoryName: string, amount: number) => {
         if(amount > 0) openDonationModal(categoryName, amount);
    };
    const togglePositiveCategory = (categoryName: string) => setExpandedPositiveCategories(prev => ({ ...prev, [categoryName]: !prev[categoryName] }));
    const toggleNegativeCategory = (categoryName: string) => setExpandedNegativeCategories(prev => ({ ...prev, [categoryName]: !prev[categoryName] }));


    // --- Loading / No Data State ---
    if (!impactAnalysis || !transactions || transactions.length === 0) {
        return (
          <div className="flex items-center justify-center h-64">
            <LoadingSpinner message="Calculating balance sheet..." />
          </div>
        );
    }

    // --- Main Render ---
    return (
        <div className="p-4 md:p-6 space-y-6">
            {/* Detailed Breakdown Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Assets / Ethical Credits Column */}
                 <div className="space-y-4">
                     <h3 className="text-xl font-semibold text-center text-green-700 dark:text-green-400 border-b border-[var(--border-color)] pb-2">
                       Ethical Credits <span className="text-lg">({formatCurrency(positiveImpactTotalFromStore)})</span>
                     </h3>
                     {positiveCategoryTotals.length === 0 && (
                       <div className="card p-6 text-center"> {/* Use .card */}
                         <p className="text-[var(--card-foreground)] opacity-70">No positive impact generated.</p>
                       </div>
                     )}
                     {positiveCategoryTotals.map(({ name: categoryName, amount: categoryTotalAmount }) => (
                         <div key={`pos-cat-${categoryName}`} className="card"> {/* Use .card */}
                             {/* Category Header */}
                             <div
                                role="button" // Accessibility
                                tabIndex={0} // Focusable
                                className="w-full bg-gray-50 dark:bg-gray-700/[.5] p-3 flex justify-between items-center text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors rounded-t-xl cursor-pointer"
                                onClick={() => togglePositiveCategory(categoryName)}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') togglePositiveCategory(categoryName); }} // Keyboard accessibility
                            >
                                 <div className="flex items-center">
                                    <span className="text-lg mr-3">{getCategoryIcon(categoryName)}</span>
                                    <span className="font-semibold text-gray-700 dark:text-gray-200">{categoryName}</span>
                                </div>
                                <div className="flex items-center">
                                    <span className="font-bold text-green-600 dark:text-green-400 mr-3">{formatCurrency(categoryTotalAmount)}</span>
                                    {/* Chevron Icon */}
                                    <svg className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform duration-200 ${expandedPositiveCategories[categoryName] ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                </div>
                             </div>
                             {/* Expanded Detail List */}
                             {expandedPositiveCategories[categoryName] && (
                                 <div className="p-4 border-t border-[var(--border-color)] space-y-3 max-h-96 overflow-y-auto">
                                     {(detailedPositiveImpacts[categoryName] || []).map((detail, index) => {
                                         // Find the corresponding full transaction to get the citation
                                         const fullTransaction = transactions.find(tx =>
                                             tx.date === detail.transactionDate &&
                                             tx.name === detail.transactionName &&
                                             tx.amount === detail.transactionAmount && // Add amount check for better matching
                                             tx.ethicalPractices?.includes(detail.practice) // Ensure this practice is in the list
                                         );
                                         const citationUrl = fullTransaction?.citations?.[detail.practice];

                                         return (
                                             <div key={`pos-detail-${index}`} className="border-b border-[var(--border-color)] pb-3 last:border-b-0 last:pb-0">
                                                 <div className="flex justify-between items-start text-sm mb-1">
                                                     <div>
                                                         <span className="font-medium text-[var(--card-foreground)]">{detail.transactionName}</span>
                                                         <span className="text-xs text-[var(--card-foreground)] opacity-70 ml-2">({detail.transactionDate})</span>
                                                         <p className="text-xs text-blue-600 dark:text-blue-400">{detail.practice}</p>
                                                     </div>
                                                     <span className="font-medium text-green-600 dark:text-green-400">{formatCurrency(detail.impactAmount)}</span>
                                                 </div>
                                                 {/* Practice Information & Citation */}
                                                 {detail.information && (
                                                     <p className="mt-1 pl-2 border-l-2 border-gray-300 dark:border-gray-600 text-xs text-[var(--card-foreground)] opacity-80 italic">
                                                         ℹ️ {detail.information}
                                                         {/* Display Citation Link */}
                                                         {citationUrl && (
                                                             <a
                                                                 href={citationUrl}
                                                                 target="_blank"
                                                                 rel="noopener noreferrer"
                                                                 className="ml-2 text-blue-500 hover:text-blue-700 underline text-[10px]"
                                                                 onClick={(e) => e.stopPropagation()} // Prevent card toggle
                                                             >
                                                                 [Source]
                                                             </a>
                                                         )}
                                                     </p>
                                                 )}
                                             </div>
                                         );
                                     })}
                                     {detailedPositiveImpacts[categoryName]?.length === 0 && <p className="text-xs text-center text-[var(--card-foreground)] opacity-70">No specific transactions found for this category.</p>}
                                 </div>
                             )}
                         </div>
                     ))}
                 </div>


                {/* Liabilities / Societal Debts Column */}
                <div className="space-y-4">
                     <h3 className="text-xl font-semibold text-center text-red-700 dark:text-red-400 border-b border-[var(--border-color)] pb-2">
                       Societal Debts <span className="text-lg">({formatCurrency(negativeImpactTotalFromStore)})</span>
                     </h3>
                     {negativeCategoryTotals.length === 0 && (
                       <div className="card p-6 text-center"> {/* Use .card */}
                         <p className="text-[var(--card-foreground)] opacity-70">No negative impact generated.</p>
                       </div>
                     )}
                    {negativeCategoryTotals.map(({ name: categoryName, amount: categoryTotalAmount }) => (
                        <div key={`neg-cat-${categoryName}`} className="card"> {/* Use .card */}
                             {/* Category Header */}
                             <div
                                role="button" // Accessibility
                                tabIndex={0} // Focusable
                                className="w-full bg-gray-50 dark:bg-gray-700/[.5] p-3 flex justify-between items-center text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors rounded-t-xl cursor-pointer"
                                onClick={() => toggleNegativeCategory(categoryName)}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleNegativeCategory(categoryName); }} // Keyboard accessibility
                            >
                                <div className="flex items-center">
                                     <span className="text-lg mr-3">{getCategoryIcon(categoryName)}</span>
                                     <span className="font-semibold text-gray-700 dark:text-gray-200">{categoryName}</span>
                                 </div>
                                 <div className="flex items-center">
                                     <span className="font-bold text-red-600 dark:text-red-400 mr-2">{formatCurrency(categoryTotalAmount)}</span>
                                     {/* Offset Button for Category */}
                                     {categoryTotalAmount > 0 && ( // Only show offset if there's debt
                                       <button
                                         onClick={(e) => {
                                              e.stopPropagation(); // Prevent the div's onClick
                                              handleOffsetCategory(categoryName, categoryTotalAmount);
                                          }}
                                         className="bg-green-500 hover:bg-green-600 text-white text-xs px-2 py-1 rounded-full mr-2 transition-colors whitespace-nowrap z-10"
                                         title={`Offset ${categoryName} impact`}
                                       >
                                          Offset
                                       </button>
                                     )}
                                     {/* Chevron Icon */}
                                     <svg className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform duration-200 ${expandedNegativeCategories[categoryName] ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                 </div>
                            </div>
                            {/* Expanded Detail List */}
                            {expandedNegativeCategories[categoryName] && (
                                <div className="p-4 border-t border-[var(--border-color)] space-y-3 max-h-96 overflow-y-auto">
                                     {(detailedNegativeImpacts[categoryName] || []).map((detail, index) => {
                                          // Find the corresponding full transaction to get the citation
                                          const fullTransaction = transactions.find(tx =>
                                             tx.date === detail.transactionDate &&
                                             tx.name === detail.transactionName &&
                                             tx.amount === detail.transactionAmount && // Add amount check
                                             tx.unethicalPractices?.includes(detail.practice) // Ensure practice match
                                          );
                                          const citationUrl = fullTransaction?.citations?.[detail.practice];

                                          return (
                                             <div key={`neg-detail-${index}`} className="border-b border-[var(--border-color)] pb-3 last:border-b-0 last:pb-0">
                                                 <div className="flex justify-between items-start text-sm mb-1">
                                                     <div>
                                                         <span className="font-medium text-[var(--card-foreground)]">{detail.transactionName}</span>
                                                         <span className="text-xs text-[var(--card-foreground)] opacity-70 ml-2">({detail.transactionDate})</span>
                                                         <p className="text-xs text-blue-600 dark:text-blue-400">{detail.practice}</p>
                                                     </div>
                                                     <span className="font-medium text-red-600 dark:text-red-400">{formatCurrency(detail.impactAmount)}</span>
                                                 </div>
                                                 {/* Practice Information & Citation */}
                                                 {detail.information && (
                                                     <p className="mt-1 pl-2 border-l-2 border-gray-300 dark:border-gray-600 text-xs text-[var(--card-foreground)] opacity-80 italic">
                                                         ℹ️ {detail.information}
                                                         {/* Display Citation Link */}
                                                         {citationUrl && (
                                                             <a
                                                                 href={citationUrl}
                                                                 target="_blank"
                                                                 rel="noopener noreferrer"
                                                                 className="ml-2 text-blue-500 hover:text-blue-700 underline text-[10px]"
                                                                 onClick={(e) => e.stopPropagation()} // Prevent card toggle
                                                             >
                                                                 [Source]
                                                             </a>
                                                         )}
                                                     </p>
                                                 )}
                                             </div>
                                          );
                                      })}
                                     {detailedNegativeImpacts[categoryName]?.length === 0 && <p className="text-xs text-center text-[var(--card-foreground)] opacity-70">No specific transactions found for this category.</p>}
                                </div>
                            )}
                        </div>
                    ))}
                     {/* Offset All button can be added here if needed */}
                </div>

            </div>

            {/* Donation Modal */}
            {modalState.isOpen && ( <DonationModal {...modalState} practice={modalState.practice || ''} amount={modalState.amount || 0} onClose={closeDonationModal} /> )}
        </div>
    );
}