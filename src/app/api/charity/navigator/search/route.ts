// src/app/api/charity/navigator/search/route.ts
import { NextRequest, NextResponse } from "next/server";
import { config } from "@/config";
// Define an interface for the expected shape of items in the GraphQL results array
interface GraphQLCharityResult {
  ein: string;
  name: string;
  mission?: string;
  websiteUrl?: string; // Field alias used in query
  charityNavigatorUrl?: string; // Field alias used in query
  score?: string | number | null;
  ratingStars?: string | number | null;
  cause?: string | null;
  // Add other fields returned by your GraphQL query if needed
}

export async function GET(req: NextRequest) {
  console.log(
    "--- SERVER HIT (GraphQL Simplified Query): /api/charity/navigator/search ---"
  );

  try {
    const searchParams = req.nextUrl.searchParams;
    const term = searchParams.get("term");

    if (!term) {
      console.error("API Route Error: Missing search term");
      return NextResponse.json(
        { error: "Missing search term" },
        { status: 400 }
      );
    }
    console.log(`API Route Info: Received search term: "${term}"`);

    const apiUrl = config.charityNavigator?.apiUrl;
    const apiKey = config.charityNavigator?.apiKey;
    console.log(
      `API Route Info: CN GraphQL URL: ${apiUrl}, Key available: ${!!apiKey}`
    );

    if (!apiUrl || !apiKey) {
      console.error(
        "API Route Error: Charity Navigator GraphQL URL or API key is missing."
      );
      return NextResponse.json(
        { error: "API configuration error on server" },
        { status: 500 }
      );
    }

    // *** SIMPLIFIED GraphQL Query ***
    // Removed hardcoded filters like states, causes, c3, etc.
    const graphqlQuery = `
      query PublicSearch($searchTerm: String!, $pageSize: Int!) {
        publicSearchFaceted(
          term: $searchTerm
          result_size: $pageSize
          from: 0
          order_by: "RATING_DESC" # Keep sorting by rating
        ) {
          size
          from
          term
          result_count
          results {
            ein
            name
            mission
            websiteUrl: organization_url
            charityNavigatorUrl: charity_navigator_url
            score: encompass_score
            ratingStars: encompass_star_rating
            cause: cause
          }
        }
      }
    `;

    const variables = {
      searchTerm: term,
      pageSize: 10,
    };

    // Use Authorization header (assuming this is correct from previous steps)
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: apiKey,
      // Add other headers like X-App-ID if confirmed necessary
    };
    console.log("API Route Info: Using GraphQL headers:", {
      Authorization: "***" /* Add others if needed */,
    });

    // Make the GraphQL API call (POST request)
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: headers,
      body: JSON.stringify({
        query: graphqlQuery,
        variables: variables,
      }),
    });

    console.log(
      `API Route Info: External CN GraphQL API response status: ${response.status}`
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `API Route Error: External Charity Navigator GraphQL fetch failed (${response.status}): ${errorText}`
      );
      // Try to parse error JSON if possible
      let errorJson = {};
      try {
        errorJson = JSON.parse(errorText);
      } catch {}

      if (response.status === 400) {
        // Provide more specific validation error if available
        return NextResponse.json(
          {
            error: `Charity Navigator Validation Failed (400)`,
            details: errorJson,
          },
          { status: 400 } // Return 400 from our API too
        );
      }
      if (response.status === 401 || response.status === 403) {
        return NextResponse.json(
          {
            error: `Charity Navigator Auth Failed (${response.status})`,
            details: "Verify API Key/Headers.",
          },
          { status: 401 }
        );
      }
      return NextResponse.json(
        {
          error: `Failed to get data from Charity Navigator (${response.status})`,
          details: errorText,
        },
        { status: 502 }
      );
    }

    // Try parsing the JSON response
    let responseData;
    try {
      responseData = await response.json();
      console.log(
        "API Route Info: Successfully parsed JSON response from GraphQL API."
      );
    } catch (parseError) {
      console.error(
        "API Route Error: Failed to parse JSON from GraphQL API:",
        parseError
      );
      return NextResponse.json(
        { error: "Invalid JSON format from Charity Navigator" },
        { status: 502 }
      );
    }

    // Extract results safely
    const results = responseData?.data?.publicSearchFaceted?.results;
    if (!Array.isArray(results)) {
      console.error(
        "API Route Error: GraphQL response format invalid or missing results. Response:",
        responseData
      );
      return NextResponse.json(
        {
          error: "Unexpected data structure from Charity Navigator GraphQL API",
        },
        { status: 502 }
      );
    }
    console.log(
      `API Route Info: Received ${results.length} results from GraphQL API.`
    );

    // Transform data
    const charities = results.map((charity: GraphQLCharityResult) => {
      // FIX: Explicitly convert to string before parseFloat
      const scoreNum = charity.score ? parseFloat(String(charity.score)) : NaN;
      const starsNum = charity.ratingStars
        ? parseFloat(String(charity.ratingStars))
        : NaN;
      return {
        ein: charity.ein,
        name: charity.name,
        mission: charity.mission,
        websiteUrl: charity.websiteUrl,
        charityNavigatorUrl: charity.charityNavigatorUrl,
        score: !isNaN(scoreNum) ? scoreNum : null,
        ratingStars: !isNaN(starsNum) ? starsNum : null,
        cause: charity.cause ?? null,
        hasAdvisories: false,
      };
    });
    console.log(`API Route Info: Transformed ${charities.length} charities.`);

    return NextResponse.json({ charities });
  } catch (error) {
    console.error(
      "API Route Error: Unexpected error in GraphQL GET handler:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error processing charity GraphQL search" },
      { status: 500 }
    );
  }
}
