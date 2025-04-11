// src/app/api/charity/ratings/route.ts
import { NextRequest, NextResponse } from "next/server";
import { charityNavigatorService } from "@/features/charity/charityNavigatorService";


export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const ein = searchParams.get("ein");
    
    if (!ein) {
      return NextResponse.json(
        { error: "Missing EIN parameter" }, 
        { status: 400 }
      );
    }
    
    // Validate EIN format
    const einPattern = /^\d{2}-?\d{7}$/;
    if (!einPattern.test(ein)) {
      return NextResponse.json(
        { error: "Invalid EIN format. EIN should be a 9-digit number" },
        { status: 400 }
      );
    }
    
    const rating = await charityNavigatorService.searchByEIN(ein);
    
    // Return successful response even if rating is null
    return NextResponse.json({ rating });
  } catch (error) {
    console.error("Charity ratings error:", error);
    
    // Check if it's an authorization error
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const isAuthError = 
      errorMessage.includes("401") || 
      errorMessage.includes("auth") || 
      errorMessage.includes("credentials");
    
    if (isAuthError) {
      return NextResponse.json(
        { 
          error: "Unable to access Charity Navigator API. Authentication failed.",
          details: "Please check API credentials in environment variables." 
        },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: "Failed to get charity ratings" },
      { status: 500 }
    );
  }
}