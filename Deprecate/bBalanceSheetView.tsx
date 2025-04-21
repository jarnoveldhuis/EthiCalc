// // src/features/dashboard/views/BalanceSheetView.jsx
// "use client";

// import React, { useState, useMemo } from "react";
// import { useTransactionStore } from "@/store/transactionStore";
// import { Transaction } from "@/shared/types/transactions";
// import { DonationModal } from "@/features/charity/DonationModal";
// import { useDonationModal } from "@/hooks/useDonationModal";
// import { LoadingSpinner } from "@/shared/ui/LoadingSpinner";

// // --- Interface Definitions ---
// interface BalanceSheetViewProps {
//   transactions: Transaction[];
// }

// interface CombinedImpactDetail {
//   vendorName: string;
//   practice: string;
//   totalImpactAmount: number;
//   totalOriginalAmount: number;
//   impactWeight: number;
//   information?: string;
//   citationUrl?: string;
//   isPositive: boolean;
//   contributingTxCount: number;
// }

// interface CategoryData {
//   name: string;
//   icon: string;
//   totalPositiveImpact: number;
//   totalNegativeImpact: number;
//   positiveDetails: CombinedImpactDetail[];
//   negativeDetails: CombinedImpactDetail[];
// }

// interface ExpansionState {
//     positive: boolean;
//     negative: boolean;
// }

// // --- Helper Functions ---
// const formatCurrency = (value: number | undefined | null): string => {
//   return `$${(value ?? 0).toFixed(2)}`;
// };

// const categoryIcons: Record<string, string> = {
//   Environment: "🌱",
//   "Labor Ethics": "⚖️",
//   "Animal Welfare": "🐮",
//   "Political Ethics": "🗳️",
//   "Digital Rights": "🛜",
//   Transparency: "🔍",
//   "Uncategorized Positive": "✨",
//   "Uncategorized Negative": "💀",
//   "Default Category": "❓",
// };
// // --- End Helper Functions ---

// // --- Reusable Card Component ---
// interface CategoryCardProps {
//     category: CategoryData;
//     isPositive: boolean;
//     // isExpanded now reflects the shared state for the category row in desktop
//     isExpanded: boolean;
//     onToggleExpand: (categoryName: string, isPositiveSide: boolean) => void;
//     onOffset?: (categoryName: string, amount: number) => void;
// }

// const CategoryCard: React.FC<CategoryCardProps> = ({ category, isPositive, isExpanded, onToggleExpand, onOffset }) => {
//     const totalImpact = isPositive ? category.totalPositiveImpact : category.totalNegativeImpact;
//     const details = isPositive ? category.positiveDetails : category.negativeDetails;
//     const amountColor = isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
//     // Allow expanding if *either* side has details, as clicking one expands both on desktop
//     const canExpand = category.positiveDetails.length > 0 || category.negativeDetails.length > 0;
//     // Only show details for *this* card if they exist AND the row is expanded
//     const showDetails = isExpanded && details.length > 0;

//     const handleToggle = () => {
//         // Toggle is allowed if either side can expand
//         if (category.positiveDetails.length > 0 || category.negativeDetails.length > 0) {
//             onToggleExpand(category.name, isPositive); // Still pass which side initiated
//         }
//     };

//     const handleKeyDown = (e: React.KeyboardEvent) => {
//         if ((e.key === "Enter" || e.key === " ") && (category.positiveDetails.length > 0 || category.negativeDetails.length > 0)) {
//             onToggleExpand(category.name, isPositive); // Still pass which side initiated
//         }
//     };

//     return (
//         <div className="card flex flex-col"> {/* Added flex flex-col */}
//             {/* Category Header */}
//             <div
//                 role={canExpand ? "button" : undefined}
//                 tabIndex={canExpand ? 0 : undefined}
//                 className={`w-full bg-gray-50 dark:bg-gray-700/[.5] p-3 flex justify-between items-center text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors rounded-t-xl ${canExpand ? 'cursor-pointer' : 'cursor-default'}`}
//                 onClick={handleToggle}
//                 onKeyDown={handleKeyDown}
//                 aria-expanded={isExpanded}
//             >
//                 {/* Left: Icon & Name */}
//                 <div className="flex items-center flex-grow min-w-0">
//                     <span className="text-lg mr-2 sm:mr-3">{category.icon}</span>
//                     <span className="font-semibold text-gray-700 dark:text-gray-200 text-sm sm:text-base truncate mr-3" title={category.name}>
//                         {category.name}
//                     </span>
//                 </div>
//                 {/* Right: Amount, Offset Button (Negative Only), Chevron */}
//                 <div className="flex items-center flex-shrink-0 gap-2">
//                      <span className={`font-bold ${amountColor} text-sm sm:text-base w-20 text-right`}>
//                         {formatCurrency(totalImpact)}
//                     </span>
//                     {!isPositive && totalImpact > 0 && onOffset && (
//                          <button
//                              onClick={(e) => { e.stopPropagation(); onOffset(category.name, totalImpact); }}
//                              className="bg-green-500 hover:bg-green-600 text-white text-xs px-2 py-1 rounded-full transition-colors whitespace-nowrap z-10"
//                              title={`Offset ${category.name} impact`}
//                          >
//                              Offset
//                          </button>
//                     )}
//                     {canExpand && (
//                         <svg className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform duration-2000 ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
//                     )}
//                 </div>
//             </div>

//             {/* --- Expanded Detail List --- */}
//             {/* Render conditionally based on showDetails */}
//             <div className={`flex-grow overflow-y-auto max-h-96 ${showDetails ? 'block' : 'hidden'}`}>
//                 <div className="p-4 border-t border-[var(--border-color)] space-y-3">
//                     {details.length === 0 && showDetails && /* Should not happen if showDetails depends on length, but safe */ (
//                          <p className="text-xs text-center text-[var(--card-foreground)] opacity-70">No details available.</p>
//                     )}
//                     {details.map((detail, index) => (
//                         <div key={`${isPositive ? 'pos' : 'neg'}-detail-${category.name}-${index}`} className="border-b border-gray-200 dark:border-gray-700 pb-2 last:border-b-0 last:pb-0">
//                             <div className="flex justify-between items-start mb-1">
//                                 {/* Vendor & Practice */}
//                                 <div className="flex-grow min-w-0 pr-2">
//                                     <span className="block font-medium text-[var(--card-foreground)] text-sm truncate" title={detail.vendorName}>{detail.vendorName}</span>
//                                     <span className="block text-xs text-blue-600 dark:text-blue-400 truncate" title={detail.practice}>{detail.practice} ({detail.impactWeight}%)</span>
//                                     {detail.contributingTxCount > 1 && (
//                                         <span className="block text-xxs text-[var(--muted-foreground)]">({detail.contributingTxCount} transactions)</span>
//                                     )}
//                                 </div>
//                                 {/* Amounts */}
//                                 <div className="text-right flex-shrink-0">
//                                     <span className={`block font-medium ${amountColor} text-sm`}>
//                                         {formatCurrency(detail.totalImpactAmount)}
//                                     </span>
//                                     <span className="block text-xs text-[var(--muted-foreground)]">
//                                         (Total Orig: {formatCurrency(detail.totalOriginalAmount)})
//                                     </span>
//                                 </div>
//                             </div>
//                             {/* Info & Citation */}
//                             {detail.information && (
//                                 <p className="mt-1 pl-2 border-l-2 border-gray-300 dark:border-gray-600 text-xs text-[var(--card-foreground)] opacity-80 italic">
//                                     ℹ️ {detail.information}
//                                     {detail.citationUrl && (
//                                         <a href={detail.citationUrl} target="_blank" rel="noopener noreferrer" className="ml-2 text-blue-500 hover:text-blue-700 underline text-[10px]" onClick={(e) => e.stopPropagation()}>[Source]</a>
//                                     )}
//                                 </p>
//                             )}
//                         </div>
//                     ))}
//                 </div>
//             </div>
//         </div>
//     );
// };
// // --- End Reusable Card Component ---


// export function BalanceSheetView({ transactions }: BalanceSheetViewProps) {
//   const { impactAnalysis } = useTransactionStore();
//   const { modalState, openDonationModal, closeDonationModal } = useDonationModal();

//   // State for expanding categories (tracks both sides)
//   const [expandedCategories, setExpandedCategories] = useState<Record<string, ExpansionState>>({});

//   // --- Process Transactions (Keep previous logic) ---
//   const processedData = useMemo(() => {
//     // ... (keep the existing data processing logic) ...
//     const categoryMap: Record<string, { name: string; icon: string; totalPositiveImpact: number; totalNegativeImpact: number; tempPositiveDetails: Record<string, CombinedImpactDetail>; tempNegativeDetails: Record<string, CombinedImpactDetail>; }> = {};
//     const allCategoryNames = new Set<string>(); const defaultPositiveCategory = "Uncategorized Positive"; const defaultNegativeCategory = "Uncategorized Negative"; transactions?.forEach((tx)=>{ const processImpacts=(isPositive: boolean)=>{ const practices=isPositive?(tx.ethicalPractices||[]):(tx.unethicalPractices||[]); practices.forEach((practice)=>{ const categoryName=tx.practiceCategories?.[practice]||(isPositive?defaultPositiveCategory:defaultNegativeCategory); const weight=tx.practiceWeights?.[practice]||0; const impactAmount=Math.abs(tx.amount*(weight/100)); const vendorName=tx.name||"Unknown Vendor"; if(isNaN(impactAmount)||impactAmount<=0) return; allCategoryNames.add(categoryName); if(!categoryMap[categoryName]){ categoryMap[categoryName]={ name: categoryName, icon: categoryIcons[categoryName]||categoryIcons["Default Category"], totalPositiveImpact: 0, totalNegativeImpact: 0, tempPositiveDetails:{}, tempNegativeDetails:{} }; } const comboKey=`${vendorName}|${practice}`; const detailStore=isPositive?categoryMap[categoryName].tempPositiveDetails:categoryMap[categoryName].tempNegativeDetails; if(detailStore[comboKey]){ detailStore[comboKey].totalImpactAmount+=impactAmount; detailStore[comboKey].totalOriginalAmount+=tx.amount; detailStore[comboKey].contributingTxCount+=1; } else{ detailStore[comboKey]={ vendorName, practice, totalImpactAmount: impactAmount, totalOriginalAmount: tx.amount, impactWeight: weight, information: tx.information?.[practice], citationUrl: tx.citations?.[practice], isPositive, contributingTxCount: 1 }; } if(isPositive){ categoryMap[categoryName].totalPositiveImpact+=impactAmount; } else{ categoryMap[categoryName].totalNegativeImpact+=impactAmount; } }); }; processImpacts(true); processImpacts(false); }); const finalCategories: CategoryData[]=Array.from(allCategoryNames).map(categoryName=>{ const categoryData=categoryMap[categoryName]; if(categoryData){ const positiveDetails=Object.values(categoryData.tempPositiveDetails).sort((a, b)=>b.totalImpactAmount - a.totalImpactAmount); const negativeDetails=Object.values(categoryData.tempNegativeDetails).sort((a, b)=>b.totalImpactAmount - a.totalImpactAmount); return{ name: categoryName, icon: categoryData.icon, totalPositiveImpact: categoryData.totalPositiveImpact, totalNegativeImpact: categoryData.totalNegativeImpact, positiveDetails, negativeDetails }; } else{ return{ name: categoryName, icon: categoryIcons[categoryName]||categoryIcons["Default Category"], totalPositiveImpact: 0, totalNegativeImpact: 0, positiveDetails:[], negativeDetails:[] }; } }).sort((a, b)=>{ if(b.totalNegativeImpact!==a.totalNegativeImpact){ return b.totalNegativeImpact - a.totalNegativeImpact; } return b.totalPositiveImpact - a.totalPositiveImpact; }); const overallPositive=impactAnalysis?.positiveImpact??0; const overallNegative=impactAnalysis?.negativeImpact??0; return{ categories: finalCategories, overallPositive, overallNegative };
//   }, [transactions, impactAnalysis]);

//   // --- UPDATED: Toggle function to sync both sides ---
//   const toggleCategory = (categoryName: string) => {
//     // We ignore _isPositiveSide now and just toggle the whole category row
//     setExpandedCategories((prev) => {
//         const currentState = prev[categoryName] || { positive: false, negative: false };
//         // Determine the new state (if either side is currently false, make both true; otherwise make both false)
//         const newState = !currentState.positive || !currentState.negative;
//         return {
//             ...prev,
//             [categoryName]: {
//                 positive: newState,
//                 negative: newState,
//             },
//         };
//     });
//   };

//   // --- Action Handlers (Unchanged) ---
//   const handleOffsetCategory = (categoryName: string, amount: number) => {
//     if (amount > 0) openDonationModal(categoryName, amount);
//   };

//   // --- Loading / No Data State (Unchanged) ---
//   if (!transactions || transactions.length === 0) {
//     if (!impactAnalysis) { return <div className="flex items-center justify-center h-64"><LoadingSpinner message="Loading balance sheet data..." /></div>; }
//     else { return <div className="card p-6 text-center"><p className="text-[var(--card-foreground)] opacity-70">No transaction data with ethical impacts found to display the balance sheet.</p></div>; }
//   }

//   // --- Main Render ---
//   return (
//     <div className="p-4 md:p-6 space-y-6">
//       {/* --- Mobile/Single Column View (lg:hidden) --- */}
//       <div className="lg:hidden space-y-6">
//           {processedData.overallNegative > 0 && ( <h3 className="text-xl font-semibold text-center text-red-700 dark:text-red-400 border-b border-[var(--border-color)] pb-2"> Negative Impact <span className="text-lg">({formatCurrency(processedData.overallNegative)})</span> </h3> )}
//           <div className="space-y-4">
//              {processedData.categories
//                 .filter(category => category.totalNegativeImpact > 0)
//                 .map(category => (
//                     <CategoryCard
//                         key={`neg-mobile-${category.name}`}
//                         category={category}
//                         isPositive={false}
//                         // Use the negative state for mobile view expansion
//                         isExpanded={!!expandedCategories[category.name]?.negative}
//                         onToggleExpand={toggleCategory}
//                         onOffset={handleOffsetCategory}
//                     />
//              ))}
//           </div>
//           {processedData.overallPositive > 0 && ( <h3 className="mt-8 text-xl font-semibold text-center text-green-700 dark:text-green-400 border-b border-[var(--border-color)] pb-2"> Positive Impact <span className="text-lg">({formatCurrency(processedData.overallPositive)})</span> </h3> )}
//            <div className="space-y-4">
//              {processedData.categories
//                  .filter(category => category.totalPositiveImpact > 0)
//                  .map(category => (
//                      <CategoryCard
//                          key={`pos-mobile-${category.name}`}
//                          category={category}
//                          isPositive={true}
//                          // Use the positive state for mobile view expansion
//                          isExpanded={!!expandedCategories[category.name]?.positive}
//                          onToggleExpand={toggleCategory}
//                      />
//               ))}
//            </div>
//       </div>

//       {/* --- Desktop/Double Column View (hidden lg:block) --- */}
//       <div className="hidden lg:block space-y-4">
//           <div className="grid grid-cols-2 gap-x-6 pb-2 border-b border-[var(--border-color)]">
//              <h3 className="text-xl font-semibold text-center text-red-700 dark:text-red-400"> Negative Impact <span className="text-lg">({formatCurrency(processedData.overallNegative)})</span> </h3>
//              <h3 className="text-xl font-semibold text-center text-green-700 dark:text-green-400"> Positive Impact <span className="text-lg">({formatCurrency(processedData.overallPositive)})</span> </h3>
//           </div>
//           {processedData.categories.length === 0 && ( <div className="card p-6 text-center col-span-2"><p className="text-[var(--card-foreground)] opacity-70"> No specific category impacts identified. </p> </div> )}
//           {processedData.categories.map((category) => (
//               <div key={`cat-row-desktop-${category.name}`} className="grid grid-cols-2 gap-x-6">
//                   {/* Negative Column (Desktop) */}
//                   <CategoryCard
//                        category={category}
//                        isPositive={false}
//                        // Both sides use the SAME state value on desktop now
//                        isExpanded={!!expandedCategories[category.name]?.negative} // Could use .positive or .negative here
//                        onToggleExpand={toggleCategory}
//                        onOffset={handleOffsetCategory}
//                   />
//                   {/* Positive Column (Desktop) */}
//                    <CategoryCard
//                        category={category}
//                        isPositive={true}
//                        // Both sides use the SAME state value on desktop now
//                        isExpanded={!!expandedCategories[category.name]?.positive} // Could use .positive or .negative here
//                        onToggleExpand={toggleCategory}
//                    />
//               </div>
//           ))}
//       </div>

//       {/* Donation Modal */}
//       {modalState.isOpen && ( <DonationModal isOpen={modalState.isOpen} practice={modalState.practice || ""} amount={modalState.amount || 0} onClose={closeDonationModal} /> )}
//     </div>
//   );
// }