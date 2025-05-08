// src/app/api/charity/navigator/search/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from 'zod'; // Import Zod
import { config } from "@/config";
import { errorResponse } from '@/shared/utils/api'; // Import standardized error response

// --- Zod Schema for Query Params ---
const NavigatorSearchQuerySchema = z.object({
  term: z.string().min(1, "Missing search term"), // Ensure term is present
});
// --- End Zod Schema ---


// Interface (remains same)
interface GraphQLCharityResult {
  ein: string;
  name: string;
  mission?: string;
  websiteUrl?: string;
  charityNavigatorUrl?: string;
  score?: string | number | null;
  ratingStars?: string | number | null;
  cause?: string | null;
}

export async function GET(req: NextRequest) {


  try {
    // 1. Extract Search Params
    const searchParams = req.nextUrl.searchParams;
    const paramsObject = Object.fromEntries(searchParams.entries());

    // 2. Validate Query Params with Zod
    const validationResult = NavigatorSearchQuerySchema.safeParse(paramsObject);

    if (!validationResult.success) {
      console.error("GET /api/charity/navigator/search: Validation failed", validationResult.error.flatten());
      // Use standardized error response with Zod details
      const termError = validationResult.error.flatten().fieldErrors.term?.[0];
      return errorResponse(termError || "Invalid query parameters", 400, validationResult.error.flatten());
    }

    // Use validated 'term'
    const { term } = validationResult.data;

    // 3. Core Logic (GraphQL call - remains mostly the same)
    const apiUrl = config.charityNavigator?.apiUrl;
    const apiKey = config.charityNavigator?.apiKey;
    if (!apiUrl || !apiKey) {
      console.error("API Route Error: Charity Navigator GraphQL URL or API key is missing.");
       // Use standardized error response
       return errorResponse("API configuration error on server", 500);
    }

    const graphqlQuery = `
      query PublicSearch($searchTerm: String!, $pageSize: Int!) {
        publicSearchFaceted(
          term: $searchTerm, result_size: $pageSize, from: 0, order_by: "RATING_DESC"
        ) {
          results { ein, name, mission, websiteUrl: organization_url, charityNavigatorUrl: charity_navigator_url, score: encompass_score, ratingStars: encompass_star_rating, cause }
        }
      }
    `;
    const variables = { searchTerm: term, pageSize: 10 };
    const headers: HeadersInit = {
      "Content-Type": "application/json", Accept: "application/json", Authorization: apiKey,
    };

    const response = await fetch(apiUrl, {
      method: "POST", headers: headers, body: JSON.stringify({ query: graphqlQuery, variables: variables }),
    });


    if (!response.ok) {
        const errorText = await response.text();
        console.error(`API Route Error: External Charity Navigator GraphQL fetch failed (${response.status}): ${errorText}`);
        let errorJson = {}; try { errorJson = JSON.parse(errorText); } catch {}
        let status = 502; // Bad Gateway default
        let message = `Failed to get data from Charity Navigator (${response.status})`;
        if (response.status === 400) { status = 400; message = `Charity Navigator Validation Failed (400)`; }
        if (response.status === 401 || response.status === 403) { status = 401; message = `Charity Navigator Auth Failed (${response.status})`; }
        // Use standardized error response
        return errorResponse(message, status, errorJson);
    }

    let responseData;
    try {
      responseData = await response.json();
    } catch (parseError) {
      console.error("API Route Error: Failed to parse JSON from GraphQL API:", parseError);
       // Use standardized error response
       return errorResponse("Invalid JSON format from Charity Navigator", 502);
    }

    const results = responseData?.data?.publicSearchFaceted?.results;
    if (!Array.isArray(results)) {
      console.error("API Route Error: GraphQL response format invalid or missing results.");
       // Use standardized error response
       return errorResponse("Unexpected data structure from Charity Navigator GraphQL API", 502);
    }

    // Transform data (remains same)
    const charities = results.map((charity: GraphQLCharityResult) => {
      const scoreNum = charity.score ? parseFloat(String(charity.score)) : NaN;
      const starsNum = charity.ratingStars ? parseFloat(String(charity.ratingStars)) : NaN;
      return {
        ein: charity.ein, name: charity.name, mission: charity.mission,
        websiteUrl: charity.websiteUrl, charityNavigatorUrl: charity.charityNavigatorUrl,
        score: !isNaN(scoreNum) ? scoreNum : null,
        ratingStars: !isNaN(starsNum) ? starsNum : null,
        cause: charity.cause ?? null, hasAdvisories: false,
      };
    });

    return NextResponse.json({ charities });

  } catch (error) {
    // 4. General Error Handling
    console.error("API Route Error: Unexpected error in GraphQL GET handler:", error);
     // Use standardized error response
     return errorResponse("Internal server error processing charity GraphQL search", 500, error instanceof Error ? error.message : 'Unknown server error');
  }
}