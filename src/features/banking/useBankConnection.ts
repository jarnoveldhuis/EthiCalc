// src/features/banking/useBankConnection.ts
import { useState, useEffect, useCallback } from 'react';
import { User } from 'firebase/auth';

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
  fetchTransactions: (accessToken: string) => Promise<void>;
}

export function useBankConnection(user: User | null): UseBankConnectionResult {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    isConnected: false,
    isLoading: false,
    error: null
  });

  // Check for existing connection on component mount
  useEffect(() => {
    if (!user) return;
    
    // Check if we have a stored token
    const storedData = localStorage.getItem('plaid_access_token_info');
    if (!storedData) return;
    
    try {
      // Parse the token info
      const tokenInfo = JSON.parse(storedData);
      
      // Verify it belongs to current user
      if (tokenInfo.userId !== user.uid) {
        console.warn("Stored token belongs to a different user");
        localStorage.removeItem('plaid_access_token_info');
        return;
      }
      
      // Verify token isn't too old (30 days)
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      if (Date.now() - tokenInfo.timestamp > thirtyDaysMs) {
        console.warn("Stored token has expired");
        localStorage.removeItem('plaid_access_token_info');
        return;
      }
      
      console.log("Found existing bank connection");
      
      // Set connected state
      setConnectionStatus({
        isConnected: true,
        isLoading: false,
        error: null
      });
      
      // Load transactions using the stored token
      fetchTransactions(tokenInfo.token);
    } catch (error) {
      console.error("Error checking stored token:", error);
      // Clear invalid token
      localStorage.removeItem('plaid_access_token_info');
    }
  }, [user]);
  
  // Function to fetch transactions
  const fetchTransactions = useCallback(async (accessToken: string) => {
    if (!accessToken || !user) return;
    
    try {
      setConnectionStatus(prev => ({
        ...prev,
        isLoading: true,
        error: null
      }));
      
      const response = await fetch('/api/banking/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: accessToken })
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch transactions');
      }
      
      const data = await response.json();
      setTransactions(data);
      
      setConnectionStatus(prev => ({
        ...prev,
        isConnected: true,
        isLoading: false
      }));
    } catch (error) {
      console.error('Error fetching transactions:', error);
      setConnectionStatus(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to load transactions'
      }));
    }
  }, [user]);
  
  // Connect bank function
  const connectBank = useCallback(async (publicToken: string) => {
    if (!user) return;
    
    try {
      setConnectionStatus({
        isConnected: false,
        isLoading: true,
        error: null
      });
      
      // Exchange the public token for an access token
      const response = await fetch('/api/banking/exchange_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ public_token: publicToken })
      });
      
      const data = await response.json();
      
      if (!response.ok || !data.access_token) {
        throw new Error(data.error || 'Failed to exchange token');
      }
      
      // Store the access token securely
      const tokenInfo = {
        token: data.access_token,
        userId: user.uid,
        timestamp: Date.now()
      };
      
      localStorage.setItem('plaid_access_token_info', JSON.stringify(tokenInfo));
      
      // Update connection status
      setConnectionStatus({
        isConnected: true,
        isLoading: false,
        error: null
      });
      
      // Fetch transactions with the new token
      fetchTransactions(data.access_token);
      
    } catch (error) {
      console.error('Error connecting bank:', error);
      setConnectionStatus({
        isConnected: false,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to connect bank'
      });
    }
  }, [user, fetchTransactions]);
  
  // Disconnect bank function - simple and reliable
  const disconnectBank = useCallback(() => {
    // Clear token from all possible storage locations
    localStorage.removeItem('plaid_access_token_info');
    localStorage.removeItem('plaid_token');
    localStorage.removeItem('plaid_access_token');
    sessionStorage.removeItem('plaid_link_token');
    
    // Reset state
    setTransactions([]);
    setConnectionStatus({
      isConnected: false,
      isLoading: false,
      error: null
    });
    
    console.log("Bank disconnected successfully");
  }, []);
  
  return {
    connectionStatus,
    transactions,
    connectBank,
    disconnectBank,
    fetchTransactions
  };
}