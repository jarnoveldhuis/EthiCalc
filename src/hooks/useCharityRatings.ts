// src/hooks/useCharityRatings.ts
import { useState, useCallback } from 'react';
import { CharityNavigatorRating, CharitySearchResult } from '@/features/charity/types';

interface UseCharityRatingsResult {
  getRating: (charity: CharitySearchResult) => Promise<CharityNavigatorRating | null>;
  isLoading: boolean;
  error: string | null;
}

export function useCharityRatings(): UseCharityRatingsResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ratingsCache = new Map<string, CharityNavigatorRating | null>();
  
  const getRating = useCallback(async (charity: CharitySearchResult): Promise<CharityNavigatorRating | null> => {
    // Skip if no charity or no id
    if (!charity || !charity.id) {
      return null;
    }
    
    // Extract EIN from ID if possible
    let ein = charity.id;
    
    // Some Every.org IDs are structured as "ein:NUMBER"
    if (ein.includes('ein:')) {
      ein = ein.split(':')[1];
    }
    
    // If ein doesn't look like a valid EIN, skip the request
    // EINs are typically 9-digit numbers (sometimes with a dash)
    const einPattern = /^\d{2}-?\d{7}$/;
    if (!einPattern.test(ein)) {
      return null;
    }
    
    // Try to normalize EIN format (remove dashes if present)
    ein = ein.replace(/-/g, '');
    
    // Check cache first
    if (ratingsCache.has(ein)) {
      const cachedRating = ratingsCache.get(ein);
      return cachedRating === undefined ? null : cachedRating;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/charity/ratings?ein=${ein}`);
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      const rating = data.rating;
      
      // Cache the result (even if null)
      ratingsCache.set(ein, rating);
      
      return rating;
    } catch (err) {
      console.error('Error fetching charity rating:', err);
      setError(err instanceof Error ? err.message : 'Failed to load rating');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  return { getRating, isLoading, error };
}