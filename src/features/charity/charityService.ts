// src/features/charity/charityService.ts

// Helper function for logging
function logDebug(message: string, data?: unknown) {
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG_CHARITY === 'true') {
      console.log(`[Charity Service] ${message}`, data || '');
    }
  }
  
  // Helper to clean practice names by removing emojis and trimming whitespace
  export function cleanPracticeName(practice: string): string {
    return practice
      .replace(/[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
      .trim();
  }
  
  export interface CharitySearchResult {
    id: string;
    name: string;
    url: string;
    mission: string;
    category: string;
    logoUrl?: string;
    donationUrl?: string;
    slug?: string;  // Added slug for direct URL construction
  }
  
  // Search for charities by cause or keyword
  export async function searchCharities(query: string): Promise<CharitySearchResult[]> {
    try {
      const cleanQuery = cleanPracticeName(query);
      logDebug(`Searching for charities with query: ${cleanQuery}`);
      
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
      logDebug(`Found ${data.charities?.length || 0} charities`);
      
      return data.charities || [];
    } catch (error) {
      console.error("Charity search error:", error);
      return []; // Return empty array instead of throwing
    }
  }
  
  // Get charity details by ID
  export async function getCharityById(id: string): Promise<CharitySearchResult | null> {
    try {
      // Use our own API endpoint to avoid exposing API key in client code
      const response = await fetch(
        `/api/charity/details?id=${encodeURIComponent(id)}`
      );
      
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      return data.charity || null;
    } catch (error) {
      console.error("Charity details error:", error);
      return null; // Return null instead of throwing
    }
  }
  
  // Get recommended charities for a specific practice
  export async function getRecommendedCharities(practice: string): Promise<CharitySearchResult[]> {
    try {
      const cleanPractice = cleanPracticeName(practice);
        
      // For the "All Societal Debt" case, use "environment" as the search term
      const searchTerm = cleanPractice === "All Societal Debt" ? "environment" : cleanPractice;
      
      logDebug(`Getting recommended charities for: ${searchTerm}`);
      
      // Use our API route to get recommendations
      const response = await fetch(
        `/api/charity/recommend?practice=${encodeURIComponent(practice)}`
      );
      
      if (!response.ok) {
        return []; // Return empty array instead of throwing
      }
      
      const data = await response.json();
      return data.charities || [];
    } catch (error) {
      console.error("Charity recommendation error:", error);
      return []; // Return empty array instead of throwing
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
      const finalUrl = `${baseUrl}?${params.toString()}`;
      
      logDebug(`Created donation URL: ${finalUrl} (charityId: ${charityId})`);
      
      return finalUrl;
    } catch (error) {
      console.error("Error creating donation URL:", error);
      // Fallback to a simple donation URL
      return `https://www.every.org/donate?amount=${Math.max(1, Math.round(amount))}&utm_source=mordebt-app`;
    }
  }