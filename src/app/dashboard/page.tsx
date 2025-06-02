// src/app/dashboard/page.tsx
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

export default function Dashboard() {
  const [loadingMessage, setLoadingMessage] = useState<string>("Loading dashboard...");
  const { user, loading: authLoading, logout } = useAuth();

  // --- Optimized State Selection ---
  const appStatus = useTransactionStore(state => state.appStatus);
  const transactions = useTransactionStore(state => state.transactions);
  const connectionStatus = useTransactionStore(state => state.connectionStatus);
  const impactAnalysis = useTransactionStore(state => state.impactAnalysis);
  const effectiveDebt = impactAnalysis?.effectiveDebt ?? 0;

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

  useEffect(() => {
      if (authLoading) {
          setLoadingMessage("Authenticating...");
      } else {
          switch(appStatus) {
              case 'initializing': setLoadingMessage("Initializing data..."); break;
              case 'connecting_bank': setLoadingMessage("Connecting bank account..."); break;
              case 'fetching_plaid': setLoadingMessage("Fetching transactions..."); break;
              case 'loading_latest': setLoadingMessage("Loading saved data..."); break;
              case 'loading_credit_state': setLoadingMessage("Loading credit state..."); break;
              case 'analyzing': setLoadingMessage("Analyzing impact..."); break;
              case 'saving_cache': setLoadingMessage("Updating vendor cache..."); break;
              case 'saving_batch': setLoadingMessage("Saving data..."); break;
              case 'applying_credit': setLoadingMessage("Applying Credit..."); break;
              case 'idle': setLoadingMessage("Loading dashboard..."); break;
              case 'error': setLoadingMessage("Error occurred"); break;
              default: setLoadingMessage("Loading dashboard...");
          }
      }
      if (appStatus === 'idle') {
        console.log("Dashboard Idle. Transactions in store:", useTransactionStore.getState().transactions);
        console.log("Number of transactions in store:", useTransactionStore.getState().transactions.length);
      }
  }, [user, authLoading, appStatus, initializeStore]);


  const effectiveConnectionStatus: boolean = connectionStatus.isConnected;
  const error: string | null = connectionStatus.error;
  const hasData: boolean = transactions.length > 0;

  useEffect(() => {
    const userId = user?.uid;
    console.log(`Dashboard Init Effect Check: user=${userId}, authLoading=${authLoading}, hasInitialized=${hasInitialized.current}, appStatus=${appStatus}`);

    if (userId !== currentUserId.current) {
        console.log(`Dashboard Init Effect: User changed (${currentUserId.current} -> ${userId}). Resetting init flag.`);
        hasInitialized.current = false;
        currentUserId.current = userId ?? null;
    }

    if (user && !authLoading && !hasInitialized.current && appStatus === 'idle') {
        console.log(`Dashboard Init Effect: Conditions met. Calling initializeStore for user ${user.uid}. Setting init flag.`);
        hasInitialized.current = true;

        initializeStore(user).catch((err) => {
             console.error("Dashboard Init Effect: initializeStore promise rejected", err);
        });
    } else if (user && !authLoading && appStatus !== 'idle' && appStatus !== 'error') {
        console.log(`Dashboard Init Effect: Skipping initialization - appStatus is busy: ${appStatus}`);
    }
  }, [user, authLoading, appStatus, initializeStore]);


  // --- Callbacks ---
  const handleLoadSampleData = useCallback(async () => {
    if (appStatus !== 'idle' && appStatus !== 'error') {
      console.log(`handleLoadSampleData: Skipping (Status: ${appStatus})...`);
      return;
    }
    setLoadingMessage("Loading and analyzing sample data...");
    try {
      const sampleTxs = generateSampleTransactions();
      await analyzeAndCacheTransactions(sampleTxs); // This should set appStatus to idle at its end

      // ---- MODIFICATION START ----
      // After sample data is processed and store is updated by analyzeAndCacheTransactions:
      useTransactionStore.setState({
        connectionStatus: { isConnected: true, error: null }, // Show as connected for sample data
        // appStatus: 'idle' // Ensure it's idle, though analyzeAndCacheTransactions should do this
      });
      hasInitialized.current = true; // Mark as initialized to prevent initializeStore from potentially overriding the sample view immediately
      
      console.log("Sample data loaded and processed. Store impactAnalysis:", useTransactionStore.getState().impactAnalysis);
      console.log("Store transactions after sample load:", useTransactionStore.getState().transactions);
      setLoadingMessage("Dashboard ready with sample data.");
      // ---- MODIFICATION END ----

    } catch (error) {
       console.error("Error loading/analyzing sample data:", error);
       useTransactionStore.setState({ appStatus: 'error', connectionStatus: { ...connectionStatus, error: 'Failed to load sample data' } });
    }
  }, [generateSampleTransactions, analyzeAndCacheTransactions, appStatus, connectionStatus]);

  const handlePlaidSuccess = useCallback(async (publicToken: string | null) => {
    if (appStatus !== 'idle' && appStatus !== 'error') { console.log(`handlePlaidSuccess: Skipping (Status: ${appStatus})...`); return; }
    try {
      if (publicToken && user) {
          await connectBank(publicToken, user);
       } else { // This is the sample data path
          await handleLoadSampleData();
       }
    } catch (error) { console.error("Error in handlePlaidSuccess flow:", error); }
  }, [connectBank, user, handleLoadSampleData, appStatus]); // Make sure dependencies are correct


  const handleManualFetch = useCallback(async () => {
     if (appStatus !== 'idle' && appStatus !== 'error') { console.log(`handleManualFetch: Skipping (Status: ${appStatus})...`); return; }
     try {
         await manuallyFetchTransactions();
    } catch (error) { console.error("Manual fetch failed:", error); }
   }, [manuallyFetchTransactions, appStatus]);
   // --- End Callbacks ---

  if (authLoading) { return <DashboardLoading message="Checking authentication..." />; }
  if (!user) { return <DashboardLoading message="Redirecting to login..." />; }

  const renderContent = () => {
    const displayLoadingMessage = loadingMessage;

    if (isOverallLoading && !hasData) {
        return <DashboardLoading message={displayLoadingMessage} />;
    }

    if (!isOverallLoading && !hasData) {
      return (
        <>
          {!effectiveConnectionStatus && (
            <div className="card p-6 mb-6">
              <h2 className="text-lg font-semibold text-blue-800 dark:text-blue-300 mb-2"> Connect Your Bank </h2>
              <p className="text-[var(--card-foreground)] opacity-80 mb-4"> Connect your bank account to analyze the ethical impact of your spending. </p>
              <PlaidConnectionSection
                 onSuccess={handlePlaidSuccess}
                 isConnected={false}
                 isLoading={appStatus === 'connecting_bank'}
               />
            </div>
          )}
          {effectiveConnectionStatus && ( <DashboardEmptyState effectiveConnectionStatus={true} /> )}
          {effectiveConnectionStatus && !isOverallLoading && (
            <ManualFetchButton onFetch={handleManualFetch} className="mt-6" showAfterTimeout={8000} />
          )}
        </>
      );
    }

    if (hasData) {
        return ( <div className="card overflow-visible"> <BalanceSheetView transactions={transactions} /> </div> );
    }

    return <DashboardLoading message="Loading..." />;
  };

  return (
    <DashboardLayout
        user={user}
        onLogout={logout}
        onDisconnectBank={disconnectBank}
        isBankConnected={effectiveConnectionStatus}
        effectiveDebt={effectiveDebt}
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