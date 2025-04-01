// // src/features/dashboard/views/CategoryExperimentView.tsx

// "use client";

// import React, { useState, useMemo } from "react";
// import { Transaction } from "@/shared/types/transactions";
// import { DonationModal } from "@/features/charity/DonationModal";
// import { useDonationModal } from "@/hooks/useDonationModal";

// interface CategoryExperimentViewProps {
//   transactions: Transaction[];
// }

// interface PracticeData {
//   name: string;
//   amount: number;
//   isEthical: boolean;
//   vendorContributions: {
//     vendorName: string;
//     amount: number;
//     percentage: number;
//   }[];
// }

// interface CategoryData {
//   name: string;
//   practices: PracticeData[];
//   totalAmount: number;
//   positiveAmount: number;
//   negativeAmount: number;
// }

// type SortKey = 'name' | 'totalAmount' | 'positiveAmount' | 'negativeAmount';

// interface SortConfig {
//   key: SortKey;
//   direction: 'asc' | 'desc';
// }

// export function CategoryExperimentView({
//   transactions,
// }: CategoryExperimentViewProps) {
//   const [searchTerm, setSearchTerm] = useState("");
//   const [sortConfig, setSortConfig] = useState<SortConfig>({
//     key: 'name',
//     direction: 'asc'
//   });
//   const { modalState, openDonationModal, closeDonationModal } = useDonationModal({ transactions });

//   // Calculate category data
//   const categoryData = useMemo(() => {
//     const categories: Record<string, CategoryData> = {};
    
//     transactions.forEach(transaction => {
//       // Get the first unethical practice as the category
//       const category = transaction.unethicalPractices?.[0] || "Other";
//       if (!categories[category]) {
//         categories[category] = {
//           name: category,
//           practices: [],
//           totalAmount: 0,
//           positiveAmount: 0,
//           negativeAmount: 0
//         };
//       }
      
//       // Calculate the amount for this category based on practice weights
//       const weight = transaction.practiceWeights?.[category] || 0;
//       const amount = transaction.amount * (weight / 100);
      
//       categories[category].totalAmount += amount;
//       if (amount > 0) {
//         categories[category].positiveAmount += amount;
//       } else {
//         categories[category].negativeAmount += Math.abs(amount);
//       }
//     });

//     return Object.values(categories);
//   }, [transactions]);

//   // Filter and sort categories
//   const sortedCategories = useMemo(() => {
//     return [...categoryData].sort((a, b) => {
//       if (sortConfig.key === 'name') {
//         return sortConfig.direction === 'asc' 
//           ? a.name.localeCompare(b.name)
//           : b.name.localeCompare(a.name);
//       }
//       return sortConfig.direction === 'asc'
//         ? a[sortConfig.key] - b[sortConfig.key]
//         : b[sortConfig.key] - a[sortConfig.key];
//     });
//   }, [categoryData, sortConfig]);

//   // Handle search
//   const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//     setSearchTerm(e.target.value);
//   };

//   // Handle sorting
//   const requestSort = (key: SortKey) => {
//     setSortConfig(prev => ({
//       key,
//       direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
//     }));
//   };

//   // Get sort indicator
//   const getSortIndicator = (key: SortKey) => {
//     if (sortConfig.key !== key) return null;
//     return sortConfig.direction === 'asc' ? '↑' : '↓';
//   };

//   return (
//     <div className="space-y-4">
//       <div className="flex justify-between items-center">
//         <h2 className="text-2xl font-bold">Category Experiment</h2>
//         <div className="flex space-x-4">
//           <input
//             type="text"
//             placeholder="Search categories..."
//             value={searchTerm}
//             onChange={handleSearchChange}
//             className="px-4 py-2 border rounded-lg"
//           />
//         </div>
//       </div>

//       <div className="overflow-x-auto">
//         <table className="min-w-full divide-y divide-gray-200">
//           <thead>
//             <tr>
//               <th
//                 className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
//                 onClick={() => requestSort('name')}
//               >
//                 Category {getSortIndicator('name')}
//               </th>
//               <th
//                 className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
//                 onClick={() => requestSort('totalAmount')}
//               >
//                 Total Amount {getSortIndicator('totalAmount')}
//               </th>
//               <th
//                 className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
//                 onClick={() => requestSort('positiveAmount')}
//               >
//                 Positive Amount {getSortIndicator('positiveAmount')}
//               </th>
//               <th
//                 className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
//                 onClick={() => requestSort('negativeAmount')}
//               >
//                 Negative Amount {getSortIndicator('negativeAmount')}
//               </th>
//               <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                 Actions
//               </th>
//             </tr>
//           </thead>
//           <tbody className="bg-white divide-y divide-gray-200">
//             {sortedCategories.map((category) => (
//               <tr key={category.name}>
//                 <td className="px-6 py-4 whitespace-nowrap">
//                   <div className="text-sm font-medium text-gray-900">{category.name}</div>
//                 </td>
//                 <td className="px-6 py-4 whitespace-nowrap">
//                   <div className="text-sm text-gray-900">${category.totalAmount.toFixed(2)}</div>
//                 </td>
//                 <td className="px-6 py-4 whitespace-nowrap">
//                   <div className="text-sm text-green-600">${category.positiveAmount.toFixed(2)}</div>
//                 </td>
//                 <td className="px-6 py-4 whitespace-nowrap">
//                   <div className="text-sm text-red-600">${category.negativeAmount.toFixed(2)}</div>
//                 </td>
//                 <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
//                   <button
//                     onClick={() => openDonationModal(category.name, Math.abs(category.totalAmount))}
//                     className="text-indigo-600 hover:text-indigo-900"
//                   >
//                     Offset
//                   </button>
//                 </td>
//               </tr>
//             ))}
//           </tbody>
//         </table>
//       </div>

//       <DonationModal
//         practice={modalState.practice}
//         amount={modalState.amount}
//         isOpen={modalState.isOpen}
//         onClose={closeDonationModal}
//       />
//     </div>
//   );
// }