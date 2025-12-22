// src/features/dashboard/views/TransactionsListView.tsx
"use client";

import React, { useMemo } from "react";
import { useTransactionStore } from "@/store/transactionStore";
import { TransactionDetailItem } from "./TransactionDetailItem";

export function TransactionsListView() {
  // Subscribe directly to the store to ensure we get updates
  const transactions = useTransactionStore(state => state.transactions);
  
  // Sort transactions by date descending (newest first)
  const sortedTransactions = useMemo(() => {
    if (!transactions || transactions.length === 0) return [];
    const sorted = [...transactions].sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      // Handle invalid dates
      if (isNaN(dateA) && isNaN(dateB)) return 0;
      if (isNaN(dateA)) return 1;
      if (isNaN(dateB)) return -1;
      return dateB - dateA; // Newest first
    });
    return sorted;
  }, [transactions]);

  if (sortedTransactions.length === 0) {
    return (
      <div className="card p-6 text-center">
        <p className="text-gray-500 dark:text-gray-400">No transactions found.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-[var(--card-foreground)] mb-2">
          All Transactions
        </h2>
        <p className="text-sm text-[var(--muted-foreground)]">
          {sortedTransactions.length} transaction{sortedTransactions.length !== 1 ? 's' : ''} sorted by date (newest first)
        </p>
      </div>
      
      <div className="space-y-3">
        {sortedTransactions.map((transaction, index) => {
          // Create a stable key that includes transaction identifier and index
          const transactionKey = transaction.id || 
                                 transaction.plaidTransactionId || 
                                 `${transaction.date}-${transaction.name}-${transaction.amount}-${index}`;
          return (
            <TransactionDetailItem 
              key={transactionKey}
              transaction={transaction}
            />
          );
        })}
      </div>
    </div>
  );
}
