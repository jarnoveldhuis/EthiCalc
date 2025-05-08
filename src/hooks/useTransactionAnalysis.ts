// src/features/analysis/useTransactionAnalysis.ts
import { useState, useCallback, useRef, useEffect } from 'react';
import { Transaction, AnalyzedTransactionData } from '@/shared/types/transactions';
import { calculationService } from "@/core/calculations/impactService";
import { mergeTransactions } from "@/core/plaid/transactionMapper";

interface AnalysisStatus {
  status: 'idle' | 'loading' | 'success' | 'error';
  error: string | null;
}

interface UseTransactionAnalysisResult {
  analyzedData: AnalyzedTransactionData | null;
  analysisStatus: AnalysisStatus;
  analyzeTransactions: (transactions: Transaction[]) => Promise<void>;
  resetAnalysis: () => void;
}

// Helper function to generate a unique identifier for a transaction
function getTransactionIdentifier(transaction: Transaction): string {
  return `${transaction.date}-${transaction.name}-${transaction.amount}`;
}

export function useTransactionAnalysis(
  savedTransactions: Transaction[] | null = null
): UseTransactionAnalysisResult {
  const [analyzedData, setAnalyzedData] = useState<AnalyzedTransactionData | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>({
    status: 'idle',
    error: null
  });
  
  // Use a ref to track if we're currently analyzing
  const isAnalyzing = useRef(false);
  const analysisTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up any pending timeouts on unmount
  useEffect(() => {
    return () => {
      if (analysisTimeoutRef.current) {
        clearTimeout(analysisTimeoutRef.current);
      }
    };
  }, []);

  // Reset the analysis state
  const resetAnalysis = useCallback(() => {
    if (analysisTimeoutRef.current) {
      clearTimeout(analysisTimeoutRef.current);
      analysisTimeoutRef.current = null;
    }
    
    setAnalyzedData(null);
    setAnalysisStatus({
      status: 'idle',
      error: null
    });
    isAnalyzing.current = false;
  }, []);

  const analyzeTransactions = useCallback(async (newTransactions: Transaction[]) => {
    // Skip if no transactions or we're already analyzing
    if (!newTransactions.length || isAnalyzing.current) {
      return;
    }

    isAnalyzing.current = true;
    setAnalysisStatus({ status: 'loading', error: null });

    try {
      // Check if these transactions already exist in savedTransactions
      const trulyUnanalyzedTransactions = newTransactions.filter(newTx => {
        const txId = getTransactionIdentifier(newTx);
        const matchingTx = savedTransactions?.find(savedTx => 
          getTransactionIdentifier(savedTx) === txId
        );
        return !matchingTx || !matchingTx.analyzed;
      });
      
      // If all transactions are already analyzed, skip the API call
      if (trulyUnanalyzedTransactions.length === 0) {
        // If we have saved transactions, merge with new ones to create a complete view
        if (savedTransactions && savedTransactions.length > 0) {
          const mergedTransactions = mergeTransactions(savedTransactions, newTransactions);
          
          // Use calculationService for all calculations
          const impactAnalysisResult = calculationService.calculateImpactAnalysis(mergedTransactions);
          const { netSocietalDebt, debtPercentage, positiveImpact, negativeImpact } = impactAnalysisResult;
          
          setAnalyzedData({
            transactions: mergedTransactions,
            totalSocietalDebt: netSocietalDebt,
            debtPercentage,
            totalPositiveImpact: positiveImpact,
            totalNegativeImpact: negativeImpact
          });
        }
        
        setAnalysisStatus({ status: 'success', error: null });
        isAnalyzing.current = false;
        return;
      }
    
      // Continue with API call for truly unanalyzed transactions
      const response = await fetch("/api/analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactions: trulyUnanalyzedTransactions }),
      });
  
      if (!response.ok) {
        throw new Error(`Analysis API error: ${response.status}`);
      }
  
      const data = await response.json() as AnalyzedTransactionData;
      
      // Create a map of analyzed transactions keyed by transaction identifier
      const analyzedTransactionMap = new Map<string, Transaction>();
      
      // Process each transaction from the API response
      data.transactions.forEach((tx: Transaction) => {
        const identifier = getTransactionIdentifier(tx);
        analyzedTransactionMap.set(identifier, {
          ...tx,
          analyzed: true // Mark as analyzed
        });
      });
  
      // Merge with original transactions, preserving any that weren't sent for analysis
      const mergedTransactions = newTransactions.map((tx) => {
        const identifier = getTransactionIdentifier(tx);
        if (analyzedTransactionMap.has(identifier)) {
          return analyzedTransactionMap.get(identifier)!;
        }
        return tx;
      });
  
      // Use calculationService for all calculations after merging with any saved transactions
      const finalTransactions = savedTransactions 
        ? mergeTransactions(savedTransactions, mergedTransactions)
        : mergedTransactions;
        
      // Recalculate all metrics using the service
      const finalImpactAnalysis = calculationService.calculateImpactAnalysis(finalTransactions);
      const { 
        netSocietalDebt: finalNetSocietalDebt, 
        debtPercentage: finalDebtPercentage, 
        positiveImpact: finalPositiveImpact, 
        negativeImpact: finalNegativeImpact 
      } = finalImpactAnalysis;
  
      // Set the analyzed data with all metrics calculated by the service
      setAnalyzedData({
        transactions: finalTransactions,
        totalSocietalDebt: finalNetSocietalDebt,
        debtPercentage: finalDebtPercentage,
        totalPositiveImpact: finalPositiveImpact,
        totalNegativeImpact: finalNegativeImpact
      });
      
      setAnalysisStatus({ status: 'success', error: null });
    } catch (err) {
      console.error('Error analyzing transactions:', err);
      setAnalysisStatus({ 
        status: 'error', 
        error: err instanceof Error ? err.message : 'Failed to analyze transactions' 
      });
    } finally {
      isAnalyzing.current = false;
    }
  }, [savedTransactions]);

  return {
    analyzedData,
    analysisStatus,
    analyzeTransactions,
    resetAnalysis
  };
}