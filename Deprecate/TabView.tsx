// // src/features/dashboard/TabView.tsx - Simplified example
// import React from "react";
// import { useTransactionStore } from "@/store/transactionStore";
// import { TransactionTableView } from "../src/features/dashboard/views/TransactionTableView";
// import { BalanceSheetView } from "../src/features/dashboard/views/BalanceSheetView";
// import { VendorBreakdownView } from "../src/features/dashboard/views/VendorBreakdownView";
// import { GroupedImpactSummary } from "../src/features/dashboard/views/GroupedImpactSummary";

// export function TabView() {
//   // Get everything from the store
//   const { 
//     transactions, 
//     impactAnalysis, 
//     activeView, 
//     setActiveView 
//   } = useTransactionStore();

//   // Shared props for all views
//   const viewProps = {
//     transactions,
//     totalSocietalDebt: impactAnalysis?.netSocietalDebt || 0
//   };

//   // Tab navigation buttons
//   const tabs = [
//     { id: "transaction-table", label: "Transactions" },
//     { id: "balance-sheet", label: "Balance Sheet" },
//     { id: "vendor-breakdown", label: "Vendors" },
//     { id: "grouped-impact", label: "Impact by Category" }
//   ];

//   return (
//     <div className="bg-white rounded-lg shadow-md overflow-hidden">
//       {/* Tab Navigation */}
//       <div className="flex flex-wrap border-b">
//         {tabs.map((tab) => (
//           <button
//             key={tab.id}
//             onClick={() => setActiveView(tab.id)}
//             className={`px-3 sm:px-4 py-2 font-medium text-xs sm:text-sm focus:outline-none ${
//               activeView === tab.id
//                 ? "border-b-2 border-blue-500 text-blue-600"
//                 : "text-gray-500 hover:text-gray-700 hover:border-gray-300 hover:border-b"
//             }`}
//           >
//             {tab.label}
//           </button>
//         ))}
//       </div>

//       {/* Tab Content */}
//       <div className="p-0">
//         {activeView === "transaction-table" && (
//           <TransactionTableView {...viewProps} />
//         )}
//         {activeView === "balance-sheet" && (
//           <BalanceSheetView {...viewProps} />
//         )}
//         {activeView === "vendor-breakdown" && (
//           <VendorBreakdownView {...viewProps} />
//         )}
//         {activeView === "grouped-impact" && (
//           <GroupedImpactSummary {...viewProps} />
//         )}
//       </div>
//     </div>
//   );
// }