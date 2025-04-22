// src/features/charity/api/getRecommendedCharitiesHandler.ts

import { NextRequest, NextResponse } from "next/server";
import { z } from 'zod'; // Import Zod
import { config } from "@/config";
import { errorResponse } from '@/shared/utils/api'; // Import standardized error response

// --- Zod Schema for Query Params ---
const RecommendQuerySchema = z.object({
  practice: z.string().min(1, "Missing practice parameter"), // Ensure practice is present
});
// --- End Zod Schema ---


// Helper (remains same)
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

// Interfaces (remain same)
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


export async function getRecommendedCharitiesHandler(req: NextRequest) {
  try {
    // 1. Extract Search Params
    const searchParams = req.nextUrl.searchParams;
    const paramsObject = Object.fromEntries(searchParams.entries());

    // 2. Validate Query Params with Zod
    const validationResult = RecommendQuerySchema.safeParse(paramsObject);

    if (!validationResult.success) {
      console.error("GET /api/charity/recommend: Validation failed", validationResult.error.flatten());
      // Use standardized error response with Zod details
      const practiceError = validationResult.error.flatten().fieldErrors.practice?.[0];
      return errorResponse(practiceError || "Invalid query parameters", 400, validationResult.error.flatten());
    }

    // Use validated 'practice'
    const { practice } = validationResult.data;


    // 3. Core Logic (remains mostly the same)
    const cleanPractice = practice
      .replace(/[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
      .trim();

    const searchTermMap: Record<string, string> = {
      "Factory Farming": "animal welfare",
      "Excessive Packaging": "environment",
      "Labor Exploitation": "fair trade",
      "High Emissions": "climate",
      "Environmental Degradation": "conservation",
      "Animal Testing": "animal rights",
      "Water Waste": "water conservation",
      "Resource Depletion": "sustainability",
      "Data Privacy Issues": "digital rights",
      "High Energy Usage": "renewable energy",
      "All Societal Debt": "climate",
    };
    let searchTerm = searchTermMap[cleanPractice] || cleanPractice;
    if (!searchTerm) {
      searchTerm = "charity";
    }

    try {
      const apiUrl = `${config.charity.baseUrl}/search/${encodeURIComponent(searchTerm)}?apiKey=${config.charity.apiKey}&take=5`;
      const response = await fetch(apiUrl);

      if (!response.ok) {
        console.error(`Every.org API error for recommend: ${response.status}`);
        // Fallback to empty array, but could return errorResponse(..., 502)
        return NextResponse.json({ charities: [] });
      }

      const data: EveryOrgResponse = await response.json();
      const charities = data.nonprofits?.map((charity: EveryOrgNonprofit) => {
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
       }) || [];

      return NextResponse.json({ charities });

    } catch (apiError) {
       console.error("Recommend API request failed:", apiError);
      // Use standardized error response for API failures
       return errorResponse("Failed to fetch recommendations from Every.org", 502, apiError instanceof Error ? apiError.message : 'Unknown API error');
    }
  } catch (error) {
    // 4. General Error Handling
    console.error("Charity recommend error:", error);
    // Use standardized error response
    return errorResponse("Internal server error during charity recommendation", 500, error instanceof Error ? error.message : 'Unknown server error');
  }
}