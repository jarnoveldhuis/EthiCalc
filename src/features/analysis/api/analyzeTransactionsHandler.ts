// src/features/analysis/api/analyzeTransactionsHandler.ts
import { NextRequest, NextResponse } from "next/server";
// Import the specific function that ONLY calls the API
import { analyzeTransactionsViaAPI } from "@/features/analysis/transactionAnalysisService";
import { AnalysisRequest, Transaction } from "@/shared/types/transactions"; // Assuming Transaction is also needed if OpenAI response uses it

// Interface for the expected structure returned by analyzeTransactionsViaAPI
// This should match OpenAIResponseTransaction from the service file
interface AnalysisResultTransaction extends Partial<Transaction> {
    citations?: Record<string, string>;
    // Add other fields returned by OpenAI/service
}

export async function analyzeTransactionsHandler(req: NextRequest) {
  try {
    // Parse and validate the incoming request
    const requestData = await req.json() as AnalysisRequest;

    if (!requestData.transactions || !Array.isArray(requestData.transactions) || requestData.transactions.length === 0) {
      // Return empty results if no transactions sent
      return NextResponse.json({ transactions: [] });
    }

    // Call the service function that only performs the OpenAI call
    const analysisResults: AnalysisResultTransaction[] = await analyzeTransactionsViaAPI(requestData.transactions);

    // Return the raw analysis results (array of analyzed transaction objects)
    return NextResponse.json({ transactions: analysisResults });

  } catch (error) {
    // Log the error
    console.error("❌ Analysis API Handler Error:", error);

    // Format the error for the client
    const errorMessage = error instanceof Error ? error.message : "Internal server error during analysis";
    // Determine appropriate status code (e.g., 400 for bad input, 500/502 for upstream issues)
    const statusCode = errorMessage.includes("parse") || errorMessage.includes("Invalid") ? 400 : 502; // Example logic

    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}

// Export the handler as POST
export { analyzeTransactionsHandler as POST };