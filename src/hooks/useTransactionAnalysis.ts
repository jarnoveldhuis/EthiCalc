// src/hooks/useTransactionAnalysis.ts
import { useState, useCallback, useRef, useEffect } from 'react';
import { Transaction, AnalyzedTransactionData, Citation, Charity } from '@/shared/types/transactions'; // Ensure Charity and Citation are imported
import { calculationService } from "@/core/calculations/impactService";
import { mergeTransactions } from "@/core/plaid/transactionMapper";
import { ImpactAnalysis } from '@/core/calculations/type';
import { useTransactionStore } from '@/store/transactionStore';
import { auth } from '@/core/firebase/firebase'; // Import Firebase auth for getAuthHeader

// --- START getAuthHeader Utility ---
// TODO: Jarno, this function should ideally be moved to a shared utility file (e.g., src/utils/authUtils.ts)
// and imported here and in transactionStore.ts.
const getAuthHeader = async (): Promise<HeadersInit | null> => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    console.warn("getAuthHeader (useTransactionAnalysis): No current user found.");
    // Potentially throw an error or return null based on how you want to handle auth failures here
    // For now, returning null and letting the API call proceed without auth might be okay if some API calls are public
    // But for /api/analysis, it likely requires auth.
    throw new Error("User not authenticated to perform analysis.");
  }
  try {
    const token = await currentUser.getIdToken(true); // Force refresh
    if (!token) {
      console.warn("getAuthHeader (useTransactionAnalysis): Failed to get ID token.");
      throw new Error("Failed to get authentication token.");
    }
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  } catch (error) {
    console.error("getAuthHeader (useTransactionAnalysis): Error getting ID token:", error);
    throw new Error("Error obtaining authentication token."); // Re-throw to be caught by the caller
  }
};
// --- END getAuthHeader Utility ---

// --- Type Definitions (from previous fix) ---
interface ApiAnalysisResultItem {
  plaidTransactionId: string;
  date?: string;
  name?: string;
  amount?: number;
  societalDebt?: number;
  unethicalPractices?: string[];
  ethicalPractices?: string[];
  practiceWeights?: Record<string, number>;
  practiceDebts?: Record<string, number>;
  practiceSearchTerms?: Record<string, string>;
  practiceCategories?: Record<string, string>;
  charities?: Record<string, Charity>;
  information?: Record<string, string>;
  citations?: Record<string, Citation[]>;
}

interface ApiAnalysisResponse {
  transactions: ApiAnalysisResultItem[];
  error?: string;
}

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

function getTransactionIdentifier(transaction: Transaction | ApiAnalysisResultItem): string | null {
    if (transaction.plaidTransactionId) return `plaid-${transaction.plaidTransactionId}`;
    if (transaction.date && transaction.name && typeof transaction.amount === "number") {
        return `${transaction.date}-${transaction.name.trim().toUpperCase()}-${transaction.amount.toFixed(2)}`;
    }
    return null;
}

export function useTransactionAnalysis(
  initialTransactions: Transaction[] | null = null
): UseTransactionAnalysisResult {
  const [analyzedData, setAnalyzedData] = useState<AnalyzedTransactionData | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>({
    status: 'idle',
    error: null
  });
  
  const isAnalyzing = useRef(false);
  const analysisTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const userValueSettings = useTransactionStore((state) => state.userValueSettings);

  useEffect(() => {
    return () => {
      if (analysisTimeoutRef.current) {
        clearTimeout(analysisTimeoutRef.current);
      }
    };
  }, []);

  const resetAnalysis = useCallback(() => {
    if (analysisTimeoutRef.current) {
      clearTimeout(analysisTimeoutRef.current);
      analysisTimeoutRef.current = null;
    }
    setAnalyzedData(null);
    setAnalysisStatus({ status: 'idle', error: null });
    isAnalyzing.current = false;
  }, []);

  const analyzeTransactions = useCallback(async (newTransactions: Transaction[]) => {
    if (!newTransactions.length || isAnalyzing.current) {
      return;
    }
    isAnalyzing.current = true;
    setAnalysisStatus({ status: 'loading', error: null });

    try {
      const transactionsToAnalyzeForAPI = newTransactions.filter(tx => 
        !(tx.analyzed || initialTransactions?.find(stx => getTransactionIdentifier(stx) === getTransactionIdentifier(tx))?.analyzed)
      );
      
      let currentProcessedTransactions: Transaction[] = newTransactions.filter(tx => 
        tx.analyzed || initialTransactions?.find(stx => getTransactionIdentifier(stx) === getTransactionIdentifier(tx))?.analyzed
      );
      initialTransactions?.forEach(initTx => {
        if (initTx.analyzed) {
            const id = getTransactionIdentifier(initTx);
            if (!currentProcessedTransactions.some(ptx => getTransactionIdentifier(ptx) === id)) {
                 // This logic might need refinement based on how initialTransactions and newTransactions relate
            }
        }
      });

      if (transactionsToAnalyzeForAPI.length > 0) {
        // Call the locally defined getAuthHeader
        const authHeaders = await getAuthHeader(); 
        // If getAuthHeader throws, it will be caught by the main catch block.
        // If it can return null and you want to proceed without auth for some calls (not for /api/analysis),
        // you'd handle the null case here. For /api/analysis, auth is required.

        const response = await fetch("/api/analysis", {
          method: "POST",
          headers: authHeaders || { "Content-Type": "application/json" }, // Fallback, though getAuthHeader should throw if token fails
          body: JSON.stringify({ transactions: transactionsToAnalyzeForAPI }),
        });
    
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: `Analysis API HTTP error: ${response.status}` }));
          throw new Error(errorData.error || `Analysis API error: ${response.status}`);
        }
    
        const apiResponse = await response.json() as ApiAnalysisResponse;
        if (!apiResponse || !Array.isArray(apiResponse.transactions)) {
            throw new Error("Invalid API response format from analysis endpoint.");
        }
        
        const apiResultsMap = new Map<string | null, ApiAnalysisResultItem>();
        apiResponse.transactions.forEach((tx: ApiAnalysisResultItem) => {
            apiResultsMap.set(getTransactionIdentifier(tx), tx)
        });

        const newlyAnalyzedFromApi = transactionsToAnalyzeForAPI.map(tx => {
            const originalTxId = getTransactionIdentifier(tx);
            const apiResult = apiResultsMap.get(originalTxId);
            return apiResult ? { ...tx, ...apiResult, plaidTransactionId: tx.plaidTransactionId || apiResult.plaidTransactionId, analyzed: true } : { ...tx, analyzed: false };
        });
        currentProcessedTransactions = mergeTransactions(currentProcessedTransactions, newlyAnalyzedFromApi);
      }
      
      const impactAnalysisResult: ImpactAnalysis = calculationService.calculateImpactAnalysis(
        currentProcessedTransactions,
        userValueSettings
      );

      setAnalyzedData({
        transactions: currentProcessedTransactions,
        totalSocietalDebt: impactAnalysisResult.negativeImpact,
        debtPercentage: impactAnalysisResult.debtPercentage,
        totalPositiveImpact: impactAnalysisResult.positiveImpact,
        totalNegativeImpact: impactAnalysisResult.negativeImpact,
      });
      
      setAnalysisStatus({ status: 'success', error: null });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to analyze transactions';
      console.error('Error analyzing transactions in useTransactionAnalysis:', errorMessage, err);
      setAnalysisStatus({ 
        status: 'error', 
        error: errorMessage
      });
    } finally {
      isAnalyzing.current = false;
    }
  }, [initialTransactions, userValueSettings]);

  return {
    analyzedData,
    analysisStatus,
    analyzeTransactions,
    resetAnalysis
  };
}