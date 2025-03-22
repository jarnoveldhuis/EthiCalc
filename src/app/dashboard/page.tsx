// Update to your src/app/dashboard/page.tsx
"use client";

import { useCallback, useState, useEffect, useMemo } from "react";
import { useAuth } from "@/shared/hooks/useAuth";
import { useBankConnection } from "@/features/banking/useBankConnection";
import { useTransactionStorage } from "@/features/analysis/useTransactionStorage";
import { useTransactionAnalysis } from "@/features/analysis/useTransactionAnalysis";
import { ErrorAlert } from "@/shared/components/ui/ErrorAlert";
import { config } from "@/config";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { GroupedImpactSummary } from "@/features/analysis/GroupedImpactSummary";
import { PlaidConnectionSection } from "@/features/banking/PlaidConnectionSection";
import { TransactionList } from "@/features/analysis/TransactionList";
import { ConsolidatedImpactView } from "@/features/analysis/ConsolidatedImpactView";
import { CategoryExperimentView } from "@/features/analysis/CategoryExperimentView";
import { PracticeDebtTable } from "@/features/analysis/PracticeDebtTable";
import { useSampleData } from "@/features/debug/useSampleData";
import { ManualFetchButton } from "@/features/debug/ManualFetchButton";
import { mergeTransactions } from "@/features/banking/transactionMapper";
import { useCreditState } from "@/features/analysis/useCreditState";

// Utility functions
import {
  calculatePracticeDonations,
  calculatePositiveAmount,
  calculateNegativeAmount,
  calculateNegativeCategories,
  getColorClass,
} from "@/features/dashboard/dashboardUtils";

// Loading components
import { DashboardLoading } from "@/features/dashboard/DashboardLoading";

// Determine if we're in development/sandbox mode
const isSandboxMode =
  process.env.NODE_ENV === "development" || config.plaid.isSandbox;

export default function Dashboard() {
  const [firebaseLoadingComplete, setFirebaseLoadingComplete] = useState(false);

  // Authentication
  const { user, loading: authLoading, logout } = useAuth();

  // Bank connection
  const {
    connectionStatus,
    transactions,
    connectBank,
    disconnectBank,
    manuallyFetchTransactions,
  } = useBankConnection(user, firebaseLoadingComplete);

  // Transaction storage and analysis
  const {
    savedTransactions,
    totalSocietalDebt,
    isLoading: storageLoading,
    error: storageError,
    saveTransactions,
    hasSavedData,
    loadLatestTransactions,
  } = useTransactionStorage(user);

  const {
    creditState,
    error: creditError,
    applyCredit,
    calculateAvailableCredit,
    refreshCreditState,
  } = useCreditState(user);

  const { analyzedData, analysisStatus, analyzeTransactions } =
    useTransactionAnalysis(savedTransactions);

  // UI State
  const [activeView, setActiveView] = useState("transactions");
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

  // Derived data for the UI
  const practiceDonations = calculatePracticeDonations(displayTransactions);
  const negativeAmount = calculateNegativeAmount(displayTransactions);
  const negativeCategories = calculateNegativeCategories(displayTransactions);

  // Determine if we have data to show
  const hasData = displayTransactions.length > 0;

  // Add state for tracking credit application
  const [isApplyingCredit, setIsApplyingCredit] = useState(false);

  // Calculate positive impact with consideration for already applied credit
  const positiveImpact = useMemo(() => {
    if (!hasData) return 0;

    // If we have credit state, use the hook's calculation
    if (creditState) {
      return calculateAvailableCredit(displayTransactions);
    }

    // Fallback to the original calculation
    return calculatePositiveAmount(displayTransactions);
  }, [hasData, displayTransactions, creditState, calculateAvailableCredit]);

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

  // Apply a credit to reduce societal debt
  const applyCreditToDebt = useCallback(
    async (amount: number): Promise<boolean> => {
      if (!user || amount <= 0) {
        return false;
      }

      setIsApplyingCredit(true);

      try {
        // Apply credit using our new hook
        const success = await applyCredit(amount);

        if (success) {
          // Refresh credit state after successful application
          await refreshCreditState();
          return true;
        }

        return false;
      } catch (error) {
        console.error(`Error applying credit: ${error}`);
        return false;
      } finally {
        setIsApplyingCredit(false);
      }
    },
    [user, applyCredit, refreshCreditState]
  );

  useEffect(() => {
    if (user && !firebaseLoadingComplete && !hasSavedData && !storageLoading) {
      // Try to load from Firebase first
      loadLatestTransactions()
        .then((hasData) => {
          console.log(`Firebase load complete, found data: ${hasData}`);
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

  useEffect(() => {
    if (creditError) {
      setFetchError(creditError);
    }
  }, [creditError]);

  useEffect(() => {
    console.log("Save effect evaluation:", {
      hasUser: !!user,
      hasAnalyzedData: !!analyzedData,
      analyzedCount: analyzedData?.transactions?.length || 0,
      savedCount: savedTransactions?.length || 0,
      hasSavedData,
    });

    if (user && analyzedData && analyzedData.transactions.length > 0) {
      // Use the existing transactions or an empty array if none exist
      const existingTx = savedTransactions || [];
      const newTx = analyzedData.transactions;

      // Use your existing merge function to combine them
      const mergedTransactions = mergeTransactions(existingTx, newTx);

      // Only save if we actually have new transactions
      if (mergedTransactions.length > existingTx.length) {
        console.log(
          `SAVING MERGED TRANSACTIONS: ${existingTx.length} existing + ${newTx.length} new = ${mergedTransactions.length} total`
        );

        saveTransactions(mergedTransactions, analyzedData.totalSocietalDebt);
      } else {
        console.log("No new transactions to save after merging");
      }
    }
  }, [user, analyzedData, savedTransactions, saveTransactions, hasSavedData]);

  // Effect to analyze transactions from the bank connection
  useEffect(() => {
    if (transactions && transactions.length > 0 && !analyzedData) {
      console.log(
        `Analyzing ${transactions.length} transactions from bank connection`
      );
      analyzeTransactions(transactions);
    }
  }, [transactions, analyzedData, analyzeTransactions]);

  // Get the currently active view component
  const renderActiveView = () => {
    if (isLoading) {
      return <DashboardLoading message={loadingMessage} />;
    }
  
    if (!hasData) {
      // Show empty state message instead of sidebar
      return (
        <div className="text-center p-8 bg-white rounded-xl shadow">
          <h3 className="text-xl font-bold text-gray-700 mb-3">No Transaction Data</h3>
          <p className="text-gray-600 mb-4">
            Connect your bank account or load sample data to see your societal debt analysis.
          </p>
        </div>
      );
    }
  
    // Render appropriate view based on active tab
    switch (activeView) {
      case "impact":
        return (
          <ConsolidatedImpactView
            transactions={displayTransactions}
            totalSocietalDebt={totalSocietalDebt}
          />
        );
      case "categories":
        return (
          <CategoryExperimentView
            transactions={displayTransactions}
            totalSocietalDebt={totalSocietalDebt}
          />
        );
      case "practices":
        return (
          <PracticeDebtTable
            practiceDonations={practiceDonations}
            transactions={displayTransactions}
            totalSocietalDebt={totalSocietalDebt}
          />
        );
      case "grouped-impact":
        return (
          <GroupedImpactSummary
            transactions={displayTransactions}
            totalSocietalDebt={totalSocietalDebt}
          />
        );
      case "transactions":
      default:
        return (
          <TransactionList
            transactions={displayTransactions}
            getColorClass={getColorClass}
          />
        );
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
          user={user}
          activeView={activeView}
          onViewChange={setActiveView}
          totalSocietalDebt={totalSocietalDebt}
          offsetsThisMonth={negativeAmount}
          positiveImpact={positiveImpact}
          topNegativeCategories={negativeCategories}
          hasTransactions={hasData}
          onApplyCredit={applyCreditToDebt}
          creditState={creditState}
          isApplyingCredit={isApplyingCredit}
        />

        {/* Main content */}
        <div className="lg:col-span-3 space-y-6">
          {/* Bank Connection Section - Only shown when not connected */}
          {!effectiveConnectionStatus && (
            <div className="bg-white rounded-xl shadow-md p-6">
              <h2 className="text-lg font-semibold text-blue-800 mb-2">
                Connect Your Bank
              </h2>
              <p className="text-sm text-blue-700 mb-4">
                Connect your bank account to analyze your transactions and
                calculate your societal debt.
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
