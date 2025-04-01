// "use client";

// import React, { useState, useMemo, useCallback } from "react";
// import { Transaction } from "@/shared/types/transactions";
// import { DonationModal } from "@/features/charity/DonationModal";
// import { ImpactAnalysis } from "@/core/calculations/type";
// import { getColorClass } from "@/core/calculations/impactService";
// import { useDonationModal } from "@/hooks/useDonationModal";

// interface PremiumTransactionViewProps {
//   transactions: Transaction[];
//   impactAnalysis: ImpactAnalysis | null;
// }

// // Define enhanced transaction type with additional properties
// interface EnhancedTransaction extends Transaction {
//   debtPractices: Array<{
//     name: string;
//     amount: number;
//     isEthical: boolean;
//     info: string;
//   }>;
//   creditPractices: Array<{
//     name: string;
//     amount: number;
//     isEthical: boolean;
//     info: string;
//   }>;
//   totaldebt: number;
//   totalCredit: number;
//   netImpact: number;
//   id: string;
// }

// type SortKey = 'date' | 'name' | 'amount' | 'debt' | 'credit' | 'net';

// interface SortConfig {
//   key: SortKey;
//   direction: 'asc' | 'desc';
// }

// export function PremiumTransactionView({
//   transactions,
//   impactAnalysis
// }: PremiumTransactionViewProps) {
//   // State for expanded items, sorting, and donation modal
//   const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
//   const [sortConfig, setSortConfig] = useState<SortConfig>({
//     key: 'date',
//     direction: 'desc'
//   });
//   const { modalState, openDonationModal, closeDonationModal } = useDonationModal({ transactions });

//   // Helper to get value for sorting
//   const getValue = useCallback((tx: EnhancedTransaction, key: SortKey): string | number => {
//     switch (key) {
//       case 'date': return tx.date;
//       case 'name': return tx.name;
//       case 'amount': return tx.amount;
//       case 'debt': return tx.totaldebt;
//       case 'credit': return tx.totalCredit;
//       case 'net': return tx.netImpact;
//       default: return '';
//     }
//   }, []);

//   // Process and sort transactions
//   const processedTransactions = useMemo(() => {
//     // Deep copy and add calculated fields to transactions
//     const processed = transactions.map(tx => {
//       // Calculate debts (unethical practices)
//       const debtPractices = (tx.unethicalPractices || []).map(practice => {
//         const weight = tx.practiceWeights?.[practice] || 0;
//         const amount = tx.amount * (weight / 100);
//         return {
//           name: practice,
//           amount,
//           isEthical: false,
//           info: tx.information?.[practice] || ""
//         };
//       });
      
//       // Calculate credits (ethical practices)
//       const creditPractices = (tx.ethicalPractices || []).map(practice => {
//         const weight = tx.practiceWeights?.[practice] || 0;
//         const amount = tx.amount * (weight / 100);
//         return {
//           name: practice,
//           amount,
//           isEthical: true,
//           info: tx.information?.[practice] || ""
//         };
//       });
      
//       // Calculate totals
//       const totaldebt = debtPractices.reduce((sum, p) => sum + p.amount, 0);
//       const totalCredit = creditPractices.reduce((sum, p) => sum + p.amount, 0);
//       const netImpact = totaldebt - totalCredit;
      
//       // Create expanded transaction object
//       return {
//         ...tx,
//         debtPractices,
//         creditPractices,
//         totaldebt,
//         totalCredit,
//         netImpact,
//         // Create unique ID for expanded state tracking
//         id: `${tx.date}-${tx.name}-${tx.amount}`
//       };
//     });
    
//     // Sort processed transactions
//     return processed.sort((a, b) => {
//       const aValue = getValue(a, sortConfig.key);
//       const bValue = getValue(b, sortConfig.key);
      
//       // Handle string vs number sorting
//       if (typeof aValue === 'string' && typeof bValue === 'string') {
//         return sortConfig.direction === 'asc' 
//           ? aValue.localeCompare(bValue) 
//           : bValue.localeCompare(aValue);
//       }
      
//       // Numeric sort
//       return sortConfig.direction === 'asc'
//         ? Number(aValue) - Number(bValue)
//         : Number(bValue) - Number(aValue);
//     });
//   }, [transactions, sortConfig, getValue]);
  
//   // Toggle expanded state for a transaction
//   const toggleExpanded = (id: string) => {
//     setExpandedItems(prev => ({
//       ...prev,
//       [id]: !prev[id]
//     }));
//   };
  
//   // Handle sort request
//   const requestSort = useCallback((key: SortKey) => {
//     let direction: 'asc' | 'desc' = 'asc';
    
//     if (sortConfig.key === key && sortConfig.direction === 'asc') {
//       direction = 'desc';
//     }
    
//     setSortConfig({ key, direction });
//   }, [sortConfig]);

//   // Get sort indicator
//   const getSortIndicator = useCallback((key: SortKey) => {
//     if (sortConfig.key !== key) {
//       return null;
//     }
    
//     return sortConfig.direction === 'asc' ? ' ↑' : ' ↓';
//   }, [sortConfig]);
  
//   // Handle offset all
//   const handleOffsetAll = () => {
//     if (!impactAnalysis?.effectiveDebt) return;
//     openDonationModal("All Societal Debt", impactAnalysis.effectiveDebt);
//   };

//   // Handle opening donation modal for a transaction
//   const handleOpenDonationModal = (transaction: EnhancedTransaction) => {
//     openDonationModal(
//       transaction.unethicalPractices?.[0] || "All Societal Debt",
//       transaction.netImpact
//     );
//   };

//   return (
//     <div className="p-3 sm:p-6">
//       <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-3">
//         Ethical Transaction Ledger
//       </h2>
      
//       {/* Description */}
//       <p className="text-sm text-gray-600 mb-4">
//         An expanded view of your transactions with detailed ethical impact. 
//         Click rows to view practice details.
//       </p>
      
//       {/* Sort Controls */}
//       <div className="mb-4 flex flex-wrap gap-2">
//         <div className="text-sm text-gray-700">Sort by:</div>
//         {['date', 'name', 'amount', 'debt', 'credit', 'net'].map(key => (
//           <button
//             key={key}
//             onClick={() => requestSort(key as SortKey)}
//             className={`px-2 py-1 text-xs rounded ${
//               sortConfig.key === key ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
//             }`}
//           >
//             {key.charAt(0).toUpperCase() + key.slice(1)}
//             {getSortIndicator(key as SortKey)}
//           </button>
//         ))}
//       </div>
      
//       {/* Transaction Cards */}
//       <div className="space-y-3 mb-8">
//         {processedTransactions.map((tx) => (
//           <div 
//             key={tx.id} 
//             className="bg-white border rounded-lg shadow-sm overflow-hidden"
//           >
//             {/* Card Header - Always visible */}
//             <div 
//               className={`p-3 cursor-pointer hover:bg-gray-50 transition-colors ${
//                 expandedItems[tx.id] ? 'border-b' : ''
//               }`}
//               onClick={() => toggleExpanded(tx.id)}
//             >
//               <div className="flex flex-wrap items-center">
//                 <div className="w-full md:w-auto md:flex-1 flex items-center mb-2 md:mb-0">
//                   <div className={`mr-3 text-xl ${expandedItems[tx.id] ? 'transform rotate-90' : ''}`}>▶</div>
//                   <div>
//                     <div className="font-medium">{tx.name}</div>
//                     <div className="text-xs text-gray-500">{tx.date}</div>
//                   </div>
//                 </div>
                
//                 <div className="flex items-center gap-4 ml-auto">
//                   <div className="text-right">
//                     <div className="text-sm font-medium text-gray-800">${tx.amount.toFixed(2)}</div>
//                     <div className="flex gap-1 items-center justify-end">
//                       {tx.totaldebt > 0 && (
//                         <span className="text-xs bg-red-100 text-red-700 rounded px-1 py-0.5 mr-1">
//                           -${tx.totaldebt.toFixed(2)}
//                         </span>
//                       )}
//                       {tx.totalCredit > 0 && (
//                         <span className="text-xs bg-green-100 text-green-700 rounded px-1 py-0.5">
//                           +${tx.totalCredit.toFixed(2)}
//                         </span>
//                       )}
//                     </div>
//                   </div>
                  
//                   {tx.netImpact > 0 && (
//                     <button
//                       onClick={(e) => {
//                         e.stopPropagation();
//                         handleOpenDonationModal(tx);
//                       }}
//                       className="bg-green-600 hover:bg-green-700 text-white text-xs px-2 py-1 rounded"
//                     >
//                       Offset
//                     </button>
//                   )}
//                 </div>
//               </div>
//             </div>
            
//             {/* Expanded Content */}
//             {expandedItems[tx.id] && (
//               <div className="p-3 bg-gray-50">
//                 {/* debt Practices */}
//                 {tx.debtPractices.length > 0 && (
//                   <div className="mb-3">
//                     <h4 className="text-sm font-medium text-gray-700 mb-1">Negative Impact</h4>
//                     <div className="space-y-2">
//                       {tx.debtPractices.map((practice, idx) => (
//                         <div key={idx} className="bg-white border border-red-200 rounded p-2">
//                           <div className="flex justify-between items-center mb-1">
//                             <div className="flex items-center">
//                               <span className="bg-red-100 text-red-800 text-xs font-medium px-2 py-0.5 rounded-full mr-2">
//                                 {practice.name}
//                               </span>
//                             </div>
//                             <div className="text-sm font-bold text-red-600">
//                               ${practice.amount.toFixed(2)}
//                             </div>
//                           </div>
//                           {practice.info && (
//                             <div className="text-xs text-gray-600">{practice.info}</div>
//                           )}
//                         </div>
//                       ))}
//                     </div>
//                   </div>
//                 )}
                
//                 {/* Credit Practices */}
//                 {tx.creditPractices.length > 0 && (
//                   <div>
//                     <h4 className="text-sm font-medium text-gray-700 mb-1">Positive Impact</h4>
//                     <div className="space-y-2">
//                       {tx.creditPractices.map((practice, idx) => (
//                         <div key={idx} className="bg-white border border-green-200 rounded p-2">
//                           <div className="flex justify-between items-center mb-1">
//                             <div className="flex items-center">
//                               <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-0.5 rounded-full mr-2">
//                                 {practice.name}
//                               </span>
//                             </div>
//                             <div className="text-sm font-bold text-green-600">
//                               ${practice.amount.toFixed(2)}
//                             </div>
//                           </div>
//                           {practice.info && (
//                             <div className="text-xs text-gray-600">{practice.info}</div>
//                           )}
//                         </div>
//                       ))}
//                     </div>
//                   </div>
//                 )}
//               </div>
//             )}
//           </div>
//         ))}
//       </div>
      
//       {/* Totals Card */}
//       <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
//         <div className="p-4 font-medium text-gray-800">Impact Summary</div>
//         <div className="p-4 pt-0">
//           <div className="grid grid-cols-3 gap-4">
//             <div className="bg-red-50 rounded-lg p-3 text-center">
//               <div className="text-sm text-gray-700 mb-1">Negative Impact</div>
//               <div className="text-xl font-bold text-red-600">${(impactAnalysis?.negativeImpact || 0).toFixed(2)}</div>
//             </div>
            
//             <div className="bg-green-50 rounded-lg p-3 text-center">
//               <div className="text-sm text-gray-700 mb-1">Positive Impact</div>
//               <div className="text-xl font-bold text-green-600">${(impactAnalysis?.positiveImpact || 0).toFixed(2)}</div>
//             </div>
            
//             <div className="bg-blue-50 rounded-lg p-3 text-center">
//               <div className="text-sm text-gray-700 mb-1">Net Impact</div>
//               <div className={`text-xl font-bold ${getColorClass(impactAnalysis?.netSocietalDebt || 0)}`}>
//                 ${Math.abs(impactAnalysis?.netSocietalDebt || 0).toFixed(2)}
//               </div>
//             </div>
//           </div>
          
//           {(impactAnalysis?.effectiveDebt || 0) > 0 && (
//             <div className="mt-4 text-center">
//               <button
//                 onClick={handleOffsetAll}
//                 className="bg-green-600 hover:bg-green-700 text-white font-medium px-4 py-2 rounded shadow transition-colors"
//               >
//                 Offset All (${(impactAnalysis?.effectiveDebt || 0).toFixed(2)})
//               </button>
//             </div>
//           )}
//         </div>
//       </div>
      
//       {/* Donation Modal */}
//       {modalState.isOpen && (
//         <DonationModal
//           practice={modalState.practice}
//           amount={modalState.amount}
//           isOpen={modalState.isOpen}
//           onClose={closeDonationModal}
//         />
//       )}
//     </div>
//   );
// }