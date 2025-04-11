// src/features/charity/charityService.ts
import { CharitySearchResult, EnrichedCharityResult } from './types';

// Helper to clean practice names by removing emojis and trimming whitespace
export function cleanPracticeName(practice: string): string {
  return practice
    .replace(/[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
    .trim();
}

// Search for charities by cause or keyword
export async function searchCharities(query: string): Promise<CharitySearchResult[]> {
  try {
    const cleanQuery = cleanPracticeName(query);
    
    if (!cleanQuery) {
      return [];
    }
    
    // Use our own API endpoint to avoid exposing API key in client code
    const response = await fetch(
      `/api/charity/search?query=${encodeURIComponent(cleanQuery)}`
    );
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.charities || [];
  } catch {
    return []; // Return empty array instead of throwing
  }
}

// Get recommended charities for a specific practice
export async function getRecommendedCharities(practice: string): Promise<CharitySearchResult[]> {
  try {
    // Use our API route to get recommendations
    const response = await fetch(
      `/api/charity/recommend?practice=${encodeURIComponent(practice)}`
    );
    
    if (!response.ok) {
      return []; // Return empty array instead of throwing
    }
    
    const data = await response.json();
    
    if (!data.charities || !Array.isArray(data.charities)) {
      return [];
    }
    
    return data.charities || [];
  } catch {
    return []; // Return empty array instead of throwing
  }
}

export async function getRecommendedCharitiesWithRatings(practice: string): Promise<EnrichedCharityResult[]> {
  try {
    // First get recommended charities from Every.org
    const everyOrgCharities = await getRecommendedCharities(practice);
    
    if (!everyOrgCharities.length) {
      return [];
    }
    
    // For top 3 charities, try to get ratings
    const charityPromises = everyOrgCharities.slice(0, 3).map(async (charity) => {
      // Extract EIN if available
      let ein = charity.id;
      if (ein.includes('ein:')) {
        ein = ein.split(':')[1];
      }
      
      // Validate EIN format before making the request
      const einPattern = /^\d{2}-?\d{7}$/;
      if (!einPattern.test(ein)) {
        return { ...charity, cnRating: null };
      }
      
      try {
        const response = await fetch(`/api/charity/ratings?ein=${ein}`);
        if (response.ok) {
          const data = await response.json();
          return {
            ...charity,
            cnRating: data.rating
          };
        }
        return { ...charity, cnRating: null };
      } catch {
        return { ...charity, cnRating: null };
      }
    });
    
    const enrichedCharities = await Promise.all(charityPromises);
    
    // Sort charities by ratings (if available)
    return enrichedCharities.sort((a, b) => {
      // If both have ratings, sort by score
      if (a.cnRating?.encompass_score && b.cnRating?.encompass_score) {
        return b.cnRating.encompass_score - a.cnRating.encompass_score;
      }
      
      // Prioritize charities with ratings
      if (a.cnRating?.encompass_score) return -1;
      if (b.cnRating?.encompass_score) return 1;
      
      // Keep original order for unrated charities
      return 0;
    });
  } catch {
    // Fallback to original recommendations if rating lookup fails
    return getRecommendedCharities(practice).then(charities => 
      charities.map(charity => ({ ...charity, cnRating: null }))
    );
  }
}

// Create a donation URL for the given charity and amount
export function createDonationUrl(charityId: string, amount: number, cause?: string): string {
  try {
    // Clean the cause/practice name if provided
    const cleanCause = cause ? cleanPracticeName(cause) : undefined;
    
    // Determine if this is an EIN (tax ID) by checking format
    const isEin = /^\d{2}-\d{7}$/.test(charityId);
    
    // Extract the slug if the charityId looks like a URL
    let slug = charityId;
    if (charityId.includes('/')) {
      // If the ID is a URL, extract the last part as the slug
      slug = charityId.split('/').pop() || '';
    }
    
    // Build the base URL correctly based on what we have
    let baseUrl;
    if (isEin) {
      // Use the EIN format
      baseUrl = `https://www.every.org/ein/${charityId}/donate`;
    } else if (slug && slug !== 'everydotorg' && slug !== 'donate') {
      // Use the slug format if we have a valid slug
      baseUrl = `https://www.every.org/${slug}/donate`;
    } else {
      // Fallback to generic donation page
      baseUrl = `https://www.every.org/donate`;
    }
    
    // Build query parameters
    const params = new URLSearchParams();
    
    // Add amount
    params.append('amount', Math.max(1, Math.round(amount)).toString());
    
    // Add tracking parameters
    params.append('utm_source', 'mordebt-app');
    params.append('utm_medium', 'web');
    
    // Add cause/designation if we have it
    if (cleanCause) {
      params.append('designation', cleanCause);
    }
    
    // Construct final URL
    return `${baseUrl}?${params.toString()}`;
  } catch {
    // Fallback to a simple donation URL
    return `https://www.every.org/donate?amount=${Math.max(1, Math.round(amount))}&utm_source=mordebt-app`;
  }
}