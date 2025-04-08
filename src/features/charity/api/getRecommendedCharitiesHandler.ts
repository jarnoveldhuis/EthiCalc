// src/features/charity/api/getRecommendedCharities.ts

import { NextRequest, NextResponse } from "next/server";
import { config } from "@/config";

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
    
    try {
      // Call the Every.org API
      const apiUrl = `${config.charity.baseUrl}/search/${encodeURIComponent(searchTerm)}?apiKey=${config.charity.apiKey}&take=5`;
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        return NextResponse.json({ 
          charities: []
        });
      }
      
      // Parse response
      const data: EveryOrgResponse = await response.json();
      
      // Transform the response to our desired format
      const charities = data.nonprofits?.map((charity: EveryOrgNonprofit) => {
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
          donationUrl: slug ? `https://www.every.org/${slug}/donate` : charity.ein ? `https://www.every.org/ein/${charity.ein}/donate` : `https://www.every.org/donate`,
          websiteUrl: charity.websiteUrl || undefined // <-- MAP THE FIELD HERE
        };
      }) || [];

      
      return NextResponse.json({ charities });
    } catch {
      return NextResponse.json({ charities: [] });
    }
  } catch {
    return NextResponse.json({ charities: [] }, { status: 200 });
  }
}