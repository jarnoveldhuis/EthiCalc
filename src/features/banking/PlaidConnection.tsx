// src/features/banking/PlaidConnection.tsx
"use client";

import { useEffect, useState, useCallback } from 'react';
import { useBankConnection } from './useBankConnection';
import { useTransactionAnalysis } from '@/features/analysis/useTransactionAnalysis';
import { useTransactionStorage } from '@/features/analysis/useTransactionStorage';
import PlaidLink from './PlaidLink';
import { LoadingSpinner } from '@/shared/components/ui/LoadingSpinner';
import { ErrorAlert } from '@/shared/components/ui/ErrorAlert';
import { User } from 'firebase/auth';
import { Transaction } from '@/shared/types/transactions';

interface PlaidConnectionProps {
  user: User | null;
  onTransactionsLoaded?: (transactions: Transaction[]) => void;
  onAnalysisComplete?: (totalDebt: number) => void;
}

export function PlaidConnection({ 
  user, 
  onTransactionsLoaded,
  onAnalysisComplete 
}: PlaidConnectionProps) {
  // State for managing connection flow
  const [step, setStep] = useState<'connect' | 'loading' | 'analyzing' | 'complete'>('connect');
  const [debugMessage, setDebugMessage] = useState<string | null>(null);
  
  // Get bank connection and transaction analysis hooks
  const { 
    connectionStatus, 
    transactions, 
    connectBank, 
    disconnectBank 
  } = useBankConnection(user);
  
  const {
    analyzedData,
    analysisStatus,
    analyzeTransactions
  } = useTransactionAnalysis();
  
  const { 
    saveTransactions, 
    isLoading: isSaving,
    error: saveError
  } = useTransactionStorage(user);
  
  // Handle Plaid success - when user completes Plaid Link flow
  const handlePlaidSuccess = useCallback((public_token: string) => {
    setStep('loading');
    setDebugMessage('Received public token from Plaid, exchanging for access token...');
    
    // Connect to bank using the public token
    connectBank(public_token).catch(error => {
      console.error('Bank connection error:', error);
      setDebugMessage(`Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setStep('connect');
    });
  }, [connectBank]);
  
  // Listen for bank transactions to be loaded
  useEffect(() => {
    if (transactions.length > 0 && step === 'loading') {
      setStep('analyzing');
      setDebugMessage(`Successfully loaded ${transactions.length} transactions, starting analysis...`);
      
      // Notify parent component if needed
      if (onTransactionsLoaded) {
        onTransactionsLoaded(transactions);
      }
      
      // Start analyzing the transactions
      analyzeTransactions(transactions);
    }
  }, [transactions, step, analyzeTransactions, onTransactionsLoaded]);
  
  // Listen for analysis to complete
  useEffect(() => {
    if (analyzedData && 
        analyzedData.transactions.length > 0 && 
        analysisStatus.status === 'success' && 
        step === 'analyzing') {
      
      setStep('complete');
      setDebugMessage(`Analysis complete. Total societal debt: $${analyzedData.totalSocietalDebt.toFixed(2)}`);
      
      // Save analyzed data if we have a user
      if (user) {
        saveTransactions(
          analyzedData.transactions,
          analyzedData.totalSocietalDebt
        ).catch(error => {
          console.error('Failed to save transactions:', error);
        });
      }
      
      // Notify parent component if needed
      if (onAnalysisComplete) {
        onAnalysisComplete(analyzedData.totalSocietalDebt);
      }
    }
  }, [analyzedData, analysisStatus, step, user, saveTransactions, onAnalysisComplete]);
  
  // Show loading indicator during connection and analysis
  const isLoading = connectionStatus.isLoading || 
                    analysisStatus.status === 'loading' || 
                    isSaving;
  
  // Get any errors from the process
  const error = connectionStatus.error || 
                analysisStatus.error || 
                saveError;
  
  // Reset connection
  const handleReset = useCallback(() => {
    disconnectBank();
    setStep('connect');
    setDebugMessage(null);
  }, [disconnectBank]);
  
  // Determine what to render based on the current step
  const renderContent = () => {
    if (step === 'connect' && !connectionStatus.isConnected) {
      return (
        <div className="text-center">
          <h2 className="text-lg font-semibold mb-4">Connect Your Bank Account</h2>
          <PlaidLink onSuccess={handlePlaidSuccess} />
        </div>
      );
    }
    
    if (isLoading) {
      return (
        <div className="text-center py-6">
          <LoadingSpinner 
            message={
              connectionStatus.isLoading 
                ? "Connecting to your bank..." 
                : analysisStatus.status === 'loading'
                  ? "Analyzing your transactions..."
                  : "Saving your analysis..."
            } 
          />
          {debugMessage && (
            <div className="mt-4 text-xs text-gray-500">
              {debugMessage}
            </div>
          )}
        </div>
      );
    }
    
    if (error) {
      return (
        <div className="py-4">
          <ErrorAlert message={error} />
          <div className="mt-4 text-center">
            <button 
              onClick={handleReset}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }
    
    if (step === 'complete' && analyzedData) {
      // If complete, show a success message (parent component will handle displaying the data)
      return (
        <div className="text-center py-4">
          <div className="text-lg font-semibold text-green-600 mb-2">
            ✅ Successfully analyzed {analyzedData.transactions.length} transactions
          </div>
          <div className="text-sm text-gray-700">
            Your transactions are now ready to view
          </div>
          {debugMessage && (
            <div className="mt-4 text-xs text-gray-500">
              {debugMessage}
            </div>
          )}
        </div>
      );
    }
    
    // Default case
    return (
      <div className="text-center py-4">
        <div className="text-gray-600">
          {connectionStatus.isConnected 
            ? "Bank connected, but no transactions loaded."
            : "Please connect your bank to get started."}
        </div>
        <button 
          onClick={handleReset}
          className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
        >
          {connectionStatus.isConnected ? "Reconnect Bank" : "Connect Bank"}
        </button>
      </div>
    );
  };
  
  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      {renderContent()}
    </div>
  );
}