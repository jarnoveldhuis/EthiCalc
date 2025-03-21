// src/features/analysis/TabView.tsx
import React, { useState, useEffect } from "react";
import { Transaction } from "@/shared/types/transactions";
import { ConsolidatedImpactView } from "./ConsolidatedImpactView";
import { TransactionList } from "./TransactionList";
import { CategoryExperimentView } from "./CategoryExperimentView";
import { VendorBreakdownView } from "./VendorBreakdownView";

interface TabViewProps {
  transactions: Transaction[];
  totalSocietalDebt: number;
  getColorClass: (value: number) => string;
  initialActiveTab?: TabType;
}

export type TabType = "impact" | "transactions" | "categories" | "vendors";

export function TabView({
  transactions,
  totalSocietalDebt,
  getColorClass,
  initialActiveTab = "transactions",
}: TabViewProps) {
  const [activeTab, setActiveTab] = useState<TabType>(initialActiveTab);

  // Update active tab when initialActiveTab prop changes
  useEffect(() => {
    if (initialActiveTab) {
      setActiveTab(initialActiveTab);
    }
  }, [initialActiveTab]);

  // Set the initial active tab based on whether analysis is completed
  useEffect(() => {
    if (transactions.length > 0 && totalSocietalDebt !== 0) {
      // If transactions are loaded and analyzed, default to impact view
      setActiveTab(initialActiveTab);
    }
  }, [transactions.length, totalSocietalDebt, initialActiveTab]);

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      {/* Tab Navigation - responsive for mobile */}
      <div className="flex flex-wrap border-b">
        <TabButton
          active={activeTab === "impact"}
          onClick={() => setActiveTab("impact")}
        >
          Impact Summary
        </TabButton>
        <TabButton
          active={activeTab === "transactions"}
          onClick={() => setActiveTab("transactions")}
        >
          Transactions
        </TabButton>
        <TabButton
          active={activeTab === "vendors"}
          onClick={() => setActiveTab("vendors")}
        >
          Vendors
        </TabButton>
        <TabButton
          active={activeTab === "categories"}
          onClick={() => setActiveTab("categories")}
          className="text-xs sm:text-sm"
        >
          Categories
        </TabButton>
      </div>

      {/* Tab Content - Content aligned to top */}
      <div className="p-0">
        {activeTab === "impact" && (
          <ConsolidatedImpactView
            transactions={transactions}
            totalSocietalDebt={totalSocietalDebt}
          />
        )}
        {activeTab === "transactions" && (
          <TransactionList
            transactions={transactions}
            getColorClass={getColorClass}
          />
        )}
        {activeTab === "categories" && (
          <CategoryExperimentView
            transactions={transactions}
            totalSocietalDebt={totalSocietalDebt}
          />
        )}
        {activeTab === "vendors" && (
          <VendorBreakdownView
            transactions={transactions}
            totalSocietalDebt={totalSocietalDebt}
            getColorClass={getColorClass}
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