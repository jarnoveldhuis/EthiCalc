// // src/features/dashboard/views/TransactionList.tsx
// import { Transaction } from "@/shared/types/transactions";
// import { TransactionListItem } from "../../analysis/TransactionListItem";
// import { calculationService } from "@/core/calculations/impactService";
// import { DonationModal } from "@/features/charity/DonationModal";
// import { useState } from "react";

// interface TransactionListProps {
//   transactions: Transaction[];
//   getColorClass: (value: number) => string;
// }

// export function TransactionList({ transactions, getColorClass }: TransactionListProps) {
//   const [isDonationModalOpen, setIsDonationModalOpen] = useState(false);
  
//   if (transactions.length === 0) return null;
  
//   // Calculate total societal debt using the calculation service
//   const totalSocietalDebt = calculationService.calculateNetSocietalDebt(transactions);
  
//   const handleOffsetAll = () => {
//     setIsDonationModalOpen(true);
//   };
  
//   return (
//     <div className="p-2 sm:p-6">
//       <h2 className="text-2xl font-bold text-gray-800 mb-4">
//         Your Transactions
//       </h2>
      
//       {transactions.length === 0 ? (
//         <p className="text-gray-500 text-center py-4">No transactions found.</p>
//       ) : (
//         <>
//           {/* Non-scrolling list that matches other tabs */}
//           <div className="space-y-3 mt-4 mb-6 sm:mb-8">
//             {transactions.map((transaction, index) => (
//               <div key={index} className="border rounded-lg overflow-hidden shadow-sm">
//                 <div className="p-2 sm:p-3 border-l-4 border-gray-300 bg-gray-50">
//                   <TransactionListItem 
//                     transaction={transaction}
//                     getColorClass={getColorClass}
//                   />
//                 </div>
//               </div>
//             ))}
//           </div>
          
//           {/* Add totals at the bottom for consistency with other tabs */}
//           <div className="mt-8 pt-4 border-t-2 border-gray-300">
//             <div className="flex justify-center items-center">
//               <div className="text-center">
//                 <div className={`text-xl font-bold ${totalSocietalDebt > 0 ? 'text-red-600' : 'text-green-600'}`}>
//                   Net {totalSocietalDebt > 0 ? 'Damage' : 'Benefit'}: ${Math.abs(totalSocietalDebt).toFixed(2)}
//                 </div>
                
//                 {totalSocietalDebt > 0 && (
//                   <button
//                     onClick={handleOffsetAll}
//                     className="mt-2 bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-bold shadow transition-colors"
//                   >
//                     Offset All (${totalSocietalDebt.toFixed(2)})
//                   </button>
//                 )}
//               </div>
//             </div>
//           </div>
          
//           {/* Donation Modal */}
//           {isDonationModalOpen && (
//             <DonationModal
//               practice="All Societal Debt"
//               amount={totalSocietalDebt}
//               isOpen={isDonationModalOpen}
//               onClose={() => setIsDonationModalOpen(false)}
//             />
//           )}
//         </>
//       )}
//     </div>
//   );
// }