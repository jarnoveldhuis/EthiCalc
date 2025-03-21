// src/features/charity/api/searchCharities.ts

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

// Helper to clean text of emojis
function cleanText(text: string): string {
  return text
    .replace(/[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
    .trim();
}

// Helper to extract slug from URL
function extractSlug(url: string): string | null {
  if (!url) return null;
  
  try {
    // Try to extract slug from URL
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(Boolean);
    if (pathParts.length > 0) {
      return pathParts[pathParts.length - 1];
    }
  } catch {
    // If URL parsing fails, try a simple regex extraction
    const match = url.match(/\/([^\/]+)\/?$/);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
}

export async function searchCharitiesHandler(req: NextRequest) {
  try {
    // Get search query from URL parameters
    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get("query");
    
    if (!query) {
      return NextResponse.json(
        { error: "Missing search query" },
        { status: 400 }
      );
    }
    
    // Clean query
    const cleanQuery = cleanText(query);
      
    if (!cleanQuery) {
      // If query is empty after cleaning, return empty results
      return NextResponse.json({ charities: [] });
    }
    
    console.log(`Charity search for: "${cleanQuery}"`);
    
    try {
      // Call the Every.org API
      const apiUrl = `${config.charity.baseUrl}/search/${encodeURIComponent(cleanQuery)}?apiKey=${config.charity.apiKey}&take=10`;
      console.log(`Calling Every.org API: ${apiUrl}`);
      
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        console.error(`API error: ${response.status}`);
        return NextResponse.json({ charities: [] });
      }
      
      // Check content type
      const contentType = response.headers.get('content-type');
      
      if (!contentType || !contentType.includes('application/json')) {
        console.error(`Received non-JSON response: ${contentType}`);
        return NextResponse.json({ charities: [] });
      }
      
      // Parse response as JSON
      const data = await response.json() as EveryOrgResponse;
      
      // Fallback to empty array if nonprofits is missing
      if (!data.nonprofits || !Array.isArray(data.nonprofits)) {
        console.warn("API response missing nonprofits array");
        return NextResponse.json({ charities: [] });
      }
      
      // Transform the response to our desired format
      const charities = data.nonprofits.map((charity: EveryOrgNonprofit) => {
        // Extract slug from profile URL if available
        const slug = charity.slug || (charity.profileUrl ? extractSlug(charity.profileUrl) : null);
        
        return {
          id: charity.ein || charity.id || "",
          name: charity.name || "Unknown Charity",
          url: charity.profileUrl || (slug ? `https://www.every.org/${slug}` : "https://www.every.org"),
          slug: slug,
          mission: charity.description || "No description available",
          category: charity.tags?.[0] || "Charity",
          logoUrl: charity.logoUrl,
          // Use slug format for donation URL if available
          donationUrl: slug 
            ? `https://www.every.org/${slug}/donate` 
            : charity.ein 
              ? `https://www.every.org/ein/${charity.ein}/donate`
              : `https://www.every.org/donate`
        };
      });
      
      return NextResponse.json({ charities });
    } catch (apiError) {
      console.error("API request failed:", apiError);
      // Return empty results instead of error
      return NextResponse.json({ charities: [] });
    }
  } catch (error) {
    console.error("Charity search error:", error);
    // Return empty results as a fallback
    return NextResponse.json({ charities: [] }, { status: 200 });
  }
}