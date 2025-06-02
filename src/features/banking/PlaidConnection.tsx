// src/tsx/features/banking/PlaidConnectionSection.tsx
"use client";

import React, { useState } from 'react'; // Added React import
import PlaidLink from "@/features/banking/PlaidLink"; // Assuming PlaidLink is separate
import { useSampleData } from '@/features/debug/useSampleData'; // If sample data button is used
import { config } from '@/config';
import { LoadingSpinner } from "@/shared/ui/LoadingSpinner";
// Store hook is NOT needed here anymore

// Determine if we're in development/sandbox mode
const isSandboxMode = process.env.NODE_ENV === 'development' || config.plaid.isSandbox;
console.log("sandbox:", isSandboxMode)
interface PlaidConnectionSectionProps {
  onSuccess: (public_token: string | null) => void; // Allow null for sample data flow
  isConnected: boolean; // Status passed from parent
  isLoading?: boolean; // Loading state passed from parent (e.g., isPlaidConnecting)
}

export function PlaidConnectionSection({
  onSuccess,
  isConnected,
  isLoading = false // Use the prop passed from parent
}: PlaidConnectionSectionProps) {

  // Internal loading state specifically for the Plaid Link iframe loading, if needed
  // Set initial state to false
  const [linkLoading] = useState<boolean>(false);

  // Sample data state (keep if button is used)
  const [showSampleOption] = useState(true);
  const { generateSampleTransactions } = useSampleData(); // Ensure this hook exports correctly

  // Sample data handler
  const handleUseSampleData = () => {
    // Ensure generateSampleTransactions exists and is callable
    if (typeof generateSampleTransactions === 'function') {
        const sampleTransactions = generateSampleTransactions();
        onSuccess(null); // Indicate sample data usage
        console.log("Sample data generated (in PlaidConnectionSection):", sampleTransactions);
        // Actual loading into the store happens in the parent (Dashboard page)
    } else {
        console.error("generateSampleTransactions is not available.");
        // Optionally show an error to the user
    }
  };

  // --- Corrected Loading Logic ---
  // Use the isLoading prop from the parent and the internal linkLoading state
  const showLoading = isLoading || linkLoading;
  // REMOVED reference to connectionStatus.isLoading

  if (showLoading) {
    return (
      <div className="flex flex-col items-center py-6"> {/* Added padding */}
        <LoadingSpinner message="Connecting to your bank..." />
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 text-center"> {/* Added text-center */}
          This might take a moment. Please do not close this window.
        </p>
      </div>
    );
  }

  // isConnected prop determines if we show the connected message or the PlaidLink button
  if (isConnected) {
    return (
      <div className="flex flex-col items-center py-6"> {/* Added padding */}
        <span className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-sm px-3 py-1 rounded-full">
          ✓ Bank account connected
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Your transactions are available for analysis.
        </span>
      </div>
    );
  }

  // If not connected and not loading, show the PlaidLink button
  return (
    <div className="flex flex-col items-center space-y-3 py-6"> {/* Added padding */}
      <PlaidLink
        onSuccess={onSuccess}
        // Pass setLinkLoading to PlaidLink if it supports an onLoadingChange prop
        // onLoadingChange={setLinkLoading}
      />

      {/* Sample data option for development */}
      {showSampleOption && (
        <div className="mt-4 text-center">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">- OR -</div>
            <button
              onClick={handleUseSampleData}
              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm underline focus:outline-none focus:ring-2 focus:ring-blue-500" // Added focus style
            >
              Use Sample Data
            </button>
        </div>
      )}
    </div>
  );
}