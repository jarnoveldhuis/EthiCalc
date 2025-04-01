// src/app/dashboard/page.tsx
"use client";

import { useCallback, useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useBankConnection } from "@/hooks/useBankConnection";
import { useTransactionStorage } from "@/hooks/useTransactionStorage";
import { useTransactionAnalysis } from "@/hooks/useTransactionAnalysis";
import { useImpactAnalysis } from "@/hooks/useImpactAnalysis";
import { Transaction } from "@/shared/types/transactions";
import { ErrorAlert } from "@/shared/ui/ErrorAlert";
import { DashboardLayout } from "@/features/dashboard/DashboardLayout";
import { DashboardSidebar } from "@/features/dashboard/DashboardSidebar";
import { PlaidConnectionSection } from "@/features/banking/PlaidConnectionSection";
import { BalanceSheetView } from "@/features/dashboard/views/BalanceSheetView";
import { TransactionTableView } from "@/features/dashboard/views/TransactionTableView";
import { VendorBreakdownView } from "@/features/dashboard/views/VendorBreakdownView";
import { GroupedImpactSummary } from "@/features/dashboard/views/GroupedImpactSummary";
import { getColorClass } from "@/core/calculations/impactService";
import { ManualFetchButton } from "@/features/debug/ManualFetchButton";
import { DashboardLoading, DashboardEmptyState } from "@/features/dashboard/DashboardLoading";
import { mergeTransactions } from "@/core/plaid/transactionMapper";
import { useSampleData } from "@/features/debug/useSampleData";

// Define view types for better type safety
type ViewType = "balance-sheet" | "transaction-table" | "vendor-breakdown" | "grouped-impact" | "premium-view";

export default function Dashboard() {
  // Core state
  const [activeView, setActiveView] = useState<ViewType>("grouped-impact");
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>("Loading your dashboard...");
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [firebaseLoadingComplete, setFirebaseLoadingComplete] = useState<boolean>(false);

  // Auth hook
  const { user, loading: authLoading, logout } = useAuth();

  // Bank connection hook
  const {
    connectionStatus,
    transactions,
    connectBank,
    disconnectBank,
    manuallyFetchTransactions,
  } = useBankConnection(user);

  // Transaction storage hook
  const {
    savedTransactions,
    isLoading: storageLoading,
    error: storageError,
    saveTransactions,
    hasSavedData,
    loadLatestTransactions,
  } = useTransactionStorage(user);

  // Transaction analysis hook
  const {
    analyzedData,
    analysisStatus,
    analyzeTransactions,
  } = useTransactionAnalysis(savedTransactions);

  // Sample data utility
  const { generateSampleTransactions } = useSampleData();

  // Derived/computed state
  const effectiveConnectionStatus: boolean = connectionStatus.isConnected;
  
  const isLoading: boolean = connectionStatus.isLoading || 
                             analysisStatus.status === "loading" || 
                             storageLoading;
  
  const error: string | null = connectionStatus.error || 
                               analysisStatus.error || 
                               storageError || 
                               fetchError;
  
  const bankConnecting: boolean = connectionStatus.isLoading || isConnecting;

// Display transactions - merging analyzed data with saved transactions
const displayTransactions: Transaction[] = useMemo(() => {
  if (analyzedData?.transactions && savedTransactions) {
    return mergeTransactions(savedTransactions, analyzedData.transactions);
  }
  return analyzedData?.transactions || savedTransactions || [];
}, [analyzedData, savedTransactions]);

  // Impact analysis hook
  const {
    impactAnalysis,
    applyCredit,
    isApplyingCredit,
  } = useImpactAnalysis(displayTransactions, user);

const hasData: boolean = displayTransactions.length > 0;

  // Handle loading sample data
  const handleLoadSampleData = useCallback(async () => {
    try {
      setLoadingMessage("Generating sample data...");
      const sampleTransactions = generateSampleTransactions();
      const totalDebt = sampleTransactions.reduce((sum, tx) => sum + (tx.societalDebt || 0), 0);
      await saveTransactions(sampleTransactions, totalDebt);
      await analyzeTransactions(sampleTransactions);
    } catch (error) {
      console.error("Error loading sample data:", error);
      setFetchError("Failed to load sample data");
    }
  }, [generateSampleTransactions, saveTransactions, analyzeTransactions]);

  const handlePlaidSuccess = useCallback(async (publicToken: string | null) => {
    setIsConnecting(true);
    setLoadingMessage("Connecting to your bank...");

    try {
      if (publicToken) {
        await connectBank(publicToken);
      } else {
        // For sample data when no token provided
        handleLoadSampleData();
      }
    } catch (error) {
      console.error("Error connecting bank:", error);
      setFetchError(error instanceof Error ? error.message : "Unknown error connecting bank");
    } finally {
      setIsConnecting(false);
    }
  }, [connectBank, handleLoadSampleData]);

  // Manual fetch handler
  const handleManualFetch = useCallback(async () => {
    setFetchError(null);
    try {
      await manuallyFetchTransactions();
    } catch (error) {
      console.error("Manual fetch error:", error);
      setFetchError(error instanceof Error ? error.message : "Unknown error fetching transactions");
    }
  }, [manuallyFetchTransactions]);

  // Load data from Firebase on mount
  useEffect(() => {
    if (user && !firebaseLoadingComplete && !hasSavedData && !storageLoading) {
      loadLatestTransactions()
        .then(() => {
          setFirebaseLoadingComplete(true);
        })
        .catch((err) => {
          console.error("Firebase load failed:", err);
          setFirebaseLoadingComplete(true); // Mark as complete even on error
        });
    }
  }, [user, firebaseLoadingComplete, hasSavedData, storageLoading, loadLatestTransactions]);

  // Save analyzed data to Firebase
  useEffect(() => {
    if (user && analyzedData && analyzedData.transactions.length > 0) {
      // Use the existing transactions or an empty array if none exist
      const existingTx = savedTransactions || [];
      const newTx = analyzedData.transactions;

      // Use your existing merge function to combine them
      const mergedTransactions = mergeTransactions(existingTx, newTx);

      // Only save if we actually have new transactions
      if (mergedTransactions.length > existingTx.length) {
        saveTransactions(mergedTransactions, analyzedData.totalSocietalDebt);
      }
    }
  }, [user, analyzedData, savedTransactions, saveTransactions, hasSavedData]);

  // Analyze transactions from the bank connection
  useEffect(() => {
    if (transactions && transactions.length > 0 && !analyzedData) {
      analyzeTransactions(transactions);
    }
  }, [transactions, analyzedData, analyzeTransactions]);

  // Render based on loading state
  if (authLoading) {
    return <DashboardLoading message="Checking authentication..." />;
  }

  // Redirect handled by useAuth hook
  if (!user) {
    return <DashboardLoading message="Redirecting to login..." />;
  }

  // Render the active view based on state
  const renderActiveView = () => {
    if (isLoading) {
      return <DashboardLoading message={loadingMessage} />;
    }

    if (!hasData) {
      return (
        <DashboardEmptyState 
          effectiveConnectionStatus={effectiveConnectionStatus}
          bankConnecting={bankConnecting}
        />
      );
    }

    // Common props for all views
    const viewProps = {
      transactions: displayTransactions,
      totalSocietalDebt: impactAnalysis?.netSocietalDebt || 0,
      getColorClass
    };

    // Return the appropriate view component
    switch (activeView) {
      case "transaction-table":
        return <TransactionTableView {...viewProps} />;
      case "balance-sheet":
        return <BalanceSheetView {...viewProps} />;
      case "vendor-breakdown":
        return <VendorBreakdownView {...viewProps} />;
      case "grouped-impact":
        return <GroupedImpactSummary {...viewProps} />;
      default:
        return <BalanceSheetView {...viewProps} />;
    }
  };

  // Main render
  return (
    <DashboardLayout
      user={user}
      onLogout={logout}
      onDisconnectBank={disconnectBank}
      isBankConnected={effectiveConnectionStatus}
    >
      {/* Error display */}
      {error && <ErrorAlert message={error} />}

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <DashboardSidebar
            impactAnalysis={impactAnalysis}
            activeView={activeView}
            onViewChange={(view: string) => setActiveView(view as ViewType)}
            onApplyCredit={applyCredit}
            isApplyingCredit={isApplyingCredit}
            hasTransactions={hasData}
          />
        </div>

        {/* Main content area */}
        <div className="lg:col-span-3">
          {/* Bank Connection (only when not connected) */}
          {!effectiveConnectionStatus && (
            <div className="bg-white rounded-xl shadow-md p-6 mb-6">
              <h2 className="text-lg font-semibold text-blue-800 mb-2">
                Connect Your Bank
              </h2>
              <p className="text-gray-700 mb-4">
                Connect your bank account to analyze the ethical impact of your spending.
              </p>
              <PlaidConnectionSection
                onSuccess={handlePlaidSuccess}
                isConnected={effectiveConnectionStatus}
                isLoading={bankConnecting}
              />
            </div>
          )}

          {/* Manual Fetch Button (when connected but no data) */}
          {effectiveConnectionStatus && !hasData && (
            <ManualFetchButton
              onFetch={handleManualFetch}
              className="mb-6"
              showAfterTimeout={8000} // Show after 8 seconds if no data appears
            />
          )}

          {/* Main view content */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            {renderActiveView()}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}