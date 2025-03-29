// src/store/transactionStore.ts
import { create } from 'zustand';
import { Transaction, AnalyzedTransactionData } from '@/shared/types/transactions';
import { calculationService } from "@/core/calculations/impactService";

// Helper: Get Transaction Identifier (moved from useTransactionAnalysis)
function getTransactionIdentifier(transaction: Transaction): string {
  return `${transaction.date}-${transaction.name}-${transaction.amount}`;
}

// Helper: Get Access Token Info from localStorage
function getAccessTokenInfo(): { token: string; userId: string; timestamp: number } | null {
  try {
    const storedData = localStorage.getItem("plaid_access_token_info");
    if (!storedData) return null;
    return JSON.parse(storedData);
  } catch (error) {
    console.error("Error retrieving stored token:", error);
    localStorage.removeItem("plaid_access_token_info"); // Clear potentially corrupted data
    return null;
  }
}

interface TransactionState {
  // --- State from useBankConnection ---
  bankTransactions: Transaction[];
  isBankConnected: boolean; // Renamed from isConnected in hook
  isBankConnecting: boolean; // Renamed from isLoading in hook
  bankConnectionError: string | null; // Renamed from error in hook
  // Note: Access token is managed via localStorage, not stored directly in Zustand state

  // --- State from useTransactionAnalysis ---
  analyzedTransactions: Transaction[]; // Holds the results after analysis API call
  analysisData: AnalyzedTransactionData | null; // Summary data (totals, etc.)
  isAnalyzing: boolean; // Renamed from status === 'loading'
  analysisError: string | null; // Renamed from error in analysisStatus

  // --- Actions ---

  // Simple Setters (Internal use primarily)
  _setBankTransactions: (transactions: Transaction[]) => void;
  _setAnalyzedTransactions: (transactions: Transaction[]) => void;
  _setAnalysisData: (data: AnalyzedTransactionData | null) => void;
  _setIsBankConnected: (isConnected: boolean) => void;
  _setIsBankConnecting: (isConnecting: boolean) => void;
  _setBankConnectionError: (error: string | null) => void;
  _setIsAnalyzing: (isAnalyzing: boolean) => void;
  _setAnalysisError: (error: string | null) => void;

  // --- Complex Actions (Public API of the store) ---

  // Bank Connection Actions
  initializeBankConnection: (userId: string) => Promise<void>; // Check storage on load
  connectBank: (publicToken: string, userId: string) => Promise<void>;
  disconnectBank: () => void;
  fetchTransactions: (accessToken?: string, isManual?: boolean) => Promise<void>; // Combined fetch logic

  // Analysis Actions
  analyzeBankTransactions: () => Promise<void>; // Analyze transactions currently in bankTransactions

  // Utility Actions
  resetState: () => void; // Reset everything
}

const initialState = {
  bankTransactions: [],
  isBankConnected: false,
  isBankConnecting: false,
  bankConnectionError: null,
  analyzedTransactions: [],
  analysisData: null,
  isAnalyzing: false,
  analysisError: null,
};

export const useTransactionStore = create<TransactionState>((set, get) => ({
  ...initialState,

  // --- Simple Setters ---
  _setBankTransactions: (transactions) => set({ bankTransactions: transactions }),
  _setAnalyzedTransactions: (transactions) => set({ analyzedTransactions: transactions }),
  _setAnalysisData: (data) => set({ analysisData: data }),
  _setIsBankConnected: (isConnected) => set({ isBankConnected: isConnected }),
  _setIsBankConnecting: (isConnecting) => set({ isBankConnecting: isConnecting }),
  _setBankConnectionError: (error) => set({ bankConnectionError: error }),
  _setIsAnalyzing: (isAnalyzing) => set({ isAnalyzing: isAnalyzing }),
  _setAnalysisError: (error) => set({ analysisError: error }),

  // --- Complex Actions ---

  // Checks storage and fetches if a valid token exists for the user
  initializeBankConnection: async (userId) => {
    const tokenInfo = getAccessTokenInfo();
    if (tokenInfo && tokenInfo.userId === userId) {
      set({ isBankConnected: true, isBankConnecting: true, bankConnectionError: null });
      console.log("Existing connection found for user, fetching transactions...");
      try {
        await get().fetchTransactions(tokenInfo.token);
        // FetchTransactions updates loading/error state internally
      } catch (error) {
        console.error("Error during initial transaction fetch:", error);
        // fetchTransactions handles setting the error state
      } finally {
         // Ensure loading is false if fetch failed immediately or succeeded
         // fetchTransactions handles the loading=false on success/retry exhaustion
         // We only need to handle the case where the initial check throws before fetchTransactions starts
         if(get().isBankConnecting && !get().bankConnectionError) {
             set({isBankConnecting: false});
         }
      }
    } else if (tokenInfo && tokenInfo.userId !== userId) {
        console.warn("Stored token belongs to a different user. Clearing.");
        localStorage.removeItem("plaid_access_token_info");
        set({ isBankConnected: false });
    } else {
        set({ isBankConnected: false });
    }
  },

  // Exchanges public token, stores access token, fetches transactions
  connectBank: async (publicToken, userId) => {
    set({ isBankConnecting: true, isBankConnected: false, bankConnectionError: null, bankTransactions: [] }); // Reset relevant state
    try {
      console.log("Exchanging public token...");
      const response = await fetch("/api/banking/exchange_token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_token: publicToken }),
      });
      const data = await response.json();

      if (!response.ok || !data.access_token) {
        throw new Error(data.error || "Failed to exchange token");
      }
      const accessToken = data.access_token;
      console.log("Access token received.");

      const tokenInfo = { token: accessToken, userId: userId, timestamp: Date.now() };
      localStorage.setItem("plaid_access_token_info", JSON.stringify(tokenInfo));
      console.log("Access token saved to localStorage.");

      set({ isBankConnected: true }); // Connection successful before fetching

      console.log("Fetching initial transactions...");
      await get().fetchTransactions(accessToken); // Fetch transactions using the new token
       // fetchTransactions handles the loading/error state internally

    } catch (error) {
      console.error("Error connecting bank:", error);
      const errorMsg = error instanceof Error ? error.message : "Failed to connect bank";
      set({ bankConnectionError: errorMsg, isBankConnecting: false, isBankConnected: false });
      localStorage.removeItem("plaid_access_token_info"); // Clean up if connection failed
    } finally {
        // Ensure loading is false if not handled by fetchTransactions (e.g., exchange fails)
        if (get().isBankConnecting) {
             set({ isBankConnecting: false });
        }
    }
  },

  // Fetches transactions using a token (either provided or from storage)
  fetchTransactions: async (accessToken, isManual = false) => {
    let tokenToUse = accessToken;
    const MAX_RETRIES = 2;
    const RETRY_DELAY = 3000; // 3 seconds

    if (!tokenToUse) {
      const tokenInfo = getAccessTokenInfo();
      if (tokenInfo) {
        tokenToUse = tokenInfo.token;
      } else {
        console.error("Fetch transactions: No access token available.");
        set({ bankConnectionError: "No access token available", isBankConnecting: false, isBankConnected: false });
        return;
      }
    }

    // Use a loop for retries
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
       set({ isBankConnecting: true, bankConnectionError: null }); // Set loading true for each attempt
       if(attempt > 0) {
           set({ bankConnectionError: `Connection issue, retrying... (${attempt}/${MAX_RETRIES})`});
           await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
       }

      try {
        console.log(`Fetching transactions (Attempt ${attempt + 1})`);
        const response = await fetch("/api/banking/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ access_token: tokenToUse }),
        });

        console.log("Fetch response status:", response.status);
        if (!response.ok) {
          // Specific Plaid error handling could go here if needed
          throw new Error(`Failed to fetch transactions: ${response.status}`);
        }

        const data = await response.json();
        console.log("Transactions data received:", data ? typeof data : "null");

        if (Array.isArray(data)) {
           // Plaid might return an empty array initially while processing. Retry if so.
           if (data.length === 0 && attempt < MAX_RETRIES) {
               console.log(`Received empty transactions array. Retrying...`);
               set({ bankConnectionError: `Waiting for transactions (attempt ${attempt + 1})...` });
               // Continue to next iteration after delay
               continue;
           }

          // Success (or empty after retries)
          set({
            bankTransactions: data,
            isBankConnecting: false,
            isBankConnected: true, // Still connected even if no transactions
            bankConnectionError: data.length === 0 && isManual ? "No new transactions found." : null,
          });
          console.log(`Successfully fetched ${data.length} transactions.`);
          return; // Exit retry loop on success

        } else if (data.error) {
          throw new Error(data.error); // Throw API-reported error
        } else {
          throw new Error("Invalid response format from transactions endpoint.");
        }

      } catch (error) {
        console.error(`Error fetching transactions (Attempt ${attempt + 1}):`, error);
        const errorMsg = error instanceof Error ? error.message : "Unknown error fetching transactions";

        // If this is the last attempt, set the final error state
        if (attempt === MAX_RETRIES) {
          set({ bankConnectionError: errorMsg, isBankConnecting: false });
           // Decide if we should consider the bank disconnected on persistent fetch errors
           // set({ isBankConnected: false }); // Optional: Mark as disconnected on failure
          return; // Exit loop after final attempt fails
        }
        // Otherwise, the error message will be updated for the next retry loop message
         set({ bankConnectionError: errorMsg }); // Show error temporarily between retries
      }
    }
  },

  // Clears token and resets bank-related state
  disconnectBank: () => {
    console.log("Disconnecting bank and clearing token...");
    localStorage.removeItem("plaid_access_token_info");
    // Reset only bank-related state, keep analysis if needed? Or full reset?
    // Let's reset bank state for now.
    set({
      bankTransactions: [],
      isBankConnected: false,
      isBankConnecting: false,
      bankConnectionError: null,
      // Decide if analysis state should also be cleared on disconnect
      // analyzedTransactions: [],
      // analysisData: null,
      // analysisError: null,
    });
    console.log("Bank disconnected.");
  },

  // Analyzes the current bank transactions
  analyzeBankTransactions: async () => {
    const bankTransactions = get().bankTransactions;
    const analyzedTransactions_current = get().analyzedTransactions; // Get potentially already analyzed ones

    if (!bankTransactions.length) {
      console.log("No bank transactions to analyze.");
      set({ analysisData: null, analyzedTransactions: [], analysisError: null }); // Clear analysis if bank tx are empty
      return;
    }

    // Filter out transactions that are already marked as analyzed in analyzedTransactions
    const analyzedIds = new Set(
        analyzedTransactions_current
            .filter(tx => tx.analyzed)
            .map(getTransactionIdentifier)
    );

    const transactionsToAnalyze = bankTransactions.filter(
        tx => !analyzedIds.has(getTransactionIdentifier(tx))
    );


    if (transactionsToAnalyze.length === 0) {
      console.log("All bank transactions are already analyzed.");
      // Ensure analysisData is consistent if nothing new was analyzed
       if (!get().analysisData && analyzedTransactions_current.length > 0) {
           const finalTransactions = analyzedTransactions_current; // Already merged/up-to-date
           const totalSocietalDebt = calculationService.calculateNetSocietalDebt(finalTransactions);
           const totalPositiveImpact = calculationService.calculatePositiveImpact(finalTransactions);
           const totalNegativeImpact = calculationService.calculateNegativeImpact(finalTransactions);
           const debtPercentage = calculationService.calculateDebtPercentage(finalTransactions);
           set({
               analysisData: {
                   transactions: finalTransactions,
                   totalSocietalDebt,
                   debtPercentage,
                   totalPositiveImpact,
                   totalNegativeImpact
               },
               isAnalyzing: false,
               analysisError: null,
           });
       } else {
           set({ isAnalyzing: false, analysisError: null }); // Ensure loading is off
       }
      return;
    }

    console.log(`Analyzing ${transactionsToAnalyze.length} new transactions...`);
    set({ isAnalyzing: true, analysisError: null });

    try {
      const response = await fetch("/api/analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactions: transactionsToAnalyze }),
      });

      if (!response.ok) {
        throw new Error(`Analysis API error: ${response.status}`);
      }

      // IMPORTANT: Assume the API response ONLY contains the analyzed versions
      // of the transactions *sent* to it.
      const analysisApiResponse = await response.json() as { transactions: Transaction[] }; // Assuming this structure based on hook usage

      // Create a map of the newly analyzed transactions
       const newlyAnalyzedMap = new Map<string, Transaction>();
       analysisApiResponse.transactions.forEach((tx) => {
           const identifier = getTransactionIdentifier(tx);
           newlyAnalyzedMap.set(identifier, {
               ...tx,
               analyzed: true // Explicitly mark as analyzed
           });
       });

       // Merge:
       // 1. Start with existing analyzed transactions.
       // 2. Update/add the newly analyzed ones.
       // 3. Add any original bank transactions that were neither already analyzed nor newly analyzed (shouldn't happen with current logic but safe).
       const finalAnalyzedTransactions = bankTransactions.map(bankTx => {
            const identifier = getTransactionIdentifier(bankTx);
            if (newlyAnalyzedMap.has(identifier)) {
                return newlyAnalyzedMap.get(identifier)!; // Use newly analyzed version
            }
            if (analyzedIds.has(identifier)) {
                 // Find the existing analyzed version from the store state before this run
                 return analyzedTransactions_current.find(atx => getTransactionIdentifier(atx) === identifier) || bankTx; // Fallback to bankTx if missing (edge case)
            }
            return bankTx; // Keep original bank transaction if it wasn't analyzed
       });


      // Recalculate summary data using the final merged list
      const totalSocietalDebt = calculationService.calculateNetSocietalDebt(finalAnalyzedTransactions);
      const totalPositiveImpact = calculationService.calculatePositiveImpact(finalAnalyzedTransactions);
      const totalNegativeImpact = calculationService.calculateNegativeImpact(finalAnalyzedTransactions);
      const debtPercentage = calculationService.calculateDebtPercentage(finalAnalyzedTransactions);

      set({
        analyzedTransactions: finalAnalyzedTransactions,
        analysisData: {
          transactions: finalAnalyzedTransactions, // Store the complete list here as well
          totalSocietalDebt,
          debtPercentage,
          totalPositiveImpact,
          totalNegativeImpact,
        },
        isAnalyzing: false,
        analysisError: null,
      });
      console.log("Analysis successful.");

    } catch (err) {
      console.error('Error analyzing transactions:', err);
      const errorMsg = err instanceof Error ? err.message : 'Failed to analyze transactions';
      set({ analysisError: errorMsg, isAnalyzing: false });
    }
  },

  // Resets the entire store state
  resetState: () => set(initialState),
}));

// Optional: Export the initial state if needed elsewhere
export { initialState as transactionInitialState };