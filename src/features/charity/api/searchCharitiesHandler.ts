// src/features/charity/api/searchCharitiesHandler.ts

import { NextRequest, NextResponse } from "next/server";
import { z } from 'zod'; // Import Zod
import { config } from "@/config";
import { errorResponse } from '@/shared/utils/api'; // Import standardized error response

// --- Zod Schema for Query Params ---
const SearchQuerySchema = z.object({
  query: z.string().min(1, "Missing search query"), // Ensure query is present
});
// --- End Zod Schema ---


// Interfaces (remain the same)
interface EveryOrgNonprofit {
  ein?: string;
  id?: string;
  name: string;
  profileUrl?: string;
  slug?: string;
  description?: string;
  tags?: string[];
  logoUrl?: string;
  websiteUrl?: string;
}
interface EveryOrgResponse {
  nonprofits?: EveryOrgNonprofit[];
}

// Helpers (remain the same)
function cleanText(text: string): string {
  return text
    .replace(/[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
    .trim();
}
function extractSlug(url: string): string | null {
   if (!url) return null;
   try {
     const urlObj = new URL(url);
     const pathParts = urlObj.pathname.split('/').filter(Boolean);
     return pathParts.length > 0 ? pathParts[pathParts.length - 1] : null;
   } catch {
     const match = url.match(/\/([^\/]+)\/?$/);
     return match?.[1] || null;
   }
}


export async function searchCharitiesHandler(req: NextRequest) {
  try {
    // 1. Extract Search Params
    const searchParams = req.nextUrl.searchParams;
    const paramsObject = Object.fromEntries(searchParams.entries());

    // 2. Validate Query Params with Zod
    const validationResult = SearchQuerySchema.safeParse(paramsObject);

    if (!validationResult.success) {
      console.error("GET /api/charity/search: Validation failed", validationResult.error.flatten());
      // Use standardized error response with Zod details
      const queryError = validationResult.error.flatten().fieldErrors.query?.[0];
      return errorResponse(queryError || "Invalid query parameters", 400, validationResult.error.flatten());
    }

    // Use validated 'query'
    const { query } = validationResult.data;

    // 3. Core Logic (remains mostly the same)
    const cleanQuery = cleanText(query);
    if (!cleanQuery) {
       // Return empty array if query becomes empty after cleaning
      return NextResponse.json({ charities: [] });
    }

    console.log(`Charity search for: "${cleanQuery}"`);

    try {
      const apiUrl = `${config.charity.baseUrl}/search/${encodeURIComponent(cleanQuery)}?apiKey=${config.charity.apiKey}&take=10`;
      console.log(`Calling Every.org API: ${apiUrl}`);
      const response = await fetch(apiUrl);

      if (!response.ok) {
        console.error(`API error: ${response.status}`);
        // Fallback to empty array, but could return errorResponse(..., 502)
        return NextResponse.json({ charities: [] });
      }
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
         console.error(`Received non-JSON response: ${contentType}`);
         // Fallback to empty array, but could return errorResponse(..., 502)
         return NextResponse.json({ charities: [] });
      }

      const data = await response.json() as EveryOrgResponse;
      if (!data.nonprofits || !Array.isArray(data.nonprofits)) {
        console.warn("API response missing nonprofits array");
        return NextResponse.json({ charities: [] });
      }

      // Transform response (remains the same)
      const charities = data.nonprofits.map((charity: EveryOrgNonprofit) => {
         const slug = charity.slug || (charity.profileUrl ? extractSlug(charity.profileUrl) : null);
         return {
           id: charity.ein || charity.id || "",
           name: charity.name || "Unknown Charity",
           url: charity.profileUrl || (slug ? `https://www.every.org/${slug}` : "https://www.every.org"),
           slug: slug,
           mission: charity.description || "No description available",
           category: charity.tags?.[0] || "Charity",
           logoUrl: charity.logoUrl,
           donationUrl: slug ? `https://www.every.org/${slug}/donate` : charity.ein ? `https://www.every.org/ein/${charity.ein}/donate` : `https://www.every.org/donate`,
           websiteUrl: charity.websiteUrl || undefined
         };
       });

      return NextResponse.json({ charities });
    } catch (apiError) {
      console.error("API request failed:", apiError);
      // Use standardized error response for API failures
      return errorResponse("Failed to fetch data from Every.org", 502, apiError instanceof Error ? apiError.message : 'Unknown API error');
    }
  } catch (error) {
    // 4. General Error Handling
    console.error("Charity search error:", error);
     // Use standardized error response
     return errorResponse("Internal server error during charity search", 500, error instanceof Error ? error.message : 'Unknown server error');
  }
}