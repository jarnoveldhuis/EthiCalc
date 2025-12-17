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
import { ImpactAnalysis } from "@/core/calculations/type";

export default function Dashboard() {
  const [loadingMessage, setLoadingMessage] = useState<string>("Loading dashboard...");
  const { user, loading: authLoading, logout } = useAuth();

  const appStatus = useTransactionStore(state => state.appStatus);
  const transactions = useTransactionStore(state => state.transactions);
  const connectionStatus = useTransactionStore(state => state.connectionStatus);
  const impactAnalysis: ImpactAnalysis | null = useTransactionStore(state => state.impactAnalysis);

  const effectiveDebt = useMemo(() => {
    if (impactAnalysis) {
      return Math.max(0, -(impactAnalysis.netEthicalBalance ?? 0));
    }
    return 0;
  }, [impactAnalysis]);

  const connectBank = useTransactionStore(state => state.connectBank);
  const disconnectBank = useTransactionStore(state => state.disconnectBank);
  const manuallyFetchTransactions = useTransactionStore(state => state.manuallyFetchTransactions);
  const analyzeAndCacheTransactions = useTransactionStore(state => state.analyzeAndCacheTransactions);
  const initializeStore = useTransactionStore(state => state.initializeStore);

  const { generateSampleTransactions } = useSampleData();

  const hasInitialized = useRef(false);
  const currentUserId = useRef<string | null>(null);

  const isOverallLoading = useMemo(() => {
    return appStatus !== 'idle' && appStatus !== 'error';
  }, [appStatus]);

  useEffect(() => {
      if (authLoading) { setLoadingMessage("Authenticating..."); }
      else {
          switch(appStatus) {
              case 'initializing': setLoadingMessage("Initializing data..."); break;
              case 'connecting_bank': setLoadingMessage("Connecting bank account..."); break;
              case 'fetching_plaid': setLoadingMessage("Fetching transactions..."); break;
              case 'loading_latest': setLoadingMessage("Loading saved data..."); break;
              case 'analyzing': setLoadingMessage("Analyzing impact..."); break;
              case 'saving_cache': setLoadingMessage("Updating vendor cache..."); break;
              case 'saving_batch': setLoadingMessage("Saving data..."); break;
              case 'loading_settings': setLoadingMessage("Loading settings..."); break;
              case 'saving_settings': setLoadingMessage("Saving settings..."); break;
              case 'idle': setLoadingMessage("Dashboard ready."); break;
              case 'error': setLoadingMessage("An error occurred."); break;
              default: setLoadingMessage("Loading dashboard...");
          }
      }
  }, [authLoading, appStatus]);

  const effectiveConnectionStatus: boolean = connectionStatus.isConnected;
  const error: string | null = connectionStatus.error;
  const hasData: boolean = transactions.length > 0;

  useEffect(() => {
    const userId = user?.uid;
    if (userId !== currentUserId.current) {
        hasInitialized.current = false;
        currentUserId.current = userId ?? null;
    }
    if (user && !authLoading && !hasInitialized.current && appStatus === 'idle') {
        hasInitialized.current = true;
        initializeStore(user).catch((err) => {
             console.error("Dashboard Init Effect: initializeStore promise rejected", err);
             hasInitialized.current = false;
        });
    }
  }, [user, authLoading, appStatus, initializeStore]);

  const handleLoadSampleData = useCallback(async () => {
    // Let the store action handle all status updates
    try {
      const sampleTxs = generateSampleTransactions();
      await analyzeAndCacheTransactions(sampleTxs);
      useTransactionStore.setState({
        connectionStatus: { isConnected: true, error: null }
      });
      hasInitialized.current = true;
    } catch (error) {
       console.error("Error loading/analyzing sample data:", error);
       useTransactionStore.setState({ appStatus: 'error', connectionStatus: { ...connectionStatus, error: 'Failed to load sample data' } });
    }
  }, [generateSampleTransactions, analyzeAndCacheTransactions, connectionStatus]);

  const handlePlaidSuccess = useCallback(async (publicToken: string | null) => {
    try {
      if (publicToken && user) {
          await connectBank(publicToken, user);
       } else {
          await handleLoadSampleData();
       }
       hasInitialized.current = true;
    } catch (error) { console.error("Error in handlePlaidSuccess flow:", error); }
  }, [connectBank, user, handleLoadSampleData]);

  const handleManualFetch = useCallback(async () => {
     if (appStatus !== 'idle' && appStatus !== 'error') return;
     try {
         await manuallyFetchTransactions();
    } catch (error) { console.error("Manual fetch failed:", error); }
   }, [manuallyFetchTransactions, appStatus]);

  if (authLoading) { return <DashboardLoading message="Checking authentication..." />; }
  if (!user) { return <DashboardLoading message="Redirecting to login..." />; }

  const renderContent = () => {
    if ((isOverallLoading && !hasData) || appStatus === 'initializing') {
        return <DashboardLoading message={loadingMessage} />;
    }
    if (!isOverallLoading && !hasData) {
      return (
        <>
          {!effectiveConnectionStatus && (
            <div className="card p-6 mb-6">
              <h2 className="text-lg font-semibold text-blue-800 dark:text-blue-300 mb-2">Connect Your Bank</h2>
              <p className="text-[var(--card-foreground)] opacity-80 mb-4">Connect your bank account to analyze the ethical impact of your spending.</p>
              <PlaidConnectionSection
                 onSuccess={handlePlaidSuccess}
                 isConnected={false}
                 isLoading={appStatus === 'connecting_bank'}
               />
            </div>
          )}
          {effectiveConnectionStatus && <DashboardEmptyState effectiveConnectionStatus={true} />}
          {effectiveConnectionStatus && !isOverallLoading && (
            <ManualFetchButton onFetch={handleManualFetch} className="mt-6" showAfterTimeout={8000} />
          )}
        </>
      );
    }
    if (hasData) {
        return ( <div className="card overflow-visible"> <BalanceSheetView transactions={transactions} /> </div> );
    }
    return <DashboardLoading message={loadingMessage} />;
  };

  return (
    <DashboardLayout
        user={user}
        onLogout={logout}
        onDisconnectBank={disconnectBank}
        isBankConnected={effectiveConnectionStatus}
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