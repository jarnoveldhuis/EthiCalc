// src/features/dashboard/RefreshTransactionsButton.tsx
"use client";

import React, { useState } from "react";
import { useTransactionStore } from "@/store/transactionStore";

interface RefreshTransactionsButtonProps {
  onRefresh: () => Promise<void>;
}

export function RefreshTransactionsButton({ onRefresh }: RefreshTransactionsButtonProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const appStatus = useTransactionStore(state => state.appStatus);
  
  // Disable button when already fetching/analyzing
  const isDisabled = isRefreshing || 
    appStatus === 'fetching_plaid' || 
    appStatus === 'analyzing' || 
    appStatus === 'saving_batch' ||
    appStatus === 'connecting_bank';

  const handleClick = async () => {
    if (isDisabled) return;
    
    setIsRefreshing(true);
    try {
      await onRefresh();
    } catch (error) {
      console.error("Refresh transactions error:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isDisabled}
      className={`
        px-3 py-1.5 text-sm font-medium rounded-md transition-colors
        ${isDisabled
          ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600'
        }
      `}
      title={isDisabled ? 'Already fetching transactions...' : 'Fetch new transactions from your bank'}
    >
      {isRefreshing || appStatus === 'fetching_plaid' ? (
        <span className="flex items-center gap-2">
          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Fetching...
        </span>
      ) : (
        <span className="flex items-center gap-2">
          <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </span>
      )}
    </button>
  );
}
