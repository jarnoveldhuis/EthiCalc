// src/features/banking/PlaidConnectionSection.tsx
"use client";

import { useState } from 'react';
import PlaidLink from "@/features/banking/PlaidLink";
import { useSampleData } from '@/features/debug/useSampleData';
import { config } from '@/config';
import { LoadingSpinner } from "@/shared/components/ui/LoadingSpinner";

// Determine if we're in development/sandbox mode
const isSandboxMode = process.env.NODE_ENV === 'development' || config.plaid.isSandbox;

interface PlaidConnectionSectionProps {
  onSuccess: (public_token: string | null) => void;
  isConnected: boolean;
  isLoading?: boolean;
}

export function PlaidConnectionSection({ 
  onSuccess, 
  isConnected,
  isLoading = false
}: PlaidConnectionSectionProps) {
  // Add internal loading state
  const [linkLoading] = useState(false);
  // We're keeping showSampleOption state even though we're not modifying it
  // because it might be needed in the future for UI toggling
  const [showSampleOption] = useState(isSandboxMode);
  const { generateSampleTransactions } = useSampleData();

  // Sample data handler for development
  const handleUseSampleData = () => {
    // Generate sample transactions directly
    const sampleTransactions = generateSampleTransactions();
    
    // Call onSuccess with null to indicate we're not using Plaid
    // The parent component should detect this and use the sample data
    onSuccess(null);
    
    // This is where you would call a function to load the sample data
    // In the real implementation, you should have a way to pass these
    // transactions to your analysis service
    console.log("Sample data loaded:", sampleTransactions);
  };

  // Combined loading state from props and internal state
  const showLoading = isLoading || linkLoading;

  if (showLoading) {
    return (
      <div className="flex flex-col items-center">
        <LoadingSpinner message="Connecting to your bank..." />
        <p className="text-sm text-gray-500 mt-2">
          This might take a moment. Please do not close this window.
        </p>
      </div>
    );
  }

  if (isConnected) {
    return (
      <div className="flex flex-col items-center">
        <span className="bg-green-100 text-green-800 text-sm px-3 py-1 rounded-full">
          ✓ Bank account connected
        </span>
        <span className="text-xs text-gray-500 mt-1">
          Your transactions are available for analysis.
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center space-y-3">
      <PlaidLink 
        onSuccess={onSuccess} 
        // onLoadingChange={setLinkLoading}
      />
      
      {/* Sample data option for development */}
      {showSampleOption && (
        <div className="mt-4">
          <div className="text-center">
            <div className="text-xs text-gray-500 mb-2">- OR -</div>
            <button
              onClick={handleUseSampleData}
              className="text-blue-600 hover:text-blue-800 text-sm underline"
            >
              Use Sample Data (Development Only)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}