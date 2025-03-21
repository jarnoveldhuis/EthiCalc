// src/features/banking/useBankConnection.ts
import { useState, useEffect, useCallback } from "react";
import { User } from "firebase/auth";

interface Transaction {
  date: string;
  name: string;
  amount: number;
}

interface ConnectionStatus {
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
}

interface UseBankConnectionResult {
  connectionStatus: ConnectionStatus;
  transactions: Transaction[];
  connectBank: (publicToken: string) => Promise<void>;
  disconnectBank: () => void;
  fetchTransactions: (accessToken?: string) => Promise<void>;
  manuallyFetchTransactions: () => Promise<void>;
}

export function useBankConnection(user: User | null, firebaseLoadingComplete = true): UseBankConnectionResult {
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    isConnected: false,
    isLoading: false,
    error: null,
  });

  // Check for existing connection on component mount
  // Fixing the missing dependency in useEffect
  // Look for this effect in useBankConnection.ts
  // Function to fetch transactions with retry capability
  const fetchTransactions = useCallback(
    async (accessToken?: string, retryCount = 0) => {
      if (!user) return;

      const MAX_RETRIES = 2; // Number of automatic retries
      const RETRY_DELAY = 3000; // Delay between retries in ms

      // If no access token provided, try to get it from storage
      let token = accessToken;
      if (!token) {
        try {
          const storedData = localStorage.getItem("plaid_access_token_info");
          if (!storedData) {
            console.error("No access token provided and none found in storage");
            setConnectionStatus((prev) => ({
              ...prev,
              error: "No access token available",
            }));
            return;
          }

          const tokenInfo = JSON.parse(storedData);
          if (tokenInfo.userId !== user.uid) {
            console.warn("Stored token belongs to a different user");
            setConnectionStatus((prev) => ({
              ...prev,
              error: "Invalid access token",
            }));
            return;
          }

          token = tokenInfo.token;
        } catch (error) {
          console.error("Error retrieving stored token:", error);
          setConnectionStatus((prev) => ({
            ...prev,
            error: "Failed to retrieve access token",
          }));
          return;
        }
      }

      try {
        console.log(
          `Starting to fetch transactions (attempt ${
            retryCount + 1
          }) with token:`,
          token ? token.substring(0, 5) + "..." : "undefined"
        );

        setConnectionStatus((prev) => ({
          ...prev,
          isLoading: true,
          error: null,
        }));

        const response = await fetch("/api/banking/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ access_token: token }),
        });

        console.log("Fetch response status:", response.status);

        if (!response.ok) {
          throw new Error(`Failed to fetch transactions: ${response.status}`);
        }

        const data = await response.json();

        console.log(
          "Transactions response:",
          data ? typeof data : "null",
          Array.isArray(data) ? `(${data.length} items)` : ""
        );

        // Handle successful transaction fetch
        if (Array.isArray(data)) {
          // If we get an empty array but we're still on early retry attempts,
          // it might be because Plaid needs more time to prepare the transactions
          if (data.length === 0 && retryCount < MAX_RETRIES) {
            console.log(
              `Received empty transactions array. Retrying in ${
                RETRY_DELAY / 1000
              } seconds...`
            );

            // Set a brief loading message but keep isLoading true
            setConnectionStatus((prev) => ({
              ...prev,
              isConnected: true,
              isLoading: true,
              error: `Waiting for transactions (attempt ${retryCount + 1})...`,
            }));

            // Wait before retrying
            await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));

            // Try again with incremented retry count
            return fetchTransactions(token, retryCount + 1);
          }

          // Otherwise accept the result, even if it's empty
          setTransactions(data);

          setConnectionStatus((prev) => ({
            ...prev,
            isConnected: true,
            isLoading: false,
            error:
              data.length === 0
                ? "Connected, but no transactions were found"
                : null,
          }));
        } else if (data.error) {
          throw new Error(data.error);
        } else {
          throw new Error("Invalid response format");
        }
      } catch (error) {
        console.error(
          `Error fetching transactions (attempt ${retryCount + 1}):`,
          error
        );

        // Decide whether to retry
        if (retryCount < MAX_RETRIES) {
          console.log(`Will retry in ${RETRY_DELAY / 1000} seconds...`);

          // Set a brief loading message but keep isLoading true
          setConnectionStatus((prev) => ({
            ...prev,
            isLoading: true,
            error: `Connection issue, retrying... (${retryCount + 1}/${
              MAX_RETRIES + 1
            })`,
          }));

          // Wait before retrying
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));

          // Try again with incremented retry count
          return fetchTransactions(token, retryCount + 1);
        }

        // If we've exhausted retries, update the status with the error
        setConnectionStatus((prev) => ({
          ...prev,
          isLoading: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to load transactions",
        }));
      }
    },
    [user]
  );
  // Check for existing connection on component mount
  useEffect(() => {
    if (!user) return;
    
    // Check if we have a stored token
    const storedData = localStorage.getItem("plaid_access_token_info");
    if (!storedData) return;
    
    try {
      // Parse the token info
      const tokenInfo = JSON.parse(storedData);
      
      // Verify it belongs to current user
      if (tokenInfo.userId !== user.uid) {
        console.log("Stored token belongs to a different user");
        localStorage.removeItem("plaid_access_token_info");
        return;
      }
      
      // Set connected state REGARDLESS of loading state
      setConnectionStatus(prev => ({
        ...prev,
        isConnected: true,
        // Don't override loading status if it's already true
        isLoading: prev.isLoading 
      }));
      
      // Only fetch transactions if we haven't loaded them yet
      if (transactions.length === 0 && !connectionStatus.isLoading) {
        fetchTransactions(tokenInfo.token);
      }
    } catch (error) {
      console.error("Error checking stored token:", error);
    }
  }, [user, fetchTransactions, transactions.length, connectionStatus.isLoading]);

  // Function to manually fetch transactions using stored token
  const manuallyFetchTransactions = useCallback(async () => {
    if (!user) {
      console.error("Cannot manually fetch: No user is logged in");
      return;
    }

    try {
      console.log("Attempting manual transaction fetch");
      const storedData = localStorage.getItem("plaid_access_token_info");

      if (!storedData) {
        console.error("No stored access token found");
        throw new Error(
          "No bank connection found. Please connect your bank first."
        );
      }

      const tokenInfo = JSON.parse(storedData);
      console.log(
        "Manually fetching transactions with token from localStorage"
      );

      await fetchTransactions(tokenInfo.token);
      console.log("Manual fetch completed successfully");
    } catch (error) {
      console.error("Manual fetch error:", error);
      throw error; // Re-throw so the caller can handle it
    }
  }, [user, fetchTransactions, firebaseLoadingComplete]);

  // Connect bank function
  const connectBank = useCallback(
    async (publicToken: string) => {
      if (!user) return;

      try {
        setConnectionStatus({
          isConnected: false,
          isLoading: true,
          error: null,
        });

        // Exchange the public token for an access token
        console.log("Exchanging public token for access token");
        const response = await fetch("/api/banking/exchange_token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ public_token: publicToken }),
        });

        const data = await response.json();

        if (!response.ok || !data.access_token) {
          throw new Error(data.error || "Failed to exchange token");
        }

        console.log("Successfully received access token");

        // Store the access token securely
        const tokenInfo = {
          token: data.access_token,
          userId: user.uid,
          timestamp: Date.now(),
        };

        localStorage.setItem(
          "plaid_access_token_info",
          JSON.stringify(tokenInfo)
        );
        console.log("Access token saved to localStorage");

        // Update connection status
        setConnectionStatus({
          isConnected: true,
          isLoading: false,
          error: null,
        });

        // Fetch transactions with the new token
        console.log("Initiating transaction fetch with new token");
        await fetchTransactions(data.access_token);
      } catch (error) {
        console.error("Error connecting bank:", error);
        setConnectionStatus({
          isConnected: false,
          isLoading: false,
          error:
            error instanceof Error ? error.message : "Failed to connect bank",
        });
      }
    },
    [user, fetchTransactions]
  );

  // Disconnect bank function - simple and reliable
  const disconnectBank = useCallback(() => {
    // Clear token from all possible storage locations
    localStorage.removeItem("plaid_access_token_info");
    localStorage.removeItem("plaid_token");
    localStorage.removeItem("plaid_access_token");
    sessionStorage.removeItem("plaid_link_token");

    // Reset state
    setTransactions([]);
    setConnectionStatus({
      isConnected: false,
      isLoading: false,
      error: null,
    });

    console.log("Bank disconnected successfully");
  }, []);

  return {
    connectionStatus,
    transactions,
    connectBank,
    disconnectBank,
    fetchTransactions,
    manuallyFetchTransactions,
  };
}
