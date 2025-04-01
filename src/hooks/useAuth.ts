// src/hooks/useAuth.ts
import { useState, useEffect, useCallback } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { useRouter, usePathname } from 'next/navigation';
import { auth } from '@/core/firebase/firebase';
import { useTransactionStore } from '@/store/transactionStore';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const resetStore = useTransactionStore((state) => state.resetState);
  const router = useRouter();
  const pathname = usePathname();
  
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
      } else {
        setUser(null);
        if (pathname !== '/sign-in' && !loading) {
          router.push('/sign-in');
        }
      }
      setLoading(false);
    });
    
    return () => {
      unsubscribe();
    };
  }, [router, pathname, loading]);
  
  const logout = useCallback(async () => {
    try {
      await signOut(auth);
      
      resetStore();
      
      localStorage.removeItem("plaid_access_token_info");
      sessionStorage.removeItem('wasManuallyDisconnected');
      
      setUser(null);
      setLoading(false);
      router.push('/sign-in');
    } catch (error) {
      console.error("❌ useAuth: Error logging out:", error);
      setUser(null);
      setLoading(false);
      router.push('/sign-in');
    }
  }, [resetStore, router]);
  
  return { user, loading, logout };
}

export default useAuth;