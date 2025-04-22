// src/app/api/charity/ratings/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from 'zod'; // Import Zod
import { charityNavigatorService } from "@/features/charity/charityNavigatorService";
import { errorResponse } from '@/shared/utils/api'; // Import standardized error response

// --- Zod Schema for Query Params ---
const RatingsQuerySchema = z.object({
  ein: z.string()
    .min(1, "Missing EIN parameter") // Ensure it's not empty
    .regex(/^\d{2}-?\d{7}$/, "Invalid EIN format. Must be 9 digits (e.g., 12-3456789 or 123456789)"), // Validate format
});
// --- End Zod Schema ---


export async function GET(req: NextRequest) {
  try {
    // 1. Extract Search Params
    const searchParams = req.nextUrl.searchParams;
    const paramsObject = Object.fromEntries(searchParams.entries());

    // 2. Validate Query Params with Zod
    const validationResult = RatingsQuerySchema.safeParse(paramsObject);

    if (!validationResult.success) {
      console.error("GET /api/charity/ratings: Validation failed", validationResult.error.flatten());
      // Use standardized error response with Zod details
      // Get the specific EIN error message if available
      const einError = validationResult.error.flatten().fieldErrors.ein?.[0];
      return errorResponse(einError || "Invalid query parameters", 400, validationResult.error.flatten());
    }

    // Use validated 'ein'
    const { ein } = validationResult.data;

    // 3. Core Logic (Call the service)
    const rating = await charityNavigatorService.searchByEIN(ein);

    // Return successful response even if rating is null
    return NextResponse.json({ rating });

  } catch (error) {
    // 4. Error Handling (remains mostly the same)
    console.error("Charity ratings error:", error);

    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const isAuthError =
      errorMessage.includes("401") ||
      errorMessage.includes("auth") ||
      errorMessage.includes("credentials");

    if (isAuthError) {
      // Use standardized error response
      return errorResponse(
        "Unable to access Charity Navigator API. Authentication failed.",
        401,
        "Please check API credentials in environment variables."
      );
    }

    // Use standardized error response
    return errorResponse("Failed to get charity ratings", 500, errorMessage);
  }
}