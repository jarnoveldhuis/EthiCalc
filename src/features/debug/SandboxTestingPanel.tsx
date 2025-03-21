// src/features/debug/SandboxTestingPanel.tsx
import { useState, useCallback } from 'react';
import { User } from 'firebase/auth';
import { Transaction } from '@/shared/types/transactions';

interface SandboxTestingPanelProps {
  user: User | null;
  onLoadSampleData: (transactions: Transaction[]) => void;
  onClearData: () => Promise<void>;
  isLoading: boolean;
  setFakeConnectionStatus?: (isConnected: boolean) => void;
}

export function SandboxTestingPanel({
  user,
  onLoadSampleData,
  onClearData,
  isLoading,
  setFakeConnectionStatus
}: SandboxTestingPanelProps) {
  const [isResetting, setIsResetting] = useState(false);
  const [loadingSample, setLoadingSample] = useState(false);
  const [loadingSandbox, setLoadingSandbox] = useState(false);

  // Use Plaid Sandbox API
  const fetchFromSandboxAPI = useCallback(async () => {
    if (isLoading || loadingSandbox) return;
    
    setLoadingSandbox(true);
    
    try {
      // Get a sandbox token from the API
      const response = await fetch("/api/banking/sandbox_token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
      
      const { public_token } = await response.json();
      console.log("🏦 Using Plaid Sandbox API with token:", public_token);
      
      // Now fetch transactions using this token
      const txResponse = await fetch("/api/banking/exchange_token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_token }),
      });
      
      if (!txResponse.ok) {
        throw new Error(`Token exchange error: ${txResponse.status}`);
      }
      
      const { access_token } = await txResponse.json();
      
      // Now get transactions with this access token
      const dataResponse = await fetch("/api/banking/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token }),
      });
      
      if (!dataResponse.ok) {
        throw new Error(`Transaction fetch error: ${dataResponse.status}`);
      }
      
      const transactions = await dataResponse.json();
      console.log(`Loaded ${transactions.length} transactions from Plaid Sandbox`);
      
      // Process the transactions
      const processedTransactions = transactions.map((tx: Transaction) => ({
        ...tx,
        analyzed: false,
        societalDebt: 0,
        unethicalPractices: [],
        ethicalPractices: [],
        information: {}
      }));
      
      // Update fake connection status if available
      if (setFakeConnectionStatus) {
        setFakeConnectionStatus(true);
      }
      
      // Send to parent
      onLoadSampleData(processedTransactions);
      
    } catch (error) {
      console.error("Error fetching from Plaid Sandbox:", error);
      alert(`Failed to get sandbox data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoadingSandbox(false);
    }
  }, [isLoading, loadingSandbox, onLoadSampleData, setFakeConnectionStatus]);
  
  // Load direct sample data
  const fetchLocalSampleData = useCallback(async () => {
    if (isLoading || loadingSample) return;
    
    setLoadingSample(true);
    
    try {
      console.log("📋 Fetching local sample transaction data...");
      
      // Use your existing API endpoint that already has sample data handling
      const response = await fetch("/api/banking/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ useSampleData: true }),
      });
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`📋 Loaded ${data.length} sample transactions locally`);
      
      // Process the transactions
      const processedTransactions = data.map((tx: Transaction) => ({
        ...tx,
        analyzed: false,
        societalDebt: 0,
        unethicalPractices: [],
        ethicalPractices: [],
        information: {}
      }));
      
      // Update fake connection status if available
      if (setFakeConnectionStatus) {
        setFakeConnectionStatus(true);
      }
      
      // Pass to parent
      onLoadSampleData(processedTransactions);
      
    } catch (error) {
      console.error("Error loading sample data:", error);
      alert("Failed to load sample data. See console for details.");
    } finally {
      setLoadingSample(false);
    }
  }, [isLoading, loadingSample, onLoadSampleData, setFakeConnectionStatus]);
  
  // Clear all user data
  const resetUserTransactions = useCallback(async () => {
    if (!user || isResetting || isLoading) return;
    
    if (!confirm("This will delete ALL your transaction data from Firebase. Are you sure?")) {
      return;
    }
    
    setIsResetting(true);
    
    try {
      await onClearData();
      
      // Also reset fake connection status if available
      if (setFakeConnectionStatus) {
        setFakeConnectionStatus(false);
      }
      
      alert("Successfully cleared all transaction data!");
      // Force page reload to reset all state
      window.location.reload();
    } catch (error) {
      console.error("Failed to reset transactions:", error);
      alert(`Error clearing transaction data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsResetting(false);
    }
  }, [user, isResetting, isLoading, onClearData, setFakeConnectionStatus]);
  
  return (
    <div className="p-4 border-2 border-yellow-400 rounded-lg bg-yellow-50 my-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-yellow-800">🧪 Sandbox Testing Tools</h2>
        <div className="text-xs text-yellow-700 bg-yellow-200 px-2 py-1 rounded">
          DEV MODE
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <button
          onClick={fetchFromSandboxAPI}
          disabled={isLoading || loadingSandbox || loadingSample || isResetting}
          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded font-medium text-sm disabled:bg-blue-300"
        >
          {loadingSandbox ? "Loading..." : "1. Fetch from Plaid Sandbox API"}
        </button>
        
        <button
          onClick={fetchLocalSampleData}
          disabled={isLoading || loadingSandbox || loadingSample || isResetting}
          className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded font-medium text-sm disabled:bg-green-300"
        >
          {loadingSample ? "Loading..." : "2. Load Local Sample Data"}
        </button>
      </div>
      
      <div className="border-t border-yellow-300 pt-3 mt-3">
        <div className="flex items-center mb-2">
          <div className="h-2 w-2 rounded-full bg-red-500 mr-2"></div>
          <h3 className="text-sm font-semibold text-red-800">Danger Zone</h3>
        </div>
        
        <button
          onClick={resetUserTransactions}
          disabled={isLoading || loadingSandbox || loadingSample || isResetting}
          className="w-full bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded font-medium text-sm disabled:bg-red-300"
        >
          {isResetting ? "Clearing Data..." : "Clear All My Transaction Data"}
        </button>
      </div>
      
      <div className="mt-3 text-xs text-gray-600">
        <div>User ID: {user?.uid || 'Not logged in'}</div>
        <p className="mt-1 text-yellow-700">
          <strong>Note:</strong> These options are only visible in development/sandbox mode.
        </p>
      </div>
    </div>
  );
}