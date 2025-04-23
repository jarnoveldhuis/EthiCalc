// src/features/dashboard/views/BalanceSheetView.jsx
"use client";

import React, { useState, useMemo } from "react"; // Removed useEffect
import { useTransactionStore } from "@/store/transactionStore";
import { Transaction, Citation } from "@/shared/types/transactions"; // Import types
import { DonationModal } from "@/features/charity/DonationModal";
import { useDonationModal } from "@/hooks/useDonationModal";
import { LoadingSpinner } from "@/shared/ui/LoadingSpinner";
// Removed charity service imports - no longer fetching dynamically
import { CharityImage } from "@/features/charity/CharityImage";
// import { CharityRating } from "@/features/charity/CharityRating"; // Keep for potential future use
import { AnimatedCounter } from "@/shared/ui/AnimatedCounter"; // Import AnimatedCounter


// --- Interface Definitions ---
interface BalanceSheetViewProps {
  transactions: Transaction[];
}
interface CategoryData {
  name: string; icon: string; totalPositiveImpact: number; totalNegativeImpact: number;
  positiveDetails: CombinedImpactDetail[]; negativeDetails: CombinedImpactDetail[];
}
interface CombinedImpactDetail {
  vendorName: string; practice: string; totalImpactAmount: number; totalOriginalAmount: number;
  impactWeight: number; information?: string; citations?: Citation[]; // Uses Citation[] type
  isPositive: boolean; contributingTxCount: number;
}
interface DetailItemProps {
  detail: CombinedImpactDetail; amountColor: string;
}
// Part of BalanceSheetView.jsx - Updated Map
interface RecommendedCharity {
    name: string;
    logoUrl?: string;
    tagline?: string;
    donationLink?: string; // Added field for direct link
}

const hardcodedCharityRecommendations: Record<string, RecommendedCharity> = {
    "Environment": {
        name: "Natural Resources Defense Council (NRDC)",
        logoUrl: "/logos/nrdc-logo.png", // Placeholder
        tagline: "Earth's Best Defense",
        donationLink: "https://www.every.org/131864591" // Using EIN
    },
    "Labor Ethics": {
        name: "Fair Labor Association (FLA)",
        logoUrl: "/logos/fla-logo.png", // Placeholder
        tagline: "Protecting Workers' Rights Worldwide"
        // donationLink: Omitted - Difficult to find direct Every.org link
    },
    "Animal Welfare": {
        name: "Animal Welfare Institute (AWI)",
        logoUrl: "/logos/awi-logo.png", // Placeholder
        tagline: "Alleviating Suffering Inflicted by Humans",
        donationLink: "https://www.every.org/520784193" // Using EIN
    },
    "Political Ethics": {
        name: "Center for Responsive Politics (OpenSecrets)",
        logoUrl: "/logos/opensecrets-logo.png", // Placeholder
        tagline: "Tracking Money in U.S. Politics",
        donationLink: "https://www.every.org/521310189" // Using EIN
    },
    "Digital Rights": {
        name: "Electronic Frontier Foundation (EFF)",
        logoUrl: "/logos/eff-logo.png", // Placeholder
        tagline: "Defending Your Rights in the Digital World",
        donationLink: "https://www.every.org/943116261" // Using EIN
    },
    "Transparency": {
        name: "Project On Government Oversight (POGO)",
        logoUrl: "/logos/pogo-logo.png", // Placeholder
        tagline: "Independent Nonpartisan Watchdog",
        donationLink: "https://www.every.org/521245995" // Using EIN
    },
    "Community Support": {
        name: "Feeding America",
        logoUrl: "/logos/feedingamerica-logo.png", // Placeholder
        tagline: "Nation's Largest Domestic Hunger-Relief Organization",
        donationLink: "https://www.every.org/363268969" // Using EIN
    }
};


// --- Helper Functions ---
const formatCurrency = (value: number | undefined | null): string => {
  const num = value ?? 0;
  // Return precise value for tooltips, rely on AnimatedCounter for display rounding
  return `$${num.toFixed(2)}`;
};
const categoryIcons: Record<string, string> = {
  Environment: "🌱",
  "Labor Ethics": "⚖️",
  "Animal Welfare": "🐮",
  "Political Ethics": "🗳️",
  "Digital Rights": "🛜",
  Transparency: "🔍",
  "Community Support": "🤝",
  "Uncategorized Positive": "✨",
  "Uncategorized Negative": "💀",
  "Default Category": "❓",
};
const getNetImpactColor = (netImpact: number): string => {
    if (netImpact > 0.01) return 'text-[var(--success)] dark:text-emerald-400';
    if (netImpact < -0.01) return 'text-[var(--destructive)] dark:text-rose-400';
    return 'text-gray-500 dark:text-gray-400';
};
// --- End Helper Functions ---


// --- Detail Item Component (with Collapsed Citations) ---
const DetailItem: React.FC<DetailItemProps> = ({ detail, amountColor }) => {
    const [citationsVisible, setCitationsVisible] = useState(false);
    const citations = detail.citations; // Assign to variable for clarity
    const hasCitations = citations !== undefined && citations !== null && citations.length > 0;

    return (
        <div className="border-b border-slate-200 dark:border-slate-700 pb-2 last:border-b-0 last:pb-0">
            <div className="flex justify-between items-start mb-1">
                <div className="flex-grow min-w-0 pr-2">
                    <span className="block font-medium text-[var(--card-foreground)] text-sm truncate" title={detail.vendorName}>{detail.vendorName}</span>
                    <span className="block text-xs text-blue-600 dark:text-blue-400 truncate" title={detail.practice}>{detail.practice} ({detail.impactWeight}%)</span>
                    {detail.contributingTxCount > 1 && (<span className="block text-xxs text-[var(--muted-foreground)]">({detail.contributingTxCount} transactions)</span>)}
                </div>
                <div className="text-right flex-shrink-0">
                    <AnimatedCounter
                        value={detail.totalImpactAmount}
                        prefix={detail.isPositive ? "+$" : "-$"}
                        className={`block font-medium ${amountColor} text-sm`}
                        decimalPlaces={0} // Display rounded
                        title={`Precise: ${detail.isPositive ? '+' : '-'}${formatCurrency(detail.totalImpactAmount)}`} // Precise on hover
                    />
                    <span className="block text-xs text-[var(--muted-foreground)]">(Orig: {formatCurrency(detail.totalOriginalAmount)})</span>
                </div>
            </div>
            {detail.information && (
                <p className="mt-1 pl-2 border-l-2 border-gray-300 dark:border-gray-600 text-xs text-[var(--card-foreground)] opacity-80 italic">
                    ℹ️ {detail.information}
                    {hasCitations && !citationsVisible && (
                        <button onClick={(e) => { e.stopPropagation(); setCitationsVisible(true); }} className="ml-2 text-blue-500 hover:underline text-[10px] font-medium">[Show Sources]</button>
                    )}
                     {hasCitations && citationsVisible && (
                        <button onClick={(e) => { e.stopPropagation(); setCitationsVisible(false); }} className="ml-2 text-blue-500 hover:underline text-[10px] font-medium">[Hide Sources]</button>
                    )}
                </p>
            )}
            {/* List only rendered if hasCitations is true */}
            {hasCitations && citationsVisible && (
                <ul className="mt-1 ml-6 list-disc text-xs space-y-0.5">
                    {/* Use the 'citations' variable which is guaranteed non-null here */}
                    {citations.map((citation: Citation, urlIndex: number) => (
                        citation?.url && (
                            <li key={urlIndex}>
                                <a href={citation.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline" onClick={(e) => e.stopPropagation()} title={citation.url}>
                                    {citation.title || `Source ${urlIndex + 1}`}
                                </a>
                            </li>
                        )
                    ))}
                </ul>
            )}
        </div>
    );
};


// --- Reusable Card Component (For Desktop View) ---
interface CategoryCardProps {
    category: CategoryData;
    isPositive: boolean;
    isExpanded: boolean;
    onToggleExpand: (categoryName: string) => void;
    onOffset: (categoryName: string, amount: number) => void;
}

const CategoryCard: React.FC<CategoryCardProps> = ({ category, isPositive, isExpanded, onToggleExpand, onOffset }) => {
    const details = isPositive ? category.positiveDetails : category.negativeDetails;
    const amountColor = isPositive ? 'text-[var(--success)] dark:text-emerald-400' : 'text-[var(--destructive)] dark:text-rose-400';
    const totalImpact = isPositive ? category.totalPositiveImpact : category.totalNegativeImpact;
    const showDetails = isExpanded;
    const isEmpty = details.length === 0;
    const showOffsetPrompt = isPositive && isEmpty && category.totalNegativeImpact > 0;

    const recommendation: RecommendedCharity | undefined = hardcodedCharityRecommendations[category.name];

    const handleOffsetClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onOffset(category.name, category.totalNegativeImpact);
    };

    return (
        <div className="card flex flex-col h-full">
             <div
                role="button" tabIndex={0}
                className={`w-full bg-gray-50 dark:bg-gray-700/[.5] p-3 flex justify-between items-center text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors rounded-t-lg cursor-pointer`}
                onClick={() => onToggleExpand(category.name)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onToggleExpand(category.name); }} aria-expanded={isExpanded}
            >
                 <div className="flex items-center flex-grow min-w-0">
                    <span className="text-lg mr-2 sm:mr-3">{category.icon}</span>
                    <span className="font-semibold text-gray-700 dark:text-gray-200 text-sm sm:text-base truncate mr-3" title={category.name}>{category.name}</span>
                 </div>
                 <div className="flex items-center flex-shrink-0 gap-2">
                      <AnimatedCounter value={totalImpact} prefix="$" className={`font-bold ${amountColor} text-sm sm:text-base w-20 text-right`} decimalPlaces={0} title={`Precise: ${formatCurrency(totalImpact)}`} />
                     {!isPositive && totalImpact > 0 && (<button onClick={handleOffsetClick} className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs px-2 py-1 rounded-full transition-colors whitespace-nowrap z-10" title={`Offset ${category.name} impact`}>Offset</button>)}
                     <svg className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                 </div>
             </div>
            {/* Add scrollable-content class */}
            <div className={`flex-grow overflow-y-auto max-h-96 scrollable-content ${showDetails ? 'block' : 'hidden'}`}>
                <div className="p-4 border-t border-slate-200 dark:border-slate-700 space-y-3">
                    {!isEmpty && details.map((detail, index) => (
                         <DetailItem key={`${isPositive ? 'pos' : 'neg'}-detail-${category.name}-${index}-${detail.vendorName}-${detail.practice}`} detail={detail} amountColor={amountColor} />
                    ))}
                    {isEmpty && showDetails && !showOffsetPrompt && ( <p className="text-xs text-center text-[var(--card-foreground)] opacity-70">No {isPositive ? 'positive' : 'negative'} impact details available.</p> )}
                    {showOffsetPrompt && showDetails && (
                         <div className="text-center p-2 space-y-2">
                             <p className="text-xs text-[var(--muted-foreground)] italic">Offset your negative impact in this category:</p>
                             {recommendation ? (
                                 <div className="border rounded-md p-3 text-left bg-white dark:bg-gray-700/[.5] space-y-1 border-slate-200 dark:border-slate-600">
                                      <div className="flex items-start space-x-2">
                                        {recommendation.logoUrl && <CharityImage src={recommendation.logoUrl} alt={recommendation.name} width={32} height={32} />}
                                         <div className="flex-grow">
                                             <p className="text-sm font-medium text-[var(--card-foreground)]">{recommendation.name}</p>
                                             {recommendation.tagline && <p className="text-xs text-[var(--muted-foreground)]">{recommendation.tagline}</p>}
                                         </div>
                                     </div>
                                     <button onClick={handleOffsetClick} className="w-full mt-2 text-sm bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-md">
                                         Offset {category.name} Impact (${Math.round(category.totalNegativeImpact)})
                                     </button>
                                 </div>
                             ) : (
                                <button onClick={handleOffsetClick} className="w-full mt-1 text-sm bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-md">
                                    Offset {category.name} Impact (${Math.round(category.totalNegativeImpact)})
                                </button>
                             )}
                         </div>
                    )}
                </div>
            </div>
        </div>
    );
};


// --- Unified Category Card Component (FOR MOBILE) ---
interface UnifiedCategoryCardProps {
    category: CategoryData;
    isExpanded: boolean;
    onToggleExpand: (categoryName: string) => void;
    onOffset: (categoryName: string, amount: number) => void;
}

const UnifiedCategoryCard: React.FC<UnifiedCategoryCardProps> = ({ category, isExpanded, onToggleExpand, onOffset }) => {
    const { totalPositiveImpact, totalNegativeImpact } = category;
    const netImpact = totalPositiveImpact - totalNegativeImpact;
    const negativeImpactForOffset = totalNegativeImpact;
    // Sort details by positive/negative first, then amount for unified view
    const allDetails = [...category.negativeDetails, ...category.positiveDetails].sort((a, b) => {
        if (a.isPositive !== b.isPositive) return a.isPositive ? 1 : -1; // Group negative first
        return b.totalImpactAmount - a.totalImpactAmount; // Then sort by amount desc
    });
    // const showDetails = isExpanded && allDetails.length > 0;

    const recommendation: RecommendedCharity | undefined = hardcodedCharityRecommendations[category.name];
    const showMobileOffsetPrompt = isExpanded && totalNegativeImpact > 0; // Show prompt if expanded and negative exists

    const totalAbsoluteImpact = totalPositiveImpact + totalNegativeImpact;
    let positivePercent = 0; let negativePercent = 0;
    if (totalAbsoluteImpact > 0) { positivePercent = (totalPositiveImpact / totalAbsoluteImpact) * 100; negativePercent = (totalNegativeImpact / totalAbsoluteImpact) * 100; }
    else if (totalPositiveImpact > 0) positivePercent = 100;
    else if (totalNegativeImpact > 0) negativePercent = 100;

    const handleOffsetClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onOffset(category.name, negativeImpactForOffset);
    };

    return (
        <div className="card flex flex-col">
           <div
               role="button" tabIndex={0}
               className={`w-full bg-gray-50 dark:bg-gray-700/[.5] p-3 flex flex-col text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors rounded-t-lg cursor-pointer`}
               onClick={() => onToggleExpand(category.name)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onToggleExpand(category.name); }} aria-expanded={isExpanded}
           >
                 <div className="flex justify-between items-center w-full">
                     <div className="flex items-center flex-grow min-w-0">
                         <span className="text-lg mr-2 sm:mr-3">{category.icon}</span>
                         <span className="font-semibold text-gray-700 dark:text-gray-200 text-sm sm:text-base truncate mr-3" title={category.name}>{category.name}</span>
                     </div>
                     <div className="flex items-center flex-shrink-0 gap-2">
                         <AnimatedCounter value={netImpact} prefix={netImpact >= 0 ? "+$" : "-$"} className={`font-bold ${getNetImpactColor(netImpact)} text-sm sm:text-base w-20 text-right`} decimalPlaces={0} title={`Precise: ${netImpact >= 0 ? '+' : ''}${formatCurrency(netImpact)}`} />
                         {negativeImpactForOffset > 0 && (<button onClick={handleOffsetClick} className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs px-2 py-1 rounded-full transition-colors whitespace-nowrap z-10" title={`Offset ${category.name} negative impact (${formatCurrency(negativeImpactForOffset)})`}>Offset</button>)}
                         <svg className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                     </div>
                 </div>
                 {(totalPositiveImpact > 0 || totalNegativeImpact > 0) && (
                     <div className="w-full mt-2 px-1">
                          <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden flex">
                              <div className="bg-[var(--success)] dark:bg-emerald-400 h-full" style={{ width: `${positivePercent}%` }} title={`Positive Impact: ${formatCurrency(totalPositiveImpact)}`} />
                              <div className="bg-[var(--destructive)] dark:bg-rose-400 h-full" style={{ width: `${negativePercent}%` }} title={`Negative Impact: ${formatCurrency(totalNegativeImpact)}`} />
                         </div>
                     </div>
                  )}
            </div>

            {/* Add scrollable-content class */}
            <div className={`flex-grow overflow-y-auto max-h-96 scrollable-content ${isExpanded ? 'block' : 'hidden'}`}>
                <div className="p-3 space-y-2 border-t border-slate-200 dark:border-slate-700">
                    {allDetails.length === 0 && isExpanded && ( <p className="text-xs text-center text-[var(--card-foreground)] opacity-70 py-4">No specific impact details available.</p> )}

                    {allDetails.map((detail, index) => {
                        const detailAmountColor = detail.isPositive ? 'text-[var(--success)] dark:text-emerald-400' : 'text-[var(--destructive)] dark:text-rose-400';
                        const detailBackgroundClass = detail.isPositive ? 'bg-emerald-50/[.6] dark:bg-emerald-900/[.3]' : 'bg-rose-50/[.6] dark:bg-rose-900/[.3]';
                        return (
                            <div key={`unified-detail-${category.name}-${index}-${detail.vendorName}-${detail.practice}`} className={`${detailBackgroundClass} p-2 rounded border-b border-gray-200/[.5] dark:border-gray-700/[.5] last:border-b-0`}>
                                <DetailItem detail={detail} amountColor={detailAmountColor} />
                            </div>
                        );
                    })}
                     {/* Mobile Offset Prompt (Uses hardcoded info) */}
                     {showMobileOffsetPrompt && (
                         <div className="text-center pt-2 border-t border-slate-200 dark:border-slate-700 mt-2">
                              <p className="text-xs text-[var(--muted-foreground)] mb-1 italic">Offset negative impact via:</p>
                              {recommendation && <p className="text-sm font-medium text-[var(--card-foreground)] mb-1.5">{recommendation.name}</p>}
                              <button onClick={handleOffsetClick} className="w-full text-sm bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-md">
                                  Offset {category.name} Impact (${Math.round(negativeImpactForOffset)})
                              </button>
                         </div>
                    )}
                </div>
            </div>
        </div>
    );
};


// --- Main Balance Sheet Component ---
export function BalanceSheetView({ transactions }: BalanceSheetViewProps) {
  const { impactAnalysis } = useTransactionStore();
  const { modalState, openDonationModal, closeDonationModal } = useDonationModal();
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  // processedData Memo using Citation[]
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
                    detailStore[comboKey] = {
                        vendorName, practice, totalImpactAmount: impactAmount, totalOriginalAmount: tx.amount, impactWeight: weight,
                        information: tx.information?.[practice],
                        citations: tx.citations?.[practice] ?? [], // Ensure Citation[]
                        isPositive, contributingTxCount: 1
                    };
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

  // --- Render Logic ---
   if (!impactAnalysis && (!transactions || transactions.length === 0)) {
     return (
       <div className="flex items-center justify-center h-64">
         <LoadingSpinner message="Loading balance sheet data..." />
       </div>
     );
   }
   if (!transactions || transactions.length === 0) {
     return (
       <div className="card p-6 text-center">
         <p className="text-[var(--card-foreground)] opacity-70">
           No transaction data with ethical impacts found to display the balance sheet.
         </p>
       </div>
     );
   }

  return (
    <div className="p-4 md:p-6 space-y-6">
        {/* Mobile View (lg:hidden) */}
        <div className="lg:hidden space-y-4">
            {processedData.categories.length === 0 && ( <div className="card p-6 text-center"> <p className="text-[var(--card-foreground)] opacity-70"> No specific category impacts identified. </p> </div> )}
            {processedData.categories.map((category) => (
                <UnifiedCategoryCard
                    key={`unified-mobile-${category.name}`}
                    category={category}
                    isExpanded={expandedCategory === category.name}
                    onToggleExpand={toggleCategory}
                    onOffset={handleOffsetCategory} />
             ))}
        </div>

        {/* Desktop View (hidden lg:block) */}
        <div className="hidden lg:block space-y-4">
             {/* Header using AnimatedCounter */}
            <div className="grid grid-cols-2 gap-x-6 pb-2 border-b border-slate-200 dark:border-slate-700">
               <h3 className="text-xl font-semibold text-center text-[var(--destructive)] dark:text-rose-400">
                    Negative Impact <span className="text-lg">(<AnimatedCounter value={processedData.overallNegative} prefix="$" decimalPlaces={0} title={`Precise: ${formatCurrency(processedData.overallNegative)}`} />)</span>
               </h3>
               <h3 className="text-xl font-semibold text-center text-[var(--success)] dark:text-emerald-400">
                    Positive Impact <span className="text-lg">(<AnimatedCounter value={processedData.overallPositive} prefix="$" decimalPlaces={0} title={`Precise: ${formatCurrency(processedData.overallPositive)}`} />)</span>
               </h3>
            </div>
            {processedData.categories.length === 0 && ( <div className="card p-6 text-center col-span-2"> <p className="text-[var(--card-foreground)] opacity-70"> No specific category impacts identified. </p> </div> )}
            {processedData.categories.map((category) => (
                <div key={`cat-row-desktop-${category.name}`} className="grid grid-cols-2 gap-x-6 items-start">
                    <div> <CategoryCard category={category} isPositive={false} isExpanded={expandedCategory === category.name} onToggleExpand={toggleCategory} onOffset={handleOffsetCategory} /> </div>
                    <div> <CategoryCard category={category} isPositive={true} isExpanded={expandedCategory === category.name} onToggleExpand={toggleCategory} onOffset={handleOffsetCategory} /> </div>
                </div>
            ))}
        </div>


        {/* Donation Modal */}
        {modalState.isOpen && ( <DonationModal isOpen={modalState.isOpen} practice={modalState.practice || ""} amount={modalState.amount || 0} onClose={closeDonationModal} /> )}
    </div>
  );
}