// src/features/analysis/useTransactionAnalysis.ts
import { useState, useCallback, useRef, useEffect } from 'react';
import { Transaction, AnalyzedTransactionData } from './types';
import { mergeTransactions } from "@/features/banking/transactionMapper";

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
      console.log(`Starting analysis for ${newTransactions.length} transactions`);
      
      // THIS IS THE CRITICAL PART - check if these transactions already exist in savedTransactions
      const trulyUnanalyzedTransactions = newTransactions.filter(newTx => {
        // Create a transaction identifier
        const txId = getTransactionIdentifier(newTx);
        
        // Check if this transaction exists in savedTransactions and is already analyzed
        const matchingTx = savedTransactions?.find(savedTx => 
          getTransactionIdentifier(savedTx) === txId
        );
        
        // Only include truly unanalyzed transactions
        return !matchingTx || !matchingTx.analyzed;
      });
      
      console.log(`Found ${trulyUnanalyzedTransactions.length} truly unanalyzed transactions of ${newTransactions.length} total`);
      
      // If all transactions are already analyzed, skip the API call
      if (trulyUnanalyzedTransactions.length === 0) {
        console.log("All transactions already analyzed, skipping API call");
        
        // If we have saved transactions, merge with new ones to create a complete view
        if (savedTransactions && savedTransactions.length > 0) {
          const mergedTransactions = mergeTransactions(savedTransactions, newTransactions);
          
          // Calculate totals from merged data
          const totalDebt = mergedTransactions.reduce(
            (sum, tx) => sum + (tx.societalDebt || 0), 0
          );
          
          setAnalyzedData({
            transactions: mergedTransactions,
            totalSocietalDebt: totalDebt,
            debtPercentage: 0 // You can calculate this if needed
          });
          
          setAnalysisStatus({ status: 'success', error: null });
        }
        
        isAnalyzing.current = false;
        return;
      }
    
      // Continue with API call for truly unanalyzed transactions
      console.log(`Calling API to analyze ${trulyUnanalyzedTransactions.length} transactions`);
  
      // Call the API to analyze transactions
      const response = await fetch("/api/analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactions: trulyUnanalyzedTransactions }),
      });
  
      if (!response.ok) {
        throw new Error(`Analysis API error: ${response.status}`);
      }
  
      const data = await response.json() as AnalyzedTransactionData;
      console.log(`API returned ${data.transactions.length} analyzed transactions`);
      
      // Create a map of analyzed transactions keyed by transaction identifier
      const analyzedTransactionMap = new Map<string, Transaction>();
      
      // Process each transaction from the API response
      data.transactions.forEach((tx) => {
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
  
      // Sort by societal debt (largest first)
      const sortedTransactions = [...mergedTransactions].sort(
        (a, b) => (b.societalDebt ?? 0) - (a.societalDebt ?? 0)
      );
  
      // Calculate metrics
      const totalDebt = sortedTransactions.reduce(
        (sum, tx) => {
          // If this is a credit application, it directly reduces debt
          if (tx.isCreditApplication) {
            return sum - tx.amount;
          }
          return sum + (tx.societalDebt || 0);
        },
        0
      );
      
      const totalSpent = sortedTransactions.reduce(
        (sum, tx) => sum + tx.amount,
        0
      );
      
      const debtPercentage = totalSpent > 0 ? (totalDebt / totalSpent) * 100 : 0;
  
      setAnalyzedData({
        transactions: sortedTransactions,
        totalSocietalDebt: totalDebt,
        debtPercentage
      });
      
      setAnalysisStatus({ status: 'success', error: null });
      console.log("Analysis completed successfully");
      
    } catch (error) {
      console.error("Analysis error:", error);
      
      setAnalysisStatus({ 
        status: 'error', 
        error: error instanceof Error ? error.message : "Analysis failed" 
      });
      
      // If the API fails, add a fallback local calculation
      analysisTimeoutRef.current = setTimeout(() => {
        console.log("Using fallback local calculation after API error");
        
        // Mark all transactions as analyzed but with minimal details
        const fallbackTransactions = newTransactions.map(tx => ({
          ...tx,
          analyzed: true,
          societalDebt: tx.societalDebt || 0,
          unethicalPractices: tx.unethicalPractices || [],
          ethicalPractices: tx.ethicalPractices || []
        }));
        
        const totalDebt = fallbackTransactions.reduce(
          (sum, tx) => {
            if (tx.isCreditApplication) {
              return sum - tx.amount;
            }
            return sum + (tx.societalDebt || 0);
          },
          0
        );
        
        const totalSpent = fallbackTransactions.reduce(
          (sum, tx) => sum + tx.amount,
          0
        );
        
        const debtPercentage = totalSpent > 0 ? (totalDebt / totalSpent) * 100 : 0;
        
        setAnalyzedData({
          transactions: fallbackTransactions,
          totalSocietalDebt: totalDebt,
          debtPercentage
        });
        
        setAnalysisStatus({
          status: 'success',
          error: 'Analysis completed with limited details'
        });
      }, 1000);
    } finally {
      isAnalyzing.current = false;
    }
  }, [analyzedData, savedTransactions]);

  return {
    analyzedData,
    analysisStatus,
    analyzeTransactions,
    resetAnalysis
  };
}