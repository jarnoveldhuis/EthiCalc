// src/features/charity/types.ts
export interface CharityNavigatorRating {
    ein: string;
    name: string;
    mission?: string;
    websiteUrl?: string;
    charityNavigatorUrl?: string;
    score?: number | null;
    ratingStars?: number | null;
    cause?: string;
    hasAdvisories?: boolean;
  }
  
  // Existing interface for charity search results
  export interface CharitySearchResult {
    id: string;
    name: string;
    url: string;
    mission: string;
    category: string;
    logoUrl?: string;
    donationUrl?: string;
    slug?: string;
    websiteUrl?: string;
  }
  
  // Extended interface with Charity Navigator rating
  export interface EnrichedCharityResult extends CharitySearchResult {
    cnRating?: CharityNavigatorRating | null;
  }