// src/shared/utils/api.ts
import { NextRequest, NextResponse } from "next/server";

/**
 * Safely parses JSON from a request with consistent error handling
 * @param req The Next.js request object
 * @returns A tuple containing [data, error]
 */
export async function parseRequestBody<T>(req: NextRequest): Promise<[T | null, Error | null]> {
  try {
    const data = await req.json() as T;
    return [data, null];
  } catch (error) {
    console.error("Error parsing request body:", error);
    return [null, error instanceof Error ? error : new Error("Failed to parse request body")];
  }
}

/**
 * Creates a standardized error response
 * @param message Error message
 * @param status HTTP status code
 * @param details Additional error details
 */
export function errorResponse(message: string, status = 500, details?: unknown): NextResponse {
  return NextResponse.json(
    { 
      error: message,
      details: details || null
    },
    { status }
  );
}

/**
 * Creates a standardized success response
 * @param data Response data
 * @param status HTTP status code
 */
export function successResponse<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}