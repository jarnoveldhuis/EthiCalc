// src/features/dashboard/views/BalanceSheetView.jsx
"use client";

import React, { useState, useMemo } from "react";
import { useTransactionStore } from "@/store/transactionStore";
import { Transaction } from "@/shared/types/transactions";
import { DonationModal } from "@/features/charity/DonationModal";
import { useDonationModal } from "@/hooks/useDonationModal";
import { LoadingSpinner } from "@/shared/ui/LoadingSpinner";

// --- Interface Definitions ---
interface BalanceSheetViewProps {
  transactions: Transaction[];
}

interface CategoryData {
  name: string;
  icon: string;
  totalPositiveImpact: number;
  totalNegativeImpact: number;
  positiveDetails: CombinedImpactDetail[];
  negativeDetails: CombinedImpactDetail[];
}

// Updated interface for citation URLs
interface CombinedImpactDetail {
  vendorName: string;
  practice: string;
  totalImpactAmount: number;
  totalOriginalAmount: number;
  impactWeight: number;
  information?: string;
  citationUrls?: string[]; // Changed from citationUrl
  isPositive: boolean;
  contributingTxCount: number;
}

interface UnifiedCategoryCardProps {
    category: CategoryData;
    isExpanded: boolean;
    onToggleExpand: (categoryName: string) => void;
    onOffset: (categoryName: string, amount: number) => void;
}

// --- Helper Functions ---
const formatCurrency = (value: number | undefined | null): string => {
  const num = value ?? 0;
  const absNum = Math.abs(num);
  return `$${absNum.toFixed(2)}`;
};

const categoryIcons: Record<string, string> = {
  Environment: "🌱",
  "Labor Ethics": "⚖️",
  "Animal Welfare": "🐮",
  "Political Ethics": "🗳️",
  "Digital Rights": "🛜",
  Transparency: "🔍",
  "Uncategorized Positive": "✨",
  "Uncategorized Negative": "💀",
  "Default Category": "❓",
};

const getNetImpactColor = (netImpact: number): string => {
    if (netImpact > 0.01) return 'text-green-600 dark:text-green-400';
    if (netImpact < -0.01) return 'text-red-600 dark:text-red-400';
    return 'text-gray-500 dark:text-gray-400';
};
// --- End Helper Functions ---

// --- Reusable Card Component (For Desktop View) ---
interface CategoryCardProps {
    category: CategoryData;
    isPositive: boolean;
    isExpanded: boolean;
    onToggleExpand: (categoryName: string) => void;
    onOffset?: (categoryName: string, amount: number) => void;
}

const CategoryCard: React.FC<CategoryCardProps> = ({ category, isPositive, isExpanded, onToggleExpand, onOffset }) => {
    const totalImpact = isPositive ? category.totalPositiveImpact : category.totalNegativeImpact;
    const details = isPositive ? category.positiveDetails : category.negativeDetails;
    const amountColor = isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
    const canExpand = details.length > 0;
    const showDetails = isExpanded && canExpand;
    const isClickable = category.positiveDetails.length > 0 || category.negativeDetails.length > 0;

    const handleToggle = () => { if (isClickable) { onToggleExpand(category.name); } };
    const handleKeyDown = (e: React.KeyboardEvent) => { if ((e.key === "Enter" || e.key === " ") && isClickable) { onToggleExpand(category.name); } };

    return (
        <div className="card flex flex-col h-full">
            {/* Category Header */}
            <div
                role={isClickable ? "button" : undefined} tabIndex={isClickable ? 0 : undefined}
                className={`w-full bg-gray-50 dark:bg-gray-700/[.5] p-3 flex justify-between items-center text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors rounded-t-xl ${ isClickable ? 'cursor-pointer' : 'cursor-default'}`}
                onClick={handleToggle} onKeyDown={handleKeyDown} aria-expanded={isExpanded}
            >
                <div className="flex items-center flex-grow min-w-0">
                   <span className="text-lg mr-2 sm:mr-3">{category.icon}</span>
                   <span className="font-semibold text-gray-700 dark:text-gray-200 text-sm sm:text-base truncate mr-3" title={category.name}>{category.name}</span>
                </div>
                <div className="flex items-center flex-shrink-0 gap-2">
                     <span className={`font-bold ${amountColor} text-sm sm:text-base w-20 text-right`}>{formatCurrency(totalImpact)}</span>
                    {!isPositive && totalImpact > 0 && onOffset && (<button onClick={(e) => { e.stopPropagation(); onOffset(category.name, totalImpact); }} className="bg-green-500 hover:bg-green-600 text-white text-xs px-2 py-1 rounded-full transition-colors whitespace-nowrap z-10" title={`Offset ${category.name} impact`}>Offset</button>)}
                    {isClickable && (<svg className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>)}
                </div>
            </div>

            {/* Expanded Detail List */}
            <div className={`flex-grow overflow-y-auto max-h-96 ${showDetails ? 'block' : 'hidden'}`}>
                <div className="p-4 border-t border-[var(--border-color)] space-y-3">
                    {details.length === 0 && showDetails && ( <p className="text-xs text-center text-[var(--card-foreground)] opacity-70">No details available for this side.</p> )}
                    {details.map((detail, index) => (
                         <div key={`${isPositive ? 'pos' : 'neg'}-detail-${category.name}-${index}-${detail.vendorName}-${detail.practice}`} className="border-b border-gray-200 dark:border-gray-700 pb-2 last:border-b-0 last:pb-0">
                             <div className="flex justify-between items-start mb-1">
                                <div className="flex-grow min-w-0 pr-2">
                                    <span className="block font-medium text-[var(--card-foreground)] text-sm truncate" title={detail.vendorName}>{detail.vendorName}</span>
                                    <span className="block text-xs text-blue-600 dark:text-blue-400 truncate" title={detail.practice}>{detail.practice} ({detail.impactWeight}%)</span>
                                    {detail.contributingTxCount > 1 && (<span className="block text-xxs text-[var(--muted-foreground)]">({detail.contributingTxCount} transactions)</span>)}
                                </div>
                                <div className="text-right flex-shrink-0">
                                    <span className={`block font-medium ${amountColor} text-sm`}>{formatCurrency(detail.totalImpactAmount)}</span>
                                    <span className="block text-xs text-[var(--muted-foreground)]">(Total Orig: {formatCurrency(detail.totalOriginalAmount)})</span>
                                </div>
                            </div>
                            {/* --- UPDATED CITATION RENDERING (CategoryCard - All Links) --- */}
                            {detail.information && (
                                <p className="mt-1 pl-2 border-l-2 border-gray-300 dark:border-gray-600 text-xs text-[var(--card-foreground)] opacity-80 italic">
                                    ℹ️ {detail.information}
                                    {/* Map over all citation URLs */}
                                    {detail.citationUrls && detail.citationUrls.length > 0 && (
                                        <span className="ml-2"> {/* Container for links */}
                                            {detail.citationUrls.map((url, urlIndex) => (
                                                <a
                                                    key={urlIndex}
                                                    href={url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-blue-500 hover:text-blue-700 underline text-[10px] mr-1.5" // Added margin-right
                                                    onClick={(e) => e.stopPropagation()}
                                                    title={url} // Show full URL on hover
                                                >
                                                    [Source {urlIndex + 1}]
                                                </a>
                                            ))}
                                        </span>
                                    )}
                                </p>
                            )}
                            {/* --- END UPDATED CITATION RENDERING --- */}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
// --- End Reusable Card Component (For Desktop) ---

// --- Unified Category Card Component (FOR MOBILE) ---
const UnifiedCategoryCard: React.FC<UnifiedCategoryCardProps> = ({ category, isExpanded, onToggleExpand, onOffset }) => {
    const { totalPositiveImpact, totalNegativeImpact } = category;
    const netImpact = totalPositiveImpact - totalNegativeImpact;
    const negativeImpactForOffset = totalNegativeImpact;

    const totalAbsoluteImpact = totalPositiveImpact + totalNegativeImpact;
    let positivePercent = 0; let negativePercent = 0;
    if (totalAbsoluteImpact > 0) { positivePercent = (totalPositiveImpact / totalAbsoluteImpact) * 100; negativePercent = (totalNegativeImpact / totalAbsoluteImpact) * 100; }
    else if (totalPositiveImpact > 0) positivePercent = 100;
    else if (totalNegativeImpact > 0) negativePercent = 100;

    const allDetails = [...category.negativeDetails, ...category.positiveDetails].sort((a, b) => { if (a.isPositive !== b.isPositive) return a.isPositive ? 1 : -1; return b.totalImpactAmount - a.totalImpactAmount; });
    const canExpand = allDetails.length > 0;

    const handleToggle = () => { if (canExpand) onToggleExpand(category.name); };
    const handleKeyDown = (e: React.KeyboardEvent) => { if ((e.key === "Enter" || e.key === " ") && canExpand) onToggleExpand(category.name); };

    return (
        <div className="card flex flex-col">
            <div
                role={canExpand ? "button" : undefined} tabIndex={canExpand ? 0 : undefined}
                className={`w-full bg-gray-50 dark:bg-gray-700/[.5] p-3 flex flex-col text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors rounded-t-xl ${canExpand ? 'cursor-pointer' : 'cursor-default'}`}
                onClick={handleToggle} onKeyDown={handleKeyDown} aria-expanded={isExpanded}
            >
                <div className="flex justify-between items-center w-full">
                    <div className="flex items-center flex-grow min-w-0">
                        <span className="text-lg mr-2 sm:mr-3">{category.icon}</span>
                        <span className="font-semibold text-gray-700 dark:text-gray-200 text-sm sm:text-base truncate mr-3" title={category.name}>{category.name}</span>
                    </div>
                    <div className="flex items-center flex-shrink-0 gap-2">
                        <span className={`font-bold ${getNetImpactColor(netImpact)} text-sm sm:text-base w-20 text-right`}>{netImpact >= 0 ? '+' : ''}{formatCurrency(netImpact)}</span>
                        {negativeImpactForOffset > 0 && (<button onClick={(e) => { e.stopPropagation(); onOffset(category.name, negativeImpactForOffset); }} className="bg-green-500 hover:bg-green-600 text-white text-xs px-2 py-1 rounded-full transition-colors whitespace-nowrap z-10" title={`Offset ${category.name} negative impact (${formatCurrency(negativeImpactForOffset)})`}>Offset</button>)}
                        {canExpand && (<svg className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>)}
                    </div>
                </div>
                {(totalPositiveImpact > 0 || totalNegativeImpact > 0) && (
                    <div className="w-full mt-2 px-1">
                         <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden flex">
                             {positivePercent > 0 && (<div className="bg-green-500 dark:bg-green-400 h-full" style={{ width: `${positivePercent}%` }} title={`Positive Impact: ${formatCurrency(totalPositiveImpact)}`} />)}
                             {negativePercent > 0 && (<div className="bg-red-500 dark:bg-red-400 h-full" style={{ width: `${negativePercent}%` }} title={`Negative Impact: ${formatCurrency(totalNegativeImpact)}`} />)}
                        </div>
                    </div>
                 )}
            </div>
            {isExpanded && canExpand && (
                <div className="flex-grow overflow-y-auto max-h-96">
                    <div className="p-3 space-y-2">
                        {allDetails.length === 0 && ( <p className="text-xs text-center text-[var(--card-foreground)] opacity-70">No details available.</p> )}
                        {allDetails.map((detail, index) => {
                            const detailAmountColor = detail.isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
                            const detailBackgroundClass = detail.isPositive ? 'bg-green-50/[.6] dark:bg-green-900/[.3]' : 'bg-red-50/[.6] dark:bg-red-900/[.3]';
                            return (
                                <div key={`unified-detail-${category.name}-${index}-${detail.vendorName}-${detail.practice}`} className={`${detailBackgroundClass} p-2 rounded border-b border-gray-200/[.5] dark:border-gray-700/[.5] last:border-b-0`}>
                                    <div className="flex justify-between items-start mb-1">
                                        <div className="flex-grow min-w-0 pr-2">
                                            <span className="block font-medium text-[var(--card-foreground)] text-sm truncate" title={detail.vendorName}>{detail.vendorName}</span>
                                            <span className="block text-xs text-blue-600 dark:text-blue-400 truncate" title={detail.practice}>{detail.practice} ({detail.impactWeight}%)</span>
                                            {detail.contributingTxCount > 1 && ( <span className="block text-xxs text-[var(--muted-foreground)]">({detail.contributingTxCount} transactions)</span> )}
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                            <span className={`block font-medium ${detailAmountColor} text-sm`}>{detail.isPositive ? '+' : '-'}{formatCurrency(detail.totalImpactAmount)}</span>
                                            <span className="block text-xs text-[var(--muted-foreground)]">(Orig: {formatCurrency(detail.totalOriginalAmount)})</span>
                                        </div>
                                    </div>
                                    {/* --- UPDATED CITATION RENDERING (UnifiedCategoryCard - All Links) --- */}
                                    {detail.information && (
                                        <p className="mt-1 text-xs text-[var(--card-foreground)] opacity-80 italic">
                                            ℹ️ {detail.information}
                                            {/* Map over all citation URLs */}
                                            {detail.citationUrls && detail.citationUrls.length > 0 && (
                                                <span className="ml-2"> {/* Container for links */}
                                                    {detail.citationUrls.map((url, urlIndex) => (
                                                        <a
                                                            key={urlIndex}
                                                            href={url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-blue-500 hover:text-blue-700 underline text-[10px] mr-1.5" // Added margin-right
                                                            onClick={(e) => e.stopPropagation()}
                                                            title={url} // Show full URL on hover
                                                        >
                                                            [Source {urlIndex + 1}]
                                                        </a>
                                                    ))}
                                                </span>
                                            )}
                                        </p>
                                    )}
                                    {/* --- END UPDATED CITATION RENDERING --- */}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};
// --- End Unified Category Card Component ---

// --- Main Balance Sheet Component ---
export function BalanceSheetView({ transactions }: BalanceSheetViewProps) {
  const { impactAnalysis } = useTransactionStore();
  const { modalState, openDonationModal, closeDonationModal } = useDonationModal();
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const processedData = useMemo(() => {
    const categoryMap: Record<string, { name: string; icon: string; totalPositiveImpact: number; totalNegativeImpact: number; tempPositiveDetails: Record<string, CombinedImpactDetail>; tempNegativeDetails: Record<string, CombinedImpactDetail>; }> = {};
    const allCategoryNames = new Set<string>(); const defaultPositiveCategory = "Uncategorized Positive"; const defaultNegativeCategory = "Uncategorized Negative";
    transactions?.forEach((tx)=>{
        const processImpacts=(isPositive: boolean)=>{
            const practices=isPositive?(tx.ethicalPractices||[]):(tx.unethicalPractices||[]);
            practices.forEach((practice)=>{
                const categoryName=tx.practiceCategories?.[practice]||(isPositive?defaultPositiveCategory:defaultNegativeCategory);
                const weight=tx.practiceWeights?.[practice]||0;
                const impactAmount=Math.abs(tx.amount*(weight/100));
                const vendorName=tx.name||"Unknown Vendor";
                if(isNaN(impactAmount)||impactAmount<=0.005) return;
                allCategoryNames.add(categoryName);
                if(!categoryMap[categoryName]){ categoryMap[categoryName]={ name: categoryName, icon: categoryIcons[categoryName]||categoryIcons["Default Category"], totalPositiveImpact: 0, totalNegativeImpact: 0, tempPositiveDetails:{}, tempNegativeDetails:{} }; }
                const comboKey=`${vendorName}|${practice}`;
                const detailStore=isPositive?categoryMap[categoryName].tempPositiveDetails:categoryMap[categoryName].tempNegativeDetails;
                if(detailStore[comboKey]){ detailStore[comboKey].totalImpactAmount+=impactAmount; detailStore[comboKey].totalOriginalAmount+=tx.amount; detailStore[comboKey].contributingTxCount+=1; }
                else{
                    // --- UPDATED DETAIL CREATION FOR CITATION URLS ---
                    detailStore[comboKey] = {
                        vendorName, practice, totalImpactAmount: impactAmount, totalOriginalAmount: tx.amount, impactWeight: weight,
                        information: tx.information?.[practice],
                        citationUrls: tx.citations?.[practice] ?? [], // Assign the array here
                        isPositive, contributingTxCount: 1
                    };
                    // --- END UPDATED DETAIL CREATION ---
                }
                if(isPositive){ categoryMap[categoryName].totalPositiveImpact+=impactAmount; }
                else{ categoryMap[categoryName].totalNegativeImpact+=impactAmount; }
            });
        };
        processImpacts(true); processImpacts(false);
    });
    const finalCategories: CategoryData[]=Array.from(allCategoryNames).map(categoryName=>{
        const categoryData=categoryMap[categoryName];
        if(categoryData){ const positiveDetails=Object.values(categoryData.tempPositiveDetails).sort((a, b)=>b.totalImpactAmount - a.totalImpactAmount); const negativeDetails=Object.values(categoryData.tempNegativeDetails).sort((a, b)=>b.totalImpactAmount - a.totalImpactAmount); return{ name: categoryName, icon: categoryData.icon, totalPositiveImpact: categoryData.totalPositiveImpact, totalNegativeImpact: categoryData.totalNegativeImpact, positiveDetails, negativeDetails }; }
        else{ return{ name: categoryName, icon: categoryIcons[categoryName]||categoryIcons["Default Category"], totalPositiveImpact: 0, totalNegativeImpact: 0, positiveDetails:[], negativeDetails:[] }; }
    }).sort((a, b)=>{ const netA = a.totalPositiveImpact - a.totalNegativeImpact; const netB = b.totalPositiveImpact - b.totalNegativeImpact; if(Math.abs(netA - netB) > 0.005){ return netA - netB; } return b.totalNegativeImpact - a.totalNegativeImpact; });
    const overallPositive=impactAnalysis?.positiveImpact??0;
    const overallNegative=impactAnalysis?.negativeImpact??0;
    return{ categories: finalCategories, overallPositive, overallNegative };
  }, [transactions, impactAnalysis]);

  const toggleCategory = (categoryName: string) => { setExpandedCategory((prev) => (prev === categoryName ? null : categoryName)); };
  const handleOffsetCategory = (categoryName: string, amount: number) => { if (amount > 0) openDonationModal(categoryName, amount); };

  if (!transactions || transactions.length === 0) {
    if (!impactAnalysis) { return ( <div className="flex items-center justify-center h-64"> <LoadingSpinner message="Loading balance sheet data..." /> </div> ); }
    else { return ( <div className="card p-6 text-center"> <p className="text-[var(--card-foreground)] opacity-70"> No transaction data with ethical impacts found to display the balance sheet. </p> </div> ); }
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Mobile/Single Column View (lg:hidden) */}
      <div className="lg:hidden space-y-4">
          {processedData.categories.length === 0 && ( <div className="card p-6 text-center"> <p className="text-[var(--card-foreground)] opacity-70"> No specific category impacts identified. </p> </div> )}
          {processedData.categories.map((category) => ( <UnifiedCategoryCard key={`unified-mobile-${category.name}`} category={category} isExpanded={expandedCategory === category.name} onToggleExpand={toggleCategory} onOffset={handleOffsetCategory} /> ))}
      </div>

      {/* Desktop/Double Column View (hidden lg:block) */}
      <div className="hidden lg:block space-y-4">
          <div className="grid grid-cols-2 gap-x-6 pb-2 border-b border-[var(--border-color)]">
             <h3 className="text-xl font-semibold text-center text-red-700 dark:text-red-400"> Negative Impact <span className="text-lg">({formatCurrency(processedData.overallNegative)})</span> </h3>
             <h3 className="text-xl font-semibold text-center text-green-700 dark:text-green-400"> Positive Impact <span className="text-lg">({formatCurrency(processedData.overallPositive)})</span> </h3>
          </div>
          {processedData.categories.length === 0 && ( <div className="card p-6 text-center col-span-2"> <p className="text-[var(--card-foreground)] opacity-70"> No specific category impacts identified. </p> </div> )}
          {processedData.categories.map((category) => (
              <div key={`cat-row-desktop-${category.name}`} className="grid grid-cols-2 gap-x-6 items-start">
                  <div> <CategoryCard category={category} isPositive={false} isExpanded={expandedCategory === category.name} onToggleExpand={toggleCategory} onOffset={handleOffsetCategory} /> </div>
                  <div> <CategoryCard category={category} isPositive={true} isExpanded={expandedCategory === category.name} onToggleExpand={toggleCategory} /> </div>
              </div>
          ))}
      </div>

      {/* Donation Modal */}
      {modalState.isOpen && ( <DonationModal isOpen={modalState.isOpen} practice={modalState.practice || ""} amount={modalState.amount || 0} onClose={closeDonationModal} /> )}
    </div>
  );
}