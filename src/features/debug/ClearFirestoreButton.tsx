// src/features/debug/ClearFirestoreButton.tsx
import { useState } from 'react';
import { User } from 'firebase/auth';
import { db } from '@/core/firebase/firebase';
import { doc, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore';

interface ClearFirestoreButtonProps {
  user: User | null;
  onDataCleared?: () => void;
}

export function ClearFirestoreButton({ user, onDataCleared }: ClearFirestoreButtonProps) {
  const [isClearing, setIsClearing] = useState(false);

  const clearAllData = async () => {
    if (!user) return;
    
    if (!confirm("Are you sure you want to delete all your data?")) return;
    
    setIsClearing(true);
    
    try {
      // 1. Delete transaction batches
      const batchesQuery = query(
        collection(db, 'transactionBatches'),
        where('userId', '==', user.uid)
      );
      
      const querySnapshot = await getDocs(batchesQuery);
      
      const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      
      // 2. Delete credit state
      await deleteDoc(doc(db, "creditState", user.uid));
      
      // 3. Clear local storage
      localStorage.removeItem('plaid_access_token_info');
      
      if (onDataCleared) onDataCleared();
      
      alert('All data cleared successfully. Reload the page to see changes.');
    } catch (error) {
      console.error('Error clearing data:', error);
      alert('Error clearing data');
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <button
      onClick={clearAllData}
      disabled={isClearing || !user}
      className="w-full bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded font-medium text-sm"
    >
      {isClearing ? 'Clearing...' : 'Clear All Data'}
    </button>
  );
}