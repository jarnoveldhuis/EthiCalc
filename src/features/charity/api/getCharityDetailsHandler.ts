// src/features/charity/api/getCharityDetails.ts

import { NextRequest, NextResponse } from "next/server";
import { config } from "@/config";

interface CharityDetails {
  id: string;
  name: string;
  url: string;
  mission: string;
  category: string;
  logoUrl?: string;
  donationUrl: string | null;
}

interface NonprofitResponse {
  nonprofit?: {
    ein?: string;
    id?: string;
    name: string;
    profileUrl?: string;
    slug?: string;
    description?: string;
    tags?: string[];
    logoUrl?: string;
  };
}

export async function getCharityDetailsHandler(req: NextRequest) {
  try {
    // Get charity ID from URL parameters
    const searchParams = req.nextUrl.searchParams;
    const id = searchParams.get("id");
    
    if (!id) {
      return NextResponse.json(
        { error: "Missing charity ID" },
        { status: 400 }
      );
    }
    
    // Call the Every.org API
    const response = await fetch(
      `${config.charity.baseUrl}/nonprofit/${id}?apiKey=${config.charity.apiKey}`
    );
    
    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: "Charity not found" },
          { status: 404 }
        );
      }
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json() as NonprofitResponse;
    const charity = data.nonprofit;
    
    if (!charity) {
      return NextResponse.json(
        { error: "Charity data missing" },
        { status: 404 }
      );
    }
    
    // Transform the response to our desired format
    const charityDetails: CharityDetails = {
      id: charity.ein || charity.id || "",
      name: charity.name,
      url: charity.profileUrl || `https://www.every.org/${charity.slug}`,
      mission: charity.description || "No description available",
      category: charity.tags?.[0] || "Charity",
      logoUrl: charity.logoUrl,
      donationUrl: charity.profileUrl ? `${charity.profileUrl}/donate` : null
    };
    
    return NextResponse.json({ charity: charityDetails });
  } catch (error) {
    console.error("Charity details error:", error);
    return NextResponse.json(
      { error: "Failed to get charity details" },
      { status: 500 }
    );
  }
}