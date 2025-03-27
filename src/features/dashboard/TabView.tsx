// src/features/analysis/TabView.tsx
import React, { useState, useEffect } from "react";
import { Transaction } from "@/shared/types/transactions";
import { TransactionTableView } from "./views/TransactionTableView";
import { BalanceSheetView } from "./views/BalanceSheetView";
import { VendorBreakdownView } from "./views/VendorBreakdownView";
import { GroupedImpactSummary } from "./views/GroupedImpactSummary";

interface TabViewProps {
  transactions: Transaction[];
  totalSocietalDebt: number;
  getColorClass: (value: number) => string;
  initialActiveTab?: TabType;
}

export type TabType = "transaction-table" | "balance-sheet" | "vendor-breakdown" | "grouped-impact";

export function TabView({
  transactions,
  totalSocietalDebt,
  getColorClass,
  initialActiveTab = "transaction-table",
}: TabViewProps) {
  const [activeTab, setActiveTab] = useState<TabType>(initialActiveTab);

  // Update active tab when initialActiveTab prop changes
  useEffect(() => {
    if (initialActiveTab) {
      setActiveTab(initialActiveTab);
    }
  }, [initialActiveTab]);

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      {/* Tab Navigation - responsive for mobile */}
      <div className="flex flex-wrap border-b">
        <TabButton
          active={activeTab === "transaction-table"}
          onClick={() => setActiveTab("transaction-table")}
        >
          Transactions
        </TabButton>
        <TabButton
          active={activeTab === "balance-sheet"}
          onClick={() => setActiveTab("balance-sheet")}
        >
          Balance Sheet
        </TabButton>
        <TabButton
          active={activeTab === "vendor-breakdown"}
          onClick={() => setActiveTab("vendor-breakdown")}
        >
          Vendors
        </TabButton>
        <TabButton
          active={activeTab === "grouped-impact"}
          onClick={() => setActiveTab("grouped-impact")}
        >
          Impact by Category
        </TabButton>
      </div>

      {/* Tab Content */}
      <div className="p-0">
        {activeTab === "transaction-table" && (
          <TransactionTableView
            transactions={transactions}
            totalSocietalDebt={totalSocietalDebt}
          />
        )}
        {activeTab === "balance-sheet" && (
          <BalanceSheetView
            transactions={transactions}
            totalSocietalDebt={totalSocietalDebt}
          />
        )}
        {activeTab === "vendor-breakdown" && (
          <VendorBreakdownView
            transactions={transactions}
            totalSocietalDebt={totalSocietalDebt}
            getColorClass={getColorClass}
          />
        )}
        {activeTab === "grouped-impact" && (
          <GroupedImpactSummary
            transactions={transactions}
            totalSocietalDebt={totalSocietalDebt}
          />
        )}
      </div>
    </div>
  );
}

// Helper component for tab buttons
function TabButton({ 
  children, 
  active, 
  onClick,
  className = ""
}: { 
  children: React.ReactNode; 
  active: boolean; 
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      className={`px-3 sm:px-4 py-2 font-medium text-xs sm:text-sm focus:outline-none ${
        active
          ? "border-b-2 border-blue-500 text-blue-600"
          : "text-gray-500 hover:text-gray-700 hover:border-gray-300 hover:border-b"
      } ${className}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}