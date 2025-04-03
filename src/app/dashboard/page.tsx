// src/app/dashboard/page.tsx
"use client";

import React, { useCallback, useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
// Import TransactionState type along with the store hook
import { useTransactionStore } from "@/store/transactionStore";
import { ErrorAlert } from "@/shared/ui/ErrorAlert";
import { DashboardLayout } from "@/features/dashboard/DashboardLayout";
import { PlaidConnectionSection } from "@/features/banking/PlaidConnectionSection";
import { BalanceSheetView } from "@/features/dashboard/views/BalanceSheetView";
import { ManualFetchButton } from "@/features/debug/ManualFetchButton";
import { DashboardSidebar } from "@/features/dashboard/DashboardSidebar";
import { DashboardLoading, DashboardEmptyState } from "@/features/dashboard/DashboardLoading";
import { useSampleData } from "@/features/debug/useSampleData"; // Verify this path

// // Helper function - Uses imported TransactionState type
// const isAnyLoading = (state: TransactionState): boolean => {
//     // Include all relevant loading flags
//     return state.isInitializing || state.isConnectingBank || state.isFetchingTransactions ||
//            state.isAnalyzing || state.isSaving || state.isApplyingCredit ||
//            state.isLoadingLatest || state.isLoadingCreditState;
// };

export default function Dashboard() {
  const [isPlaidConnecting, setIsPlaidConnecting] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>("Loading dashboard...");
  const { user, loading: authLoading, logout } = useAuth();
  // Select the full impactAnalysis object
  const impactAnalysis = useTransactionStore(state => state.impactAnalysis);
  // Safely get effectiveDebt, defaulting to 0 if analysis isn't ready
  const effectiveDebt = impactAnalysis?.effectiveDebt ?? 0;
  // Destructure state and actions from store
  const {
    transactions,
    connectionStatus,
    isInitializing, isConnectingBank, isFetchingTransactions, isAnalyzing,
    isLoadingLatest, isLoadingCreditState, isSaving, isApplyingCredit, // Destructure all loading flags
    connectBank, disconnectBank, manuallyFetchTransactions,
    analyzeTransactions, saveTransactions, initializeStore
  } = useTransactionStore();

  const { generateSampleTransactions } = useSampleData(); // Ensure this is exported

  // Refs for initialization guard
  const hasInitialized = useRef(false);
  const currentUserId = useRef<string | null>(null);

  // Combined Loading State Calculation
  const isOverallLoading = authLoading || isInitializing || isConnectingBank || isFetchingTransactions || isAnalyzing || isLoadingLatest || isLoadingCreditState || isSaving || isApplyingCredit;
  useEffect(() => {
      if (authLoading) setLoadingMessage("Authenticating...");
      else if (isInitializing) setLoadingMessage("Initializing data...");
      else if (isConnectingBank) setLoadingMessage("Connecting bank account...");
      else if (isFetchingTransactions) setLoadingMessage("Fetching transactions...");
      else if (isLoadingLatest) setLoadingMessage("Loading saved data...");
      else if (isLoadingCreditState) setLoadingMessage("Loading credit state...");
      else if (isAnalyzing) setLoadingMessage("Analyzing impact...");
      else if (isSaving) setLoadingMessage("Saving data...");
      else if (isApplyingCredit) setLoadingMessage("Applying Credit...");
      else setLoadingMessage("Loading dashboard...");
  }, [authLoading, isInitializing, isConnectingBank, isFetchingTransactions, isLoadingLatest, isLoadingCreditState, isAnalyzing, isSaving, isApplyingCredit]);


  // Other derived state
  const effectiveConnectionStatus: boolean = connectionStatus.isConnected;
  const error: string | null = connectionStatus.error;
  const hasData: boolean = transactions.length > 0;

  // Initialize store effect - WITH GUARD
  useEffect(() => {
    console.log(`Dashboard Effect Triggered: user=${user?.uid}, authLoading=${authLoading}, hasInitialized=${hasInitialized.current}`);
    if (!user || (currentUserId.current && user.uid !== currentUserId.current)) {
        console.log("Dashboard Effect: User logged out or changed, resetting init guard.");
        hasInitialized.current = false;
        currentUserId.current = user?.uid ?? null;
    }
    if (user && !authLoading && !hasInitialized.current) {
        const currentlyLoading = isInitializing || isConnectingBank || isFetchingTransactions || isAnalyzing || isLoadingLatest || isLoadingCreditState || isSaving || isApplyingCredit;
        if (currentlyLoading) {
             console.log("Dashboard Effect: Skipping initialization call - an operation is already in progress.");
             return;
        }
        console.log(`Dashboard Effect: Conditions met for initialization (User: ${user.uid}). Setting guard and calling initializeStore.`);
        hasInitialized.current = true;
        currentUserId.current = user.uid;
        initializeStore(user).catch((err) => { console.error("Dashboard Effect: initializeStore promise rejected", err); });
    }
  // Include necessary dependencies for the loading check inside the effect
  }, [user, authLoading, initializeStore, isInitializing, isConnectingBank, isFetchingTransactions, isAnalyzing, isLoadingLatest, isLoadingCreditState, isSaving, isApplyingCredit]);


  // --- Callbacks with FULL Dependency Arrays ---
  const handleLoadSampleData = useCallback(async () => {
     const loadingCheck = isInitializing || isConnectingBank || isFetchingTransactions || isAnalyzing || isLoadingLatest || isLoadingCreditState || isSaving || isApplyingCredit;
     if (loadingCheck) { console.log("handleLoadSampleData: Skipping..."); return; }
     setIsPlaidConnecting(true); setLoadingMessage("Generating sample data...");
     try {
       const sampleTxs = generateSampleTransactions();
       const analysisResult = await analyzeTransactions(sampleTxs);
       if (user && analysisResult && analysisResult.transactions) {
         await saveTransactions(analysisResult.transactions, analysisResult.totalNegativeImpact, user.uid);
       }
     } catch (error) { console.error("Error loading sample data:", error); }
     finally { setIsPlaidConnecting(false); }
   // Dependencies for handleLoadSampleData
   }, [generateSampleTransactions, analyzeTransactions, saveTransactions, user, isInitializing, isConnectingBank, isFetchingTransactions, isAnalyzing, isLoadingLatest, isLoadingCreditState, isSaving, isApplyingCredit]);

  const handlePlaidSuccess = useCallback(async (publicToken: string | null) => {
      const loadingCheck = isInitializing || isConnectingBank || isFetchingTransactions || isAnalyzing || isLoadingLatest || isLoadingCreditState || isSaving || isApplyingCredit || isPlaidConnecting;
     if (loadingCheck) { console.log("handlePlaidSuccess: Skipping..."); return; }
     setIsPlaidConnecting(true); setLoadingMessage("Connecting bank account...");
     try {
       if (publicToken) { await connectBank(publicToken, user); }
       else { await handleLoadSampleData(); } // Depends on handleLoadSampleData
     } catch (error) { console.error("Error in handlePlaidSuccess flow:", error); }
     finally { setIsPlaidConnecting(false); }
   // Dependencies for handlePlaidSuccess
   }, [connectBank, user, handleLoadSampleData, isPlaidConnecting, isInitializing, isConnectingBank, isFetchingTransactions, isAnalyzing, isLoadingLatest, isLoadingCreditState, isSaving, isApplyingCredit]);

  const handleManualFetch = useCallback(async () => {
     const loadingCheck = isInitializing || isConnectingBank || isFetchingTransactions || isAnalyzing || isLoadingLatest || isLoadingCreditState || isSaving || isApplyingCredit;
     if (loadingCheck) { console.log("handleManualFetch: Skipping..."); return; }
     try { await manuallyFetchTransactions(); }
     catch (error) { console.error("Manual fetch failed:", error); } // Errors should be set in store actions
   // Dependencies for handleManualFetch
   }, [manuallyFetchTransactions, isInitializing, isConnectingBank, isFetchingTransactions, isAnalyzing, isLoadingLatest, isLoadingCreditState, isSaving, isApplyingCredit]);
   // --- End Callbacks ---

  // --- Render Logic ---
  if (authLoading) { return <DashboardLoading message="Checking authentication..." />; }
  if (!user) { return <DashboardLoading message="Redirecting to login..." />; }

  const renderContent = () => {
    const displayLoadingMessage = authLoading ? "Authenticating..." : loadingMessage;
    if (isOverallLoading && !hasData) {
        return <DashboardLoading message={displayLoadingMessage} />;
    }
    if (!hasData && !isOverallLoading) {
      return ( /* No Data / Connect Bank Section */
        <>
          {!effectiveConnectionStatus && (
            <div className="card p-6 mb-6">
              <h2 className="text-lg font-semibold text-blue-800 dark:text-blue-300 mb-2"> Connect Your Bank </h2>
              <p className="text-[var(--card-foreground)] opacity-80 mb-4"> Connect your bank account to analyze the ethical impact of your spending. </p>
              <PlaidConnectionSection onSuccess={handlePlaidSuccess} isConnected={false} isLoading={isPlaidConnecting} />
            </div>
          )}
          {effectiveConnectionStatus && ( <DashboardEmptyState effectiveConnectionStatus={true} bankConnecting={isConnectingBank} isConnecting={isPlaidConnecting} /> )}
          {effectiveConnectionStatus && !isOverallLoading && ( <ManualFetchButton onFetch={handleManualFetch} className="mt-6" showAfterTimeout={8000} /> )}
        </>
      );
    }
    // Data Available State
    return ( <div className="card overflow-visible"> <BalanceSheetView transactions={transactions} /> </div> );
  };

  // Main Layout
  return (
    <DashboardLayout user={user} onLogout={logout} onDisconnectBank={disconnectBank } isBankConnected={effectiveConnectionStatus} effectiveDebt={effectiveDebt}>
      {error && <ErrorAlert message={error} />}
      {/* Outer Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Column */}
        <div className="lg:col-span-1">
          <DashboardSidebar />
        </div>
        {/* Main Content Column */}
        <div className="lg:col-span-3">
           {renderContent()}
        </div>
      </div>
    </DashboardLayout>
  );
}