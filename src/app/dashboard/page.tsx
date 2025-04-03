// src/app/dashboard/page.tsx
"use client";

import { useCallback, useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTransactionStore } from "@/store/transactionStore";
import { ErrorAlert } from "@/shared/ui/ErrorAlert"; // Ensure this is imported
import { DashboardLayout } from "@/features/dashboard/DashboardLayout";
import { PlaidConnectionSection } from "@/features/banking/PlaidConnectionSection";
import { BalanceSheetView } from "@/features/dashboard/views/BalanceSheetView";
// Removed unused import: import { getColorClass } from "@/core/calculations/impactService";
import { ManualFetchButton } from "@/features/debug/ManualFetchButton";
import { DashboardSidebar } from "@/features/dashboard/DashboardSidebar";
import { DashboardLoading, DashboardEmptyState } from "@/features/dashboard/DashboardLoading";
import { useSampleData } from "@/features/debug/useSampleData";
import { AnalyzedTransactionData } from "@/shared/types/transactions"; // Import the type

export default function Dashboard() {
  // Core state - moved to Zustand
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>("Loading your dashboard...");
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Auth hook
  const { user, loading: authLoading, logout } = useAuth();

  // Zustand store
  const {
    transactions,
    connectionStatus,
    connectBank,
    disconnectBank,
    manuallyFetchTransactions,
    analyzeTransactions, // This should return Promise<AnalyzedTransactionData> now
    saveTransactions,
    initializeStore
  } = useTransactionStore();

  // Sample data utility
  const { generateSampleTransactions } = useSampleData();

  // Derived/computed state
  const effectiveConnectionStatus: boolean = connectionStatus.isConnected;
  const isLoading: boolean = authLoading || connectionStatus.isLoading || isConnecting;
  const error: string | null = connectionStatus.error || fetchError;
  const bankConnecting: boolean = connectionStatus.isLoading || isConnecting;
  const hasData: boolean = transactions.length > 0;

  // Initialize store when user changes and auth is resolved
  useEffect(() => {
    // Added connectionStatus.isLoading to dependencies
    if (user && !authLoading && !connectionStatus.isLoading) {
      setLoadingMessage("Initializing data...");
      initializeStore(user).catch((err) => {
        console.error("❌ Dashboard: Store initialization failed:", err);
        setFetchError(err instanceof Error ? err.message : "Failed to initialize dashboard");
      });
    }
     // Added connectionStatus.isLoading as per linter warning
  }, [user, authLoading, connectionStatus.isLoading, initializeStore]);


  // Handle loading sample data
  const handleLoadSampleData = useCallback(async () => {
    if (isLoading) return;
    setIsConnecting(true);
    setLoadingMessage("Generating sample data...");
    setFetchError(null);
    try {
      const sampleTransactions = generateSampleTransactions();
      // Call analyzeTransactions from the store, expecting AnalyzedTransactionData
      const analysisResult: AnalyzedTransactionData = await analyzeTransactions(sampleTransactions); // Explicitly type result

      // Save to Firestore if user is logged in, using the correct properties
      if (user && analysisResult) {
         // Pass the total NEGATIVE impact component to saveTransactions
        await saveTransactions(analysisResult.transactions, analysisResult.totalNegativeImpact, user.uid);
      }
      // State update happens within analyzeTransactions now

    } catch (error) {
      console.error("Error loading sample data:", error);
      setFetchError(error instanceof Error ? error.message : "Failed to load sample data");
    } finally {
      setIsConnecting(false);
    }
  }, [isLoading, generateSampleTransactions, analyzeTransactions, saveTransactions, user]);

  // Handle Plaid success
  const handlePlaidSuccess = useCallback(async (publicToken: string | null) => {
    if (isConnecting || connectionStatus.isLoading) return;

    setIsConnecting(true);
    setLoadingMessage("Connecting to your bank...");
    setFetchError(null);

    try {
      if (publicToken) {
        await connectBank(publicToken, user);
      } else {
        await handleLoadSampleData();
      }
    } catch (error) {
      console.error("Error connecting bank:", error);
      setFetchError(error instanceof Error ? error.message : "Unknown error connecting bank");
    } finally {
      setIsConnecting(false);
    }
  }, [connectBank, user, handleLoadSampleData, isConnecting, connectionStatus.isLoading]);

  // Manual fetch handler
  const handleManualFetch = useCallback(async () => {
    if (connectionStatus.isLoading) return;

    setFetchError(null);
    try {
      await manuallyFetchTransactions();
    } catch (error) {
      console.error("Manual fetch error:", error);
      setFetchError(error instanceof Error ? error.message : "Unknown error fetching transactions");
    }
  }, [manuallyFetchTransactions, connectionStatus.isLoading]);

  // --- Render Logic ---
  if (authLoading) {
    return <DashboardLoading message="Checking authentication..." />;
  }
  if (!user) {
    return <DashboardLoading message="Redirecting to login..." />;
  }

  const renderContent = () => {
    if (isLoading && !hasData) {
        return <DashboardLoading message={loadingMessage} />;
    }
    if (!hasData && !isLoading) {
      return (
        <>
          {!effectiveConnectionStatus && (
            <div className="card p-6 mb-6">
              <h2 className="text-lg font-semibold text-blue-800 dark:text-blue-300 mb-2"> Connect Your Bank </h2>
              <p className="text-[var(--card-foreground)] opacity-80 mb-4"> Connect your bank account to analyze the ethical impact of your spending. </p>
              <PlaidConnectionSection onSuccess={handlePlaidSuccess} isConnected={false} isLoading={bankConnecting} />
            </div>
          )}
          {effectiveConnectionStatus && ( <DashboardEmptyState effectiveConnectionStatus={true} bankConnecting={false} isConnecting={false} /> )}
          {effectiveConnectionStatus && ( <ManualFetchButton onFetch={handleManualFetch} className="mt-6" showAfterTimeout={8000} /> )}
        </>
      );
    }
    return (
      <div className="card overflow-visible">
         <BalanceSheetView transactions={transactions} />
      </div>
    );
  };

  // Main Layout
  return (
    <DashboardLayout
      user={user}
      onLogout={logout}
      onDisconnectBank={disconnectBank}
      isBankConnected={effectiveConnectionStatus}
    >
      {error && <ErrorAlert message={error} />}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1"> <DashboardSidebar /> </div>
        <div className="lg:col-span-3"> {renderContent()} </div>
      </div>
    </DashboardLayout>
  );
}