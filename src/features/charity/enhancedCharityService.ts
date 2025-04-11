// src/features/charity/enhancedCharityService.ts
import {
  CharityNavigatorRating,
  CharitySearchResult,
  EnrichedCharityResult,
} from "./types";
import { searchCharities } from "./charityService";

// Helper function to parse score safely (handles strings, nulls, undefined)
const parseScore = (score: string | number | null | undefined): number => {
  if (typeof score === "number") {
    return !isNaN(score) ? score : -1;
  }
  if (typeof score === "string") {
    const parsed = parseFloat(score);
    return !isNaN(parsed) ? parsed : -1;
  }
  return -1;
};

export const enhancedCharityService = {
  // getTopRatedCharitiesFromNavigator function (keep as is)
  async getTopRatedCharitiesFromNavigator(
    searchTerm: string
  ): Promise<CharityNavigatorRating[]> {
    try {
      console.log(`Searching Charity Navigator (GraphQL) for: "${searchTerm}"`);
      // Use the API route that calls GraphQL
      const response = await fetch(
        `/api/charity/navigator/search?term=${encodeURIComponent(searchTerm)}`
      );

      if (!response.ok) {
        // Log the error status but don't throw, allow fallback
        console.warn(`Charity Navigator search failed: ${response.status}`);
        return []; // Return empty array on failure
      }

      const data = await response.json();
      return data.charities || [];
    } catch (error) {
      console.error(
        "Error getting top-rated charities from Navigator API route:",
        error
      );
      return []; // Return empty array on error
    }
  },

  // findMatchingEveryOrgCharity function (keep as is)
  async findMatchingEveryOrgCharity(
    cnCharity: CharityNavigatorRating
  ): Promise<CharitySearchResult | null> {
    // ... (keep existing implementation)
    try {
      let everyOrgMatch: CharitySearchResult | null = null;
      if (cnCharity.ein) {
        const einResults = await searchCharities(cnCharity.ein);
        if (einResults.length > 0) {
          if (einResults[0].id?.includes(cnCharity.ein.replace(/-/g, ""))) {
            console.log(
              `Found Every.org match by EIN for ${cnCharity.name}: ${einResults[0].name}`
            );
            everyOrgMatch = einResults[0];
          }
        }
      }
      if (!everyOrgMatch && cnCharity.name) {
        const nameResults = await searchCharities(cnCharity.name);
        if (nameResults.length > 0) {
          console.log(
            `Found potential Every.org match by name for ${cnCharity.name}: ${nameResults[0].name}`
          );
          everyOrgMatch = nameResults[0];
        }
      }
      return everyOrgMatch;
    } catch (error) {
      console.error(
        `Error finding Every.org match for ${cnCharity.name}:`,
        error
      );
      return null;
    }
  },

  // Main function: Get top-rated charities available on Every.org
  async getTopRatedCharitiesWithPaymentLinks(searchTerm: string, limit = 5): Promise<EnrichedCharityResult[]> {
    // Pass the desired limit to the navigator search function if needed, or handle slicing later
    const topRatedCNCharities = await this.getTopRatedCharitiesFromNavigator(searchTerm); // Removed unused limit argument passed here

    let finalResults: EnrichedCharityResult[] = [];

    if (!topRatedCNCharities.length) {
      console.log(
        "No highly-rated charities found via Navigator, falling back to Every.org direct search."
      );
      const everyOrgResults = await searchCharities(searchTerm);
      // Enrich fallback results with ratings if possible
      finalResults = await Promise.all(
        everyOrgResults.slice(0, limit).map(async (eoCharity) => {
          let cnRating: CharityNavigatorRating | null = null;
          if (eoCharity.id?.startsWith("ein:")) {
            const ein = eoCharity.id.split(":")[1];
            // Use the service that fetches ratings by EIN
            const ratingData = await fetch(`/api/charity/ratings?ein=${ein}`);
            if (ratingData.ok) {
              const ratingJson = await ratingData.json();
              // Assume ratingJson.rating contains the rating object or null
              // Ensure the structure matches CharityNavigatorRating type
              if (ratingJson.rating && typeof ratingJson.rating === "object") {
                cnRating = {
                  ein: ratingJson.rating.ein || ein,
                  name: ratingJson.rating.name || eoCharity.name,
                  mission: ratingJson.rating.mission,
                  websiteUrl:
                    ratingJson.rating.websiteUrl ||
                    ratingJson.rating.websiteURL, // Handle potential casing
                  charityNavigatorUrl:
                    ratingJson.rating.charityNavigatorUrl ||
                    ratingJson.rating.charityNavigatorURL, // Handle potential casing
                  score: ratingJson.rating.score ?? null,
                  ratingStars:
                    ratingJson.rating.ratingStars ??
                    ratingJson.rating.rating ??
                    null, // Handle potential field names
                  cause:
                    ratingJson.rating.cause ||
                    ratingJson.rating.category?.categoryName, // Handle potential field names
                  hasAdvisories: ratingJson.rating.hasAdvisories ?? false,
                };
              }
            }
          }
          return { ...eoCharity, cnRating };
        })
      );
    } else {
        const enrichedResultsMap = new Map<string, EnrichedCharityResult>();
        for (const cnCharity of topRatedCNCharities) {
            // Use the limit passed to this function here
            if (enrichedResultsMap.size >= limit) break;

            const everyOrgMatch = await this.findMatchingEveryOrgCharity(cnCharity);
            const einKey = cnCharity.ein?.replace(/-/g, '');

            if (everyOrgMatch && einKey && !enrichedResultsMap.has(einKey)) {
                enrichedResultsMap.set(einKey, {
                    ...everyOrgMatch,
                    cnRating: cnCharity
                });
            }
        }
         finalResults = Array.from(enrichedResultsMap.values());
    }

    // *** ADD EXPLICIT SORTING HERE ***
    finalResults.sort((a, b) => {
      // Use the helper function to safely parse scores, treating invalid/missing as -1
      const scoreA = parseScore(a.cnRating?.score);
      const scoreB = parseScore(b.cnRating?.score);

      // Sort primarily by score descending
      if (scoreB !== scoreA) {
        return scoreB - scoreA;
      }
      // Secondary sort: prioritize those with any rating over those without
      if (a.cnRating && !b.cnRating) return -1;
      if (!a.cnRating && b.cnRating) return 1;
      // Tertiary sort: alphabetically by name
      return a.name.localeCompare(b.name);
    });

    console.log(
      `enhancedCharityService: Returning ${finalResults.length} sorted results.`
    );
    // Return the explicitly sorted results, ensuring the first item is the highest rated
    return finalResults;
  },
};
