// src/features/debug/FirebaseVerifier.tsx
"use client";

import { useState, useCallback } from 'react';
import { db } from '@/shared/firebase/firebase';
import { collection, getDocs, query, where, orderBy, limit, DocumentData } from 'firebase/firestore';
import { User } from 'firebase/auth';

interface FirebaseVerifierProps {
  user: User | null;
}

interface TransactionBatch {
  id: string;
  userId: string;
  createdAt: Date;
  transactionCount: number;
  totalDebt: number;
}

export function FirebaseVerifier({ user }: FirebaseVerifierProps) {
  const [results, setResults] = useState<TransactionBatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const verifyData = useCallback(async () => {
    if (!user) {
      setError("No user is logged in");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Query the transactionBatches collection for the current user's data
      const q = query(
        collection(db, 'transactionBatches'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc'),
        limit(10) // Get the 10 most recent batches
      );

      console.log(`📊 Checking Firebase for data belonging to user: ${user.uid}`);
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        console.log('⚠️ No transaction batches found in Firebase');
        setResults([]);
        setError("No data found in Firebase for this user");
        setLoading(false);
        return;
      }
      
      // Process the results
      const batchData: TransactionBatch[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data() as DocumentData;
        batchData.push({
          id: doc.id,
          userId: data.userId,
          createdAt: data.createdAt?.toDate() || new Date(),
          transactionCount: data.transactions?.length || 0,
          totalDebt: data.totalSocietalDebt || 0
        });
      });
      
      console.log(`✅ Found ${batchData.length} transaction batches`);
      setResults(batchData);
      
    } catch (err) {
      console.error('❌ Error verifying Firebase data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error checking Firebase');
    } finally {
      setLoading(false);
    }
  }, [user]);

  return (
    <div className="mt-4 p-4 border border-gray-300 rounded bg-gray-50">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-bold text-gray-700">Firebase Data Verifier</h3>
        <button 
          onClick={() => setExpanded(!expanded)}
          className="text-blue-500 text-xs"
        >
          {expanded ? "Hide" : "Show"}
        </button>
      </div>
      
      {expanded && (
        <>
          <div className="mb-3">
            <button
              onClick={verifyData}
              disabled={loading || !user}
              className={`w-full bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded ${
                loading || !user ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {loading ? 'Checking...' : 'Verify Firebase Data'}
            </button>
          </div>
          
          {error && (
            <div className="mb-3 p-2 bg-red-100 text-red-700 rounded text-sm">
              {error}
            </div>
          )}
          
          {results.length > 0 && (
            <div className="mb-3">
              <h4 className="font-semibold text-sm mb-1">Found {results.length} Transaction Batches:</h4>
              <div className="max-h-40 overflow-y-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-200">
                      <th className="p-1 text-left">ID</th>
                      <th className="p-1 text-left">Date</th>
                      <th className="p-1 text-right">Transactions</th>
                      <th className="p-1 text-right">Debt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((batch) => (
                      <tr key={batch.id} className="border-b border-gray-200">
                        <td className="p-1 text-left">{batch.id.substring(0, 6)}...</td>
                        <td className="p-1 text-left">{batch.createdAt.toLocaleString()}</td>
                        <td className="p-1 text-right">{batch.transactionCount}</td>
                        <td className="p-1 text-right">${batch.totalDebt.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          <div className="text-xs text-gray-500">
            <div>User ID: {user?.uid || 'Not logged in'}</div>
            <div>Email: {user?.email || 'N/A'}</div>
          </div>
        </>
      )}
    </div>
  );
}