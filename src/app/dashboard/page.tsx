// src/app/dashboard/page.jsx
"use client";

import React, { useCallback, useState, useEffect, useRef, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTransactionStore } from "@/store/transactionStore";
import { ErrorAlert } from "@/shared/ui/ErrorAlert";
import { DashboardLayout } from "@/features/dashboard/DashboardLayout";
import { PlaidConnectionSection } from "@/features/banking/PlaidConnectionSection";
import { BalanceSheetView } from "@/features/dashboard/views/BalanceSheetView";
import { ManualFetchButton } from "@/features/debug/ManualFetchButton";
import { DashboardSidebar } from "@/features/dashboard/DashboardSidebar";
import { DashboardLoading, DashboardEmptyState } from "@/features/dashboard/DashboardLoading";
import { useSampleData } from "@/features/debug/useSampleData";
import { ImpactAnalysis } from "@/core/calculations/type"; // For typing impactAnalysis

export default function Dashboard() {
  const [loadingMessage, setLoadingMessage] = useState<string>("Loading dashboard...");
  const { user, loading: authLoading, logout } = useAuth();

  // --- Optimized State Selection from Zustand Store ---
  const appStatus = useTransactionStore(state => state.appStatus);
  const transactions = useTransactionStore(state => state.transactions);
  const connectionStatus = useTransactionStore(state => state.connectionStatus);
  const impactAnalysis: ImpactAnalysis | null = useTransactionStore(state => state.impactAnalysis); // Typed

  // --- CORRECTED effectiveDebt derivation ---
  const effectiveDebt = useMemo(() => {
    if (impactAnalysis) {
      // netEthicalBalance is positive for surplus, negative for debt.
      // effectiveDebt should be the absolute value of debt, or 0 if surplus/neutral.
      return Math.max(0, -(impactAnalysis.netEthicalBalance ?? 0));
    }
    return 0;
  }, [impactAnalysis]);

  const connectBank = useTransactionStore(state => state.connectBank);
  const disconnectBank = useTransactionStore(state => state.disconnectBank);
  const manuallyFetchTransactions = useTransactionStore(state => state.manuallyFetchTransactions);
  const analyzeAndCacheTransactions = useTransactionStore(state => state.analyzeAndCacheTransactions);
  const initializeStore = useTransactionStore(state => state.initializeStore);
  // --- End Optimized Selection ---

  const { generateSampleTransactions } = useSampleData();

  const hasInitialized = useRef(false);
  const currentUserId = useRef<string | null>(null);

  const isOverallLoading = useMemo(() => {
    return appStatus !== 'idle' && appStatus !== 'error';
  }, [appStatus]);

  // Update loading message based on appStatus
  useEffect(() => {
      if (authLoading) {
          setLoadingMessage("Authenticating...");
      } else {
          switch(appStatus) {
              case 'initializing': setLoadingMessage("Initializing data..."); break;
              case 'connecting_bank': setLoadingMessage("Connecting bank account..."); break;
              case 'fetching_plaid': setLoadingMessage("Fetching transactions..."); break;
              case 'loading_latest': setLoadingMessage("Loading saved data..."); break;
              // case 'loading_credit_state': setLoadingMessage("Loading credit state..."); break; // REMOVED
              case 'analyzing': setLoadingMessage("Analyzing impact..."); break;
              case 'saving_cache': setLoadingMessage("Updating vendor cache..."); break;
              case 'saving_batch': setLoadingMessage("Saving data..."); break;
              // case 'applying_credit': setLoadingMessage("Applying Credit..."); break; // REMOVED
              case 'loading_settings': setLoadingMessage("Loading settings..."); break;
              case 'saving_settings': setLoadingMessage("Saving settings..."); break;
              case 'idle': setLoadingMessage("Loading dashboard..."); break; // Default idle message
              case 'error': setLoadingMessage("Error occurred"); break;
              default: setLoadingMessage("Loading dashboard...");
          }
      }
      if (appStatus === 'idle' && !authLoading && user) { // More specific condition for "Dashboard Idle"
        console.log("Dashboard Idle. Transactions in store:", useTransactionStore.getState().transactions.length);
        console.log("Current Impact Analysis:", useTransactionStore.getState().impactAnalysis);
      }
  }, [user, authLoading, appStatus]); // initializeStore removed as it's not directly setting message


  const effectiveConnectionStatus: boolean = connectionStatus.isConnected;
  const error: string | null = connectionStatus.error;
  const hasData: boolean = transactions.length > 0;

  // Initialize store on user change or if not yet initialized
  useEffect(() => {
    const userId = user?.uid;
    console.log(`Dashboard Init Effect Check: user=${userId}, authLoading=${authLoading}, hasInitialized=${hasInitialized.current}, appStatus=${appStatus}`);

    if (userId !== currentUserId.current) {
        console.log(`Dashboard Init Effect: User changed (${currentUserId.current} -> ${userId}). Resetting init flag.`);
        hasInitialized.current = false; // Reset init flag for new user
        currentUserId.current = userId ?? null;
    }

    if (user && !authLoading && !hasInitialized.current && appStatus === 'idle') {
        console.log(`Dashboard Init Effect: Conditions met. Calling initializeStore for user ${user.uid}. Setting init flag.`);
        hasInitialized.current = true; // Set flag before async call to prevent re-entry

        initializeStore(user).catch((err) => {
             console.error("Dashboard Init Effect: initializeStore promise rejected", err);
             hasInitialized.current = false; // Reset on error to allow retry if appropriate
        });
    } else if (user && !authLoading && appStatus !== 'idle' && appStatus !== 'error' && appStatus !== 'initializing') { // Added 'initializing' to prevent loop
        console.log(`Dashboard Init Effect: Skipping initialization - appStatus is busy: ${appStatus} or already initialized.`);
    }
  }, [user, authLoading, appStatus, initializeStore]);


  // --- Callbacks ---
  const handleLoadSampleData = useCallback(async () => {
    if (appStatus !== 'idle' && appStatus !== 'error') {
      console.log(`handleLoadSampleData: Skipping (Status: ${appStatus})...`);
      return;
    }
    // Explicitly set appStatus to 'analyzing' or a similar busy state before async ops
    useTransactionStore.setState({ appStatus: 'analyzing' });
    setLoadingMessage("Generating & Analyzing sample data...");
    try {
      const sampleTxs = generateSampleTransactions();
      await analyzeAndCacheTransactions(sampleTxs); 
      // analyzeAndCacheTransactions should set appStatus to 'idle' upon completion
      // If not, ensure to set it here or verify its internal logic.
      // For sample data, explicitly set connectionStatus to show data views.
      useTransactionStore.setState({
        connectionStatus: { isConnected: true, error: null }
      });
      hasInitialized.current = true; // Treat sample data loading as a form of initialization
      setLoadingMessage("Dashboard ready with sample data.");
    } catch (error) {
       console.error("Error loading/analyzing sample data:", error);
       useTransactionStore.setState({ appStatus: 'error', connectionStatus: { ...connectionStatus, error: 'Failed to load sample data' } });
    }
  }, [generateSampleTransactions, analyzeAndCacheTransactions, appStatus, connectionStatus]);

  const handlePlaidSuccess = useCallback(async (publicToken: string | null) => {
    if (appStatus !== 'idle' && appStatus !== 'error') { console.log(`handlePlaidSuccess: Skipping (Status: ${appStatus})...`); return; }
    try {
      if (publicToken && user) {
          await connectBank(publicToken, user); // connectBank internally calls fetch and then analyze
       } else { // This is the sample data path
          await handleLoadSampleData();
       }
       hasInitialized.current = true; // Mark as initialized after successful connection/sample load
    } catch (error) { console.error("Error in handlePlaidSuccess flow:", error); }
  }, [connectBank, user, handleLoadSampleData, appStatus]);


  const handleManualFetch = useCallback(async () => {
     if (appStatus !== 'idle' && appStatus !== 'error') { console.log(`handleManualFetch: Skipping (Status: ${appStatus})...`); return; }
     try {
         await manuallyFetchTransactions(); // This will also trigger analysis via store logic
    } catch (error) { console.error("Manual fetch failed:", error); }
   }, [manuallyFetchTransactions, appStatus]);
   // --- End Callbacks ---

  if (authLoading) { return <DashboardLoading message="Checking authentication..." />; }
  if (!user) { return <DashboardLoading message="Redirecting to login..." />; }

  const renderContent = () => {
    const displayLoadingMessage = loadingMessage;

    // Show loading if overall status is busy AND there's no data yet.
    // Or if initializing specifically for the current user.
    if ((isOverallLoading && !hasData) || (appStatus === 'initializing' && currentUserId.current === user.uid && !hasInitialized.current)) {
        return <DashboardLoading message={displayLoadingMessage} />;
    }

    // If not loading and no data, show connection/empty states
    if (!isOverallLoading && !hasData) {
      return (
        <>
          {!effectiveConnectionStatus && (
            <div className="card p-6 mb-6">
              <h2 className="text-lg font-semibold text-blue-800 dark:text-blue-300 mb-2"> Connect Your Bank </h2>
              <p className="text-[var(--card-foreground)] opacity-80 mb-4"> Connect your bank account to analyze the ethical impact of your spending. </p>
              <PlaidConnectionSection
                 onSuccess={handlePlaidSuccess}
                 isConnected={false} // Explicitly false as we are in the "not connected" UI branch
                 isLoading={appStatus === 'connecting_bank'}
               />
            </div>
          )}
          {/* Show empty state if connected but still no data (after loading attempts) */}
          {effectiveConnectionStatus && ( <DashboardEmptyState effectiveConnectionStatus={true} /> )}
          {/* Manual fetch button if connected, not loading, and still no data after a timeout */}
          {effectiveConnectionStatus && !isOverallLoading && (
            <ManualFetchButton onFetch={handleManualFetch} className="mt-6" showAfterTimeout={8000} />
          )}
        </>
      );
    }

    // If has data, show the balance sheet
    if (hasData) { // `impactAnalysis` will be populated by the store once transactions are set/analyzed
        return ( <div className="card overflow-visible"> <BalanceSheetView transactions={transactions} /> </div> );
    }

    // Fallback loading state if other conditions aren't met (e.g., error state but trying to show content)
    return <DashboardLoading message={isOverallLoading ? displayLoadingMessage : "Loading dashboard..."} />;
  };

  return (
    <DashboardLayout
        user={user}
        onLogout={logout}
        onDisconnectBank={disconnectBank}
        isBankConnected={effectiveConnectionStatus}
        effectiveDebt={effectiveDebt} // This is now correctly derived
    >
      {error && appStatus === 'error' && <ErrorAlert message={error} />}
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