// src/app/dashboard/page.tsx
"use client";

import { useCallback, useState, useEffect } from "react";
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

// Utility functions
import { 
  calculatePracticeDonations,
  calculatePositiveAmount,
  calculateNegativeAmount,
  calculateNegativeCategories,
  getColorClass
} from "@/features/dashboard/dashboardUtils";

// Loading components
import { 
  DashboardLoading, 
  DashboardEmptyState 
} from "@/features/dashboard/DashboardLoading";

// Determine if we're in development/sandbox mode
const isSandboxMode =
  process.env.NODE_ENV === "development" || config.plaid.isSandbox;

export default function Dashboard() {
  // Authentication
  const { user, loading: authLoading, logout } = useAuth();
  
  // Bank connection
  const { 
    connectionStatus, 
    connectBank, 
    disconnectBank 
  } = useBankConnection(user);
  
  // Transaction storage and analysis
  const {
    savedTransactions,
    totalSocietalDebt,
    isLoading: storageLoading,
    error: storageError,
    saveTransactions,
    hasSavedData
  } = useTransactionStorage(user);
  
  const {
    analyzedData,
    analysisStatus,
    analyzeTransactions
  } = useTransactionAnalysis();
  
  // UI State
  const [activeView, setActiveView] = useState("transactions");
  const [isConnecting, setIsConnecting] = useState(false);
  const [debugConnectionStatus, setDebugConnectionStatus] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Loading...");
  
  // Sample data utility
  const { generateSampleTransactions } = useSampleData();
  
  // Effective connection status combines real status with debug status
  const effectiveConnectionStatus = connectionStatus.isConnected || debugConnectionStatus;
  
  // Display transactions from analyzed data or saved transactions
  const displayTransactions = analyzedData?.transactions || savedTransactions || [];
  
  // Derived data for the UI
  const practiceDonations = calculatePracticeDonations(displayTransactions);
  const positiveAmount = calculatePositiveAmount(displayTransactions);
  const negativeAmount = calculateNegativeAmount(displayTransactions);
  const negativeCategories = calculateNegativeCategories(displayTransactions);
  
  // Determine if we have data to show
  const hasData = displayTransactions.length > 0;
  
  // Combined loading state
  const isLoading = 
    connectionStatus.isLoading || 
    analysisStatus.status === 'loading' || 
    storageLoading;
  
  // Combined error state
  const error = connectionStatus.error || analysisStatus.error || storageError;
  
  // Flag for when bank is connecting
  const bankConnecting = connectionStatus.isLoading || isConnecting;
  
  // Handle loading sample data
  const handleLoadSampleData = useCallback(() => {
    const sampleTransactions = generateSampleTransactions();
    
    // Skip the bank connection process and go straight to analysis
    analyzeTransactions(sampleTransactions);
    
    // Set debug connection status
    setDebugConnectionStatus(true);
  }, [generateSampleTransactions, analyzeTransactions]);
  
  // Handle Plaid success
  const handlePlaidSuccess = useCallback(async (publicToken: string | null) => {
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
  }, [connectBank, handleLoadSampleData]);
  
  // Apply a credit to reduce societal debt
  const applyCreditToDebt = useCallback(async (amount: number): Promise<void> => {
    // This would be implemented with actual credit application logic
    console.log(`Applied ${amount} credit to societal debt`);
    // In a real implementation, you would update the debt value
    
    // Simulate an async operation
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        resolve();
      }, 500);
    });
  }, []);
  
  // Save analyzed transactions to storage
  useEffect(() => {
    if (
      user && 
      analyzedData && 
      analyzedData.transactions.length > 0 && 
      !hasSavedData
    ) {
      saveTransactions(
        analyzedData.transactions,
        analyzedData.totalSocietalDebt
      );
    }
  }, [user, analyzedData, hasSavedData, saveTransactions]);
  
  // Get the currently active view component
  const renderActiveView = () => {
    if (isLoading) {
      return <DashboardLoading message={loadingMessage} />;
    }

    if (!hasData) {
      return (
        <DashboardEmptyState 
          effectiveConnectionStatus={effectiveConnectionStatus}
          // onDisconnectBank={disconnectBank}
          bankConnecting={bankConnecting}
          isConnecting={isConnecting}
        />
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
          positiveImpact={positiveAmount}
          topNegativeCategories={negativeCategories}
          hasTransactions={hasData}
          onApplyCredit={applyCreditToDebt}
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

          {/* Main view content */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            {renderActiveView()}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}