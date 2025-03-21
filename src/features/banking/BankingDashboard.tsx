// src/features/banking/BankingDashboard.tsx
import { useCallback } from 'react';
import { useAuth } from '@/shared/hooks/useAuth';
import { useBankConnection } from './useBankConnection';
import { LoadingSpinner } from '@/shared/components/ui/LoadingSpinner';
import { Header } from '@/shared/components/Header';
import PlaidLink from './PlaidLink';

export function BankingDashboard() {
  const { user, logout } = useAuth();
  const { 
    connectionStatus, 
    transactions, 
    connectBank, 
    disconnectBank 
  } = useBankConnection(user);
  
  // Handle Plaid success
  const handlePlaidSuccess = useCallback(async (publicToken: string) => {
    console.log("Received public token:", publicToken);
    await connectBank(publicToken);
  }, [connectBank]);
  
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-4xl mx-auto p-4">
        {/* Header with disconnect button */}
        <Header 
          user={user} 
          onLogout={logout}
          onDisconnectBank={disconnectBank}
          isBankConnected={connectionStatus.isConnected}
        />
        
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-2xl font-bold mb-4">Banking Dashboard</h1>
          
          {/* Connection Status & Plaid Link */}
          {connectionStatus.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner message="Processing your bank connection..." />
            </div>
          ) : connectionStatus.isConnected ? (
            <div className="bg-green-50 border border-green-200 rounded p-4 mb-4">
              <p className="text-green-800 font-semibold">Successfully connected to your bank account</p>
              <p className="text-green-600 text-sm mt-1">
                You can now view your transactions and get personalized insights.
              </p>
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded p-6 text-center">
              <h2 className="text-xl font-semibold mb-3">Connect Your Bank Account</h2>
              <p className="text-gray-600 mb-4">
                Connect your bank account to see your transactions and get personalized insights.
              </p>
              
              <PlaidLink onSuccess={handlePlaidSuccess} />
              
              {connectionStatus.error && (
                <p className="mt-4 text-red-600">
                  Error: {connectionStatus.error}
                </p>
              )}
            </div>
          )}
        </div>
        
        {/* Transactions */}
        {connectionStatus.isConnected && transactions.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Your Transactions</h2>
            
            <div className="border rounded overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {transactions.map((tx, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{tx.date}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{tx.name}</td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${tx.amount >= 100 ? 'text-red-600' : 'text-gray-900'}`}>
                        ${tx.amount.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {transactions.length > 0 && (
              <p className="text-sm text-gray-600 mt-4">
                Showing {transactions.length} transactions from your connected account.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}