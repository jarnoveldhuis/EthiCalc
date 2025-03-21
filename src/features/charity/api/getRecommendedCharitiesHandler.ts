// src/features/charity/api/getRecommendedCharities.ts

import { NextRequest, NextResponse } from "next/server";
import { config } from "@/config";

interface EveryOrgNonprofit {
  ein?: string;
  id?: string;
  name: string;
  profileUrl?: string;
  slug?: string;
  description?: string;
  tags?: string[];
  logoUrl?: string;
}

interface EveryOrgResponse {
  nonprofits?: EveryOrgNonprofit[];
}

export async function getRecommendedCharitiesHandler(req: NextRequest) {
  // Get practice from URL parameters
  const searchParams = req.nextUrl.searchParams;
  const practice = searchParams.get("practice");

  try {
    if (!practice) {
      return NextResponse.json(
        { error: "Missing practice parameter" },
        { status: 400 }
      );
    }
    
    // Clean practice name - remove emojis and trim whitespace
    const cleanPractice = practice
      .replace(/[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
      .trim();
    
    // Map common practices to relevant search terms
    const searchTermMap: Record<string, string> = {
      // Unethical practices and their charity categories
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
      
      // Special cases
      "All Societal Debt": "climate",
    };
    
    // Get the appropriate search term
    let searchTerm = searchTermMap[cleanPractice] || cleanPractice;
    
    // If search term is empty after cleaning, use a generic term
    if (!searchTerm) {
      searchTerm = "charity";
    }
    
    console.log(`Charity recommendation for practice "${practice}" using search term "${searchTerm}"`);
    
    try {
      // Call the Every.org API
      const apiUrl = `${config.charity.baseUrl}/search/${encodeURIComponent(searchTerm)}?apiKey=${config.charity.apiKey}&take=5`;
      console.log(`Calling Every.org API: ${apiUrl}`);
      
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        console.error(`API error: ${response.status}`);
        // Fall back to empty results instead of throwing an error
        return NextResponse.json({ 
          practice,
          searchTerm,
          charities: []
        });
      }
      
      // Check content type
      const contentType = response.headers.get('content-type');
      console.log(`Received content type: ${contentType}`);
      
      // Parse based on content type
      const data: EveryOrgResponse = await response.json();
      
      // Transform the response to our desired format
      const charities = data.nonprofits?.map((charity: EveryOrgNonprofit) => ({
        id: charity.ein || charity.id || "",
        name: charity.name,
        url: charity.profileUrl || `https://www.every.org/${charity.slug}`,
        mission: charity.description || "No description available",
        category: charity.tags?.[0] || "Charity",
        logoUrl: charity.logoUrl,
        donationUrl: charity.profileUrl ? `${charity.profileUrl}/donate` : null
      })) || [];
      
      return NextResponse.json({ 
        practice,
        searchTerm,
        charities 
      });
    } catch (apiError) {
      console.error("API request failed:", apiError);
      // Return empty results instead of error
      return NextResponse.json({ 
        practice,
        searchTerm,
        charities: []
      });
    }
  } catch (error) {
    console.error("Charity recommendation error:", error);
    return NextResponse.json({ 
      practice: practice || "Unknown",
      charities: []
    }, { status: 200 });
  }
}