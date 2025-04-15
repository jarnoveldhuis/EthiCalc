// src/app/dashboard/page.tsx
"use client";

import React, { useCallback, useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
// FIX: Removed unused TransactionState import
import { useTransactionStore } from "@/store/transactionStore";
import { ErrorAlert } from "@/shared/ui/ErrorAlert";
import { DashboardLayout } from "@/features/dashboard/DashboardLayout";
import { PlaidConnectionSection } from "@/features/banking/PlaidConnectionSection";
import { BalanceSheetView } from "@/features/dashboard/views/BalanceSheetView";
import { ManualFetchButton } from "@/features/debug/ManualFetchButton";
import { DashboardSidebar } from "@/features/dashboard/DashboardSidebar";
import { DashboardLoading, DashboardEmptyState } from "@/features/dashboard/DashboardLoading";
import { useSampleData } from "@/features/debug/useSampleData";

export default function Dashboard() {
  const [isPlaidConnecting, setIsPlaidConnecting] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>("Loading dashboard...");
  const { user, loading: authLoading, logout } = useAuth();
  const impactAnalysis = useTransactionStore(state => state.impactAnalysis);
  const effectiveDebt = impactAnalysis?.effectiveDebt ?? 0;

  // Destructure actions from the store (unchanged from previous fix)
  const {
    transactions,
    connectionStatus,
    isInitializing, isConnectingBank, isFetchingTransactions, isAnalyzing,
    isLoadingLatest, isLoadingCreditState, isSaving, isApplyingCredit, isSavingCache,
    connectBank, disconnectBank, manuallyFetchTransactions,
    analyzeAndCacheTransactions,
    initializeStore
  } = useTransactionStore();

  const { generateSampleTransactions } = useSampleData();

  const hasInitialized = useRef(false);
  const currentUserId = useRef<string | null>(null);

  // Updated loading state check (unchanged)
  const isOverallLoading = authLoading || isInitializing || isConnectingBank || isFetchingTransactions || isAnalyzing || isLoadingLatest || isLoadingCreditState || isSaving || isApplyingCredit || isSavingCache;
  useEffect(() => {
      if (authLoading) setLoadingMessage("Authenticating...");
      else if (isInitializing) setLoadingMessage("Initializing data...");
      else if (isConnectingBank) setLoadingMessage("Connecting bank account...");
      else if (isFetchingTransactions) setLoadingMessage("Fetching transactions...");
      else if (isLoadingLatest) setLoadingMessage("Loading saved data...");
      else if (isLoadingCreditState) setLoadingMessage("Loading credit state...");
      else if (isAnalyzing) setLoadingMessage("Analyzing impact...");
      else if (isSavingCache) setLoadingMessage("Updating vendor cache...");
      else if (isSaving) setLoadingMessage("Saving data...");
      else if (isApplyingCredit) setLoadingMessage("Applying Credit...");
      else setLoadingMessage("Loading dashboard...");
  }, [authLoading, isInitializing, isConnectingBank, isFetchingTransactions, isLoadingLatest, isLoadingCreditState, isAnalyzing, isSaving, isApplyingCredit, isSavingCache]);


  const effectiveConnectionStatus: boolean = connectionStatus.isConnected;
  const error: string | null = connectionStatus.error;
  const hasData: boolean = transactions.length > 0;

  // Initialize store effect (unchanged)
  useEffect(() => {
    console.log(`Dashboard Effect Triggered: user=${user?.uid}, authLoading=${authLoading}, hasInitialized=${hasInitialized.current}`);
    if (!user || (currentUserId.current && user.uid !== currentUserId.current)) {
        console.log("Dashboard Effect: User changed/logged out, resetting init guard.");
        hasInitialized.current = false;
        currentUserId.current = user?.uid ?? null;
    }

    if (user && !authLoading && !hasInitialized.current) {
         const currentlyLoading = isInitializing || isConnectingBank || isFetchingTransactions || isAnalyzing || isLoadingLatest || isLoadingCreditState || isSaving || isApplyingCredit || isSavingCache;
        if (currentlyLoading) {
             console.log("Dashboard Effect: Skipping initialization - an operation is already in progress.");
             return;
        }
        console.log(`Dashboard Effect: Conditions met for initialization (User: ${user.uid}). Setting guard and calling initializeStore.`);
        hasInitialized.current = true;
        currentUserId.current = user.uid;
        initializeStore(user).catch((err) => {
             console.error("Dashboard Effect: initializeStore promise rejected", err);
        });
    }
  }, [user, authLoading, initializeStore, isInitializing, isConnectingBank, isFetchingTransactions, isAnalyzing, isLoadingLatest, isLoadingCreditState, isSaving, isApplyingCredit, isSavingCache]);


  // --- Callbacks (unchanged from previous fix) ---
  const handleLoadSampleData = useCallback(async () => {
     const loadingCheck = isInitializing || isConnectingBank || isFetchingTransactions || isAnalyzing || isLoadingLatest || isLoadingCreditState || isSaving || isApplyingCredit || isSavingCache;
     if (loadingCheck) { console.log("handleLoadSampleData: Skipping (loading)..."); return; }
     setIsPlaidConnecting(true);
     setLoadingMessage("Generating & Analyzing sample data...");
     try {
       const sampleTxs = generateSampleTransactions();
       await analyzeAndCacheTransactions(sampleTxs);
       console.log("Sample data analyzed and loaded into store state.");
     } catch (error) { console.error("Error loading/analyzing sample data:", error); }
     finally { setIsPlaidConnecting(false); setLoadingMessage("Loading dashboard..."); }
   }, [generateSampleTransactions, analyzeAndCacheTransactions, isInitializing, isConnectingBank, isFetchingTransactions, isAnalyzing, isLoadingLatest, isLoadingCreditState, isSaving, isApplyingCredit, isSavingCache]);

  const handlePlaidSuccess = useCallback(async (publicToken: string | null) => {
      const loadingCheck = isInitializing || isConnectingBank || isFetchingTransactions || isAnalyzing || isLoadingLatest || isLoadingCreditState || isSaving || isApplyingCredit || isSavingCache || isPlaidConnecting;
     if (loadingCheck) { console.log("handlePlaidSuccess: Skipping (loading)..."); return; }
     setIsPlaidConnecting(true); setLoadingMessage("Connecting bank account...");
     try {
       if (publicToken && user) {
           await connectBank(publicToken, user);
        }
       else {
           await handleLoadSampleData();
        }
     } catch (error) { console.error("Error in handlePlaidSuccess flow:", error); }
     finally { setIsPlaidConnecting(false); setLoadingMessage("Loading dashboard..."); }
   }, [connectBank, user, handleLoadSampleData, isPlaidConnecting, isInitializing, isConnectingBank, isFetchingTransactions, isAnalyzing, isLoadingLatest, isLoadingCreditState, isSaving, isApplyingCredit, isSavingCache]);

  const handleManualFetch = useCallback(async () => {
     const loadingCheck = isInitializing || isConnectingBank || isFetchingTransactions || isAnalyzing || isLoadingLatest || isLoadingCreditState || isSaving || isApplyingCredit || isSavingCache;
     if (loadingCheck) { console.log("handleManualFetch: Skipping (loading)..."); return; }
     try {
         await manuallyFetchTransactions();
    }
     catch (error) { console.error("Manual fetch failed:", error); }
   }, [manuallyFetchTransactions, isInitializing, isConnectingBank, isFetchingTransactions, isAnalyzing, isLoadingLatest, isLoadingCreditState, isSaving, isApplyingCredit, isSavingCache]);
   // --- End Callbacks ---

  // --- Render Logic (unchanged) ---
  if (authLoading) { return <DashboardLoading message="Checking authentication..." />; }
  if (!user) { return <DashboardLoading message="Redirecting to login..." />; }

  const renderContent = () => {
    const displayLoadingMessage = loadingMessage;
    if (isOverallLoading && !hasData) {
        return <DashboardLoading message={displayLoadingMessage} />;
    }
    if (!hasData && !isOverallLoading) {
      return (
        <>
          {!effectiveConnectionStatus && (
            <div className="card p-6 mb-6">
              <h2 className="text-lg font-semibold text-blue-800 dark:text-blue-300 mb-2"> Connect Your Bank </h2>
              <p className="text-[var(--card-foreground)] opacity-80 mb-4"> Connect your bank account to analyze the ethical impact of your spending. </p>
              <PlaidConnectionSection onSuccess={handlePlaidSuccess} isConnected={false} isLoading={isPlaidConnecting || isConnectingBank} />
            </div>
          )}
          {effectiveConnectionStatus && ( <DashboardEmptyState effectiveConnectionStatus={true} /> )}
          {effectiveConnectionStatus && !isOverallLoading && ( <ManualFetchButton onFetch={handleManualFetch} className="mt-6" showAfterTimeout={8000} /> )}
        </>
      );
    }
    return ( <div className="card overflow-visible"> <BalanceSheetView transactions={transactions} /> </div> );
  };

  // Main Layout (unchanged)
  return (
    <DashboardLayout
        user={user}
        onLogout={logout}
        onDisconnectBank={disconnectBank}
        isBankConnected={effectiveConnectionStatus}
        effectiveDebt={effectiveDebt}
    >
      {error && <ErrorAlert message={error} />}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <DashboardSidebar />
        </div>
        <div className="lg:col-span-3">
           {renderContent()}
        </div>
      </div>
    </DashboardLayout>
  );
}