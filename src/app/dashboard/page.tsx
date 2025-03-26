"use client";

import { useCallback, useState, useEffect, useMemo } from "react";
// import { ClearFirestoreButton } from "@/features/debug/ClearFirestoreButton";
// import { SandboxTestingPanel } from "@/features/debug/SandboxTestingPanel";
import { useAuth } from "@/hooks/useAuth";
import { useBankConnection } from "@/hooks/useBankConnection";
import { useTransactionStorage } from "@/hooks/useTransactionStorage";
import { useTransactionAnalysis } from "@/hooks/useTransactionAnalysis";
import { useImpactAnalysis } from "@/hooks/useImpactAnalysis";
import { ErrorAlert } from "@/shared/ui/ErrorAlert";
import { config } from "@/config";
import { DashboardLayout } from "@/features/dashboard/DashboardLayout";
import { DashboardSidebar } from "@/features/dashboard/DashboardSidebar";
import { PlaidConnectionSection } from "@/features/banking/PlaidConnectionSection";
import { PremiumTransactionView } from "@/features/dashboard/views/PremiumTransactionView";
import { TransactionTableView } from "@/features/dashboard/views/TransactionTableView";
import { BalanceSheetView } from "@/features/dashboard/views/BalanceSheetView";
import { VendorBreakdownView } from "@/features/dashboard/views/VendorBreakdownView";
import { GroupedImpactSummary } from "@/features/dashboard/views/GroupedImpactSummary";
import { getColorClass } from "@/core/calculations/impactService";
import { ManualFetchButton } from "@/features/debug/ManualFetchButton";
// import { DebugPanel } from "@/features/dashboard/DebugPanel";
import { mergeTransactions } from "@/core/plaid/transactionMapper";
import { useSampleData } from "@/features/debug/useSampleData";
import { DashboardLoading } from "@/features/dashboard/DashboardLoading";

// Determine if we're in development/sandbox mode
const isSandboxMode =
  process.env.NODE_ENV === "development" || config.plaid.isSandbox;

export default function Dashboard() {
  const [firebaseLoadingComplete, setFirebaseLoadingComplete] = useState(false);
  // const [showDebugPanel, setShowDebugPanel] = useState(false);

  // Authentication
  const { user, loading: authLoading, logout } = useAuth();

  // Bank connection
  const {
    connectionStatus,
    transactions,
    connectBank,
    disconnectBank,
    manuallyFetchTransactions,
  } = useBankConnection(user);

  // Transaction storage and analysis
  const {
    savedTransactions,
    isLoading: storageLoading,
    error: storageError,
    saveTransactions,
    hasSavedData,
    loadLatestTransactions,
    // resetStorage,
  } = useTransactionStorage(user);

  const { analyzedData, analysisStatus, analyzeTransactions } =
    useTransactionAnalysis(savedTransactions);

  // UI State
  const [activeView, setActiveView] = useState("grouped-impact");
  const [isConnecting, setIsConnecting] = useState(false);
  const [debugConnectionStatus, setDebugConnectionStatus] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Loading...");
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Sample data utility
  const { generateSampleTransactions } = useSampleData();

  // Effective connection status combines real status with debug status
  const effectiveConnectionStatus =
    connectionStatus.isConnected || debugConnectionStatus;

  // Display transactions from analyzed data or saved transactions
  const displayTransactions = useMemo(() => {
    // If we have both analyzed and saved data, merge them
    if (analyzedData?.transactions && savedTransactions) {
      return mergeTransactions(savedTransactions, analyzedData.transactions);
    }
    // Otherwise fallback to whichever exists
    return analyzedData?.transactions || savedTransactions || [];
  }, [analyzedData, savedTransactions]);

  // Use the new hook for impact analysis calculations
  const {
    impactAnalysis,
    applyCredit: applyCreditToDebt,
    isApplyingCredit,
    negativeCategories,
    positiveCategories,
  } = useImpactAnalysis(displayTransactions, user);

  // Determine if we have data to show
  const hasData = displayTransactions.length > 0;

  // Combined loading state
  const isLoading =
    connectionStatus.isLoading ||
    analysisStatus.status === "loading" ||
    storageLoading;

  // Combined error state
  const error =
    connectionStatus.error ||
    analysisStatus.error ||
    storageError ||
    fetchError;

  // Flag for when bank is connecting
  const bankConnecting = connectionStatus.isLoading || isConnecting;

  // Manual fetch handler with error handling
  const handleManualFetch = useCallback(async () => {
    setFetchError(null);
    try {
      await manuallyFetchTransactions();
    } catch (error) {
      console.error("Manual fetch error in dashboard:", error);
      setFetchError(
        error instanceof Error
          ? error.message
          : "Unknown error fetching transactions"
      );
    }
  }, [manuallyFetchTransactions]);

  // Handle loading sample data
  const handleLoadSampleData = useCallback(() => {
    const sampleTransactions = generateSampleTransactions();

    // Skip the bank connection process and go straight to analysis
    analyzeTransactions(sampleTransactions);

    // Set debug connection status
    setDebugConnectionStatus(true);
  }, [generateSampleTransactions, analyzeTransactions]);

  // Handle resetting transactions
  // const handleResetTransactions = useCallback(async () => {
  //   if (!user) return;

  //   try {
  //     // Reset the storage
  //     await resetStorage();

  //     // Clear the analyzed data
  //     analyzeTransactions([]);

  //     // Reset connection status
  //     setDebugConnectionStatus(false);

  //     // Force a page reload to clear all state
  //     window.location.reload();
  //   } catch (error) {
  //     console.error("Error resetting transactions:", error);
  //     alert("Failed to reset transactions. See console for details.");
  //   }
  // }, [user, resetStorage, analyzeTransactions]);

  // Handle Plaid success
  const handlePlaidSuccess = useCallback(
    async (publicToken: string | null) => {
      setIsConnecting(true);
      setLoadingMessage("Connecting to your bank...");

      try {
        if (publicToken) {
          await connectBank(publicToken);
        } else if (isSandboxMode) {
          // For sandbox/development, use sample data if no token
          handleLoadSampleData();
        }
      } catch (error) {
        console.error("Error connecting bank:", error);
      } finally {
        setIsConnecting(false);
      }
    },
    [connectBank, handleLoadSampleData]
  );

  // Load data from Firebase on mount
  useEffect(() => {
    if (user && !firebaseLoadingComplete && !hasSavedData && !storageLoading) {
      // Try to load from Firebase first
      loadLatestTransactions()
        .then(() => {
          setFirebaseLoadingComplete(true);
        })
        .catch((err) => {
          console.error("Firebase load failed:", err);
          setFirebaseLoadingComplete(true); // Mark as complete even on error
        });
    }
  }, [
    user,
    firebaseLoadingComplete,
    hasSavedData,
    storageLoading,
    loadLatestTransactions,
  ]);

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

  // Get the currently active view component
  const renderActiveView = () => {
    if (isLoading) {
      return <DashboardLoading message={loadingMessage} />;
    }

    const commonProps = {
      transactions: displayTransactions,
      totalSocietalDebt: impactAnalysis?.netSocietalDebt || 0,
      getColorClass,
    };

    switch (activeView) {
      case "premium-view":
        return (
          <PremiumTransactionView
            transactions={displayTransactions}
            impactAnalysis={impactAnalysis}
          />
        );
      case "transaction-table":
        return (
          <TransactionTableView
            transactions={displayTransactions}
            totalSocietalDebt={impactAnalysis?.netSocietalDebt || 0}
          />
        );
      case "balance-sheet":
        return <BalanceSheetView {...commonProps} />;
      case "vendor-breakdown":
        return <VendorBreakdownView {...commonProps} />;
      case "grouped-impact":
        return <GroupedImpactSummary {...commonProps} />;
      default:
        return <GroupedImpactSummary {...commonProps} />;
    }
  };

  // Handle loading states
  if (authLoading) {
    return (
      <div className="text-center mt-10">
        <DashboardLoading message="Checking authentication..." />
      </div>
    );
  }

  // Redirect if no user is found (handled by useAuth hook)
  if (!user) {
    return <div className="text-center mt-10">Redirecting to login...</div>;
  }

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

      {/* Main content area */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <DashboardSidebar
          impactAnalysis={impactAnalysis}
          activeView={activeView}
          onViewChange={setActiveView}
          onApplyCredit={applyCreditToDebt}
          creditState={null} // No longer needed with the improved hook
          isApplyingCredit={isApplyingCredit}
          hasTransactions={hasData}
          negativeCategories={negativeCategories}
          positiveCategories={positiveCategories}
        />

        {/* Main view content */}
        <div className="lg:col-span-3">
          {/* Bank Connection section (only show if not connected) */}
          {!effectiveConnectionStatus && (
            <div className="bg-white rounded-xl shadow-md p-6 mb-6">
              {isSandboxMode && <div className="mt-6"></div>}
              <h2 className="text-lg font-semibold text-blue-800 mb-2">
                Connect Your Bank
              </h2>
              <p className="text-gray-700 mb-4">
                Connect your bank account to analyze the ethical impact of your
                spending.
              </p>
              <PlaidConnectionSection
                onSuccess={handlePlaidSuccess}
                isConnected={effectiveConnectionStatus}
                isLoading={bankConnecting}
              />
            </div>
          )}

          {/* Manual Fetch Button - shown when connected but no data is visible */}
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
