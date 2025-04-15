// src/hooks/useCharityRatings.ts
import { useState, useCallback, useRef } from 'react'; // Import useRef
import { CharityNavigatorRating, CharitySearchResult } from '@/features/charity/types';

interface UseCharityRatingsResult {
  getRating: (charity: CharitySearchResult) => Promise<CharityNavigatorRating | null>;
  isLoading: boolean;
  error: string | null;
}

export function useCharityRatings(): UseCharityRatingsResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Use useRef for the cache so it persists across re-renders without causing dependency issues
  const ratingsCache = useRef(new Map<string, CharityNavigatorRating | null>());

  // FIX: Added ratingsCache.current to dependency array
  const getRating = useCallback(async (charity: CharitySearchResult): Promise<CharityNavigatorRating | null> => {
    if (!charity || !charity.id) {
      return null;
    }

    let ein = charity.id;
    if (ein.includes('ein:')) {
      ein = ein.split(':')[1];
    }
    const einPattern = /^\d{2}-?\d{7}$/;
    if (!einPattern.test(ein)) {
      return null;
    }
    ein = ein.replace(/-/g, ''); // Normalize EIN after validation

    // Check cache using ratingsCache.current
    if (ratingsCache.current.has(ein)) {
      const cachedRating = ratingsCache.current.get(ein);
      // console.log(`Cache hit for ${ein}:`, cachedRating); // Optional debug log
      return cachedRating === undefined ? null : cachedRating;
    }
    // console.log(`Cache miss for ${ein}. Fetching...`); // Optional debug log

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/charity/ratings?ein=${ein}`);

      if (!response.ok) {
        // Handle specific errors like 404 gracefully
        if(response.status === 404) {
             console.log(`No rating found for EIN ${ein} (404).`);
             ratingsCache.current.set(ein, null); // Cache the null result
             return null;
        }
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const rating = data.rating as CharityNavigatorRating | null; // Type assertion

      // Cache the result (rating or null) using ratingsCache.current
      ratingsCache.current.set(ein, rating);
      // console.log(`Workspaceed and cached rating for ${ein}:`, rating); // Optional debug log

      return rating;
    } catch (err) {
      console.error('Error fetching charity rating:', err);
      setError(err instanceof Error ? err.message : 'Failed to load rating');
      // Cache null on error to prevent repeated failed requests for the same EIN in this session
      ratingsCache.current.set(ein, null);
      return null;
    } finally {
      setIsLoading(false);
    }
  // FIX: Add ratingsCache to dependency array - safe because it's a ref's current property
  }, [ratingsCache]);

  return { getRating, isLoading, error };
}