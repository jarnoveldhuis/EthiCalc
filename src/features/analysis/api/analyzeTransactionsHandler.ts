// src/features/analysis/api/analyzeTransactionsHandler.ts
// API-specific logic for handling HTTP requests and responses
import { NextRequest, NextResponse } from "next/server";
import { analyzeTransactionsCore } from "../transactionAnalysisService";
import { AnalysisRequest } from "../types";

export async function analyzeTransactionsHandler(req: NextRequest) {
  try {
    // Parse and validate the incoming request
    const requestData = await req.json() as AnalysisRequest;
    
    if (!requestData.transactions || !Array.isArray(requestData.transactions)) {
      return NextResponse.json(
        { error: "Invalid request: transactions must be an array" },
        { status: 400 }
      );
    }
    
    // Call the domain service to perform the business logic
    const analysis = await analyzeTransactionsCore(requestData.transactions);
    
    // Return the analysis result as JSON
    return NextResponse.json(analysis);
  } catch (error) {
    // Log the error
    console.error("❌ Analysis API Error:", error);
    
    // Format the error for the client
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    const statusCode = errorMessage.includes("Invalid") ? 400 : 500;
    
    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}