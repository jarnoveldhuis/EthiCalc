// src/app/dashboard/page.tsx
"use client";

import { useCallback, useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTransactionStore } from "@/store/transactionStore";
import { ErrorAlert } from "@/shared/ui/ErrorAlert";
import { DashboardLayout } from "@/features/dashboard/DashboardLayout";
import { PlaidConnectionSection } from "@/features/banking/PlaidConnectionSection";
import { BalanceSheetView } from "@/features/dashboard/views/BalanceSheetView";
import { getColorClass } from "@/core/calculations/impactService";
import { ManualFetchButton } from "@/features/debug/ManualFetchButton";
import { DashboardSidebar } from "@/features/dashboard/DashboardSidebar";
import { DashboardLoading, DashboardEmptyState } from "@/features/dashboard/DashboardLoading";
import { useSampleData } from "@/features/debug/useSampleData";

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
    impactAnalysis,
    totalSocietalDebt,
    connectionStatus,
    connectBank,
    disconnectBank,
    manuallyFetchTransactions,
    analyzeTransactions,
    saveTransactions,
    loadLatestTransactions,
    hasSavedData,
    initializeStore
  } = useTransactionStore();
  
  // Sample data utility
  const { generateSampleTransactions } = useSampleData();
  
  // Derived/computed state
  const effectiveConnectionStatus: boolean = connectionStatus.isConnected;
  const isLoading: boolean = connectionStatus.isLoading || isConnecting;
  const error: string | null = connectionStatus.error || fetchError;
  const bankConnecting: boolean = connectionStatus.isLoading || isConnecting;
  const hasData: boolean = transactions.length > 0;
  
  // Initialize store when user changes
  useEffect(() => {
    // console.log("🔄 Dashboard: Auth state changed", { 
    //   user: user?.uid, 
    //   authLoading,
    //   hasData,
    //   isConnecting: connectionStatus.isLoading 
    // });
    
    if (user && !authLoading && !connectionStatus.isLoading) {
      // console.log("🔄 Dashboard: Starting store initialization");
      initializeStore(user).catch((err) => {
        console.error("❌ Dashboard: Store initialization failed:", err); // Keep this error log
        setFetchError(err instanceof Error ? err.message : "Failed to initialize dashboard");
      });
    }
  }, [user, authLoading, initializeStore]);
  
  // Handle loading sample data
  const handleLoadSampleData = useCallback(async () => {
    try {
      setLoadingMessage("Generating sample data...");
      const sampleTransactions = generateSampleTransactions();
      const totalDebt = sampleTransactions.reduce((sum, tx) => sum + (tx.societalDebt || 0), 0);
      
      // Save to Firestore if user is logged in
      if (user) {
        await saveTransactions(sampleTransactions, totalDebt, user.uid);
      }
      
      // Analyze the transactions
      await analyzeTransactions(sampleTransactions);
    } catch (error) {
      console.error("Error loading sample data:", error);
      setFetchError("Failed to load sample data");
    }
  }, [generateSampleTransactions, saveTransactions, analyzeTransactions, user]);
  
  // Handle Plaid success
  const handlePlaidSuccess = useCallback(async (publicToken: string | null) => {
    if (isConnecting) return; // Prevent multiple simultaneous connections
    
    setIsConnecting(true);
    setLoadingMessage("Connecting to your bank...");
    
    try {
      if (publicToken) {
        await connectBank(publicToken, user);
      } else {
        // For sample data when no token provided
        await handleLoadSampleData();
      }
    } catch (error) {
      console.error("Error connecting bank:", error);
      setFetchError(error instanceof Error ? error.message : "Unknown error connecting bank");
    } finally {
      setIsConnecting(false);
    }
  }, [connectBank, user, handleLoadSampleData, isConnecting]);
  
  // Manual fetch handler
  const handleManualFetch = useCallback(async () => {
    if (connectionStatus.isLoading) return; // Prevent multiple simultaneous fetches
    
    setFetchError(null);
    try {
      await manuallyFetchTransactions();
    } catch (error) {
      console.error("Manual fetch error:", error);
      setFetchError(error instanceof Error ? error.message : "Unknown error fetching transactions");
    }
  }, [manuallyFetchTransactions, connectionStatus.isLoading]);
  
  // Render based on loading state
  if (authLoading) {
    return <DashboardLoading message="Checking authentication..." />;
  }
  
  // Redirect handled by useAuth hook
  if (!user) {
    return <DashboardLoading message="Redirecting to login..." />;
  }
  
  // Render the view based on state
  const renderActiveView = () => {
    if (isLoading) {
      return <DashboardLoading message={loadingMessage} />;
    }
    
    if (!hasData) {
      return (
        <DashboardEmptyState 
          effectiveConnectionStatus={effectiveConnectionStatus}
          bankConnecting={bankConnecting}
          isConnecting={isConnecting}
        />
      );
    }
    
    // Common props for the view
    const viewProps = {
      transactions,
      totalSocietalDebt: impactAnalysis?.netSocietalDebt || totalSocietalDebt,
      getColorClass
    };
    
    // Return the balance sheet view
    return <BalanceSheetView {...viewProps} />;
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
          {/* Now we pass almost no props since everything is in the store */}
          <DashboardSidebar />
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