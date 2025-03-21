import { useState, useEffect } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { auth } from '@/shared/firebase/firebase';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      
      // Redirect to sign-in if no user and not already on sign-in page
      if (!currentUser && window.location.pathname !== '/signin') {
        router.push('/signin');
      }
    });
    
    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, [router]);
  
  const logout = async () => {
    try {
      setLoading(true);
      await signOut(auth);
      router.push('/signin');
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setLoading(false);
    }
  };
  
  return { user, loading, logout };
}