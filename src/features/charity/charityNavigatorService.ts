// src/features/charity/charityNavigatorService.ts
import { CharityNavigatorRating } from './types';
import { config } from '@/config';

interface SearchFacetedResponse {
  data?: {
    publicSearchFaceted?: {
      results?: CharityNavigatorRating[];
    }
  }
}

export const charityNavigatorService = {
  // Lookup a charity by EIN
  async searchByEIN(ein: string): Promise<CharityNavigatorRating | null> {
    try {
      // Normalize EIN format (remove dashes)
      const normalizedEIN = ein.replace(/-/g, '');
      
      console.log(`Searching Charity Navigator for EIN: ${normalizedEIN}`);
      
      // GraphQL query
      const query = `
        query {
          publicSearchFaceted(
            term: "${normalizedEIN}"
            states: []
            sizes: []
            causes: []
            ratings: []
            c3: true
            result_size: 1
            from: 0
            beacons: []
            advisories: []
            order_by: "RELEVANCE"
          ) {
            size
            from
            term
            result_count
            results {
              ein
              name
              mission
              organization_url
              charity_navigator_url
              encompass_score
              encompass_star_rating
              encompass_publication_date
              cause
              highest_level_alert
            }
          }
        }
      `;
      
      // Use the correct authentication method - Authorization header with API key
      const apiUrl = config.charityNavigator?.apiUrl || 'https://api.charitynavigator.org/graphql';
      const apiKey = config.charityNavigator?.apiKey || '';
      
      console.log(`Charity Navigator API URL: ${apiUrl}`);
      console.log(`API Key available: ${apiKey ? 'Yes' : 'No'}`);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': apiKey
        },
        body: JSON.stringify({ query })
      });
      
      console.log(`Charity Navigator API response status: ${response.status}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Charity Navigator API error: ${errorText}`);
        return null;
      }
      
      const responseData = await response.json() as SearchFacetedResponse;
      console.log("Charity Navigator API response received");
      
      if (responseData?.data?.publicSearchFaceted?.results?.length) {
        const charityData = responseData.data.publicSearchFaceted.results[0];
        return charityData;
      }
      
      return null;
    } catch (error) {
      console.error("Error searching Charity Navigator by EIN:", error);
      return null;
    }
  }
};