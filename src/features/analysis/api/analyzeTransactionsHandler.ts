
// src/features/analysis/api/analyzeTransactionsHandler.ts
import { NextRequest, NextResponse } from "next/server";
import { analyzeTransactionsViaAPI } from "@/features/analysis/transactionAnalysisService"; // Only calls external API
import { Transaction } from "@/shared/types/transactions"; // Assuming Transaction is also needed if OpenAI response uses it
import { verifyAuth, handleAuthError, AuthError } from '@/utils/serverAuth'; // Import auth utils

// Interface for the expected structure returned by analyzeTransactionsViaAPI
interface AnalysisResultTransaction extends Partial<Transaction> {
    citations?: Record<string, string[]>;
    // Add other fields returned by OpenAI/service
}

export async function analyzeTransactionsHandler(req: NextRequest) {
  try {
    // --- Authentication Check ---
    const decodedToken = await verifyAuth(req);
    console.log(`analyzeTransactionsHandler: Verified user UID: ${decodedToken.uid}`);
    // --- End Authentication Check ---

    // Parse and validate the incoming request
    // Note: The request body is still needed for the transactions to analyze
    const requestData = await req.json(); // Keep using req.json() here

    // *** REMOVED AnalysisRequest type assertion, validate manually ***
    if (!requestData || !requestData.transactions || !Array.isArray(requestData.transactions) || requestData.transactions.length === 0) {
      // Return empty results if no transactions sent
      console.log("analyzeTransactionsHandler: No valid transactions found in request body.");
      return NextResponse.json({ transactions: [] });
    }

    // We don't necessarily need the AnalysisRequest type if we just pass data.transactions
    const transactionsToAnalyze: Transaction[] = requestData.transactions;

    console.log(`analyzeTransactionsHandler: Analyzing ${transactionsToAnalyze.length} transactions for user ${decodedToken.uid}`);

    // Call the service function that only performs the OpenAI/Gemini call
    // This service does NOT need the user ID directly
    const analysisResults: AnalysisResultTransaction[] = await analyzeTransactionsViaAPI(transactionsToAnalyze);

    console.log(`analyzeTransactionsHandler: Analysis complete, returning ${analysisResults.length} results for user ${decodedToken.uid}`);

    // Return the raw analysis results (array of analyzed transaction objects)
    return NextResponse.json({ transactions: analysisResults });

  } catch (error) {
     // Handle authentication errors specifically
     if (error instanceof AuthError) {
         return handleAuthError(error);
     }

    // Handle other errors (parsing, analysis service errors)
    console.error("❌ Analysis API Handler Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error during analysis";
    const statusCode = errorMessage.includes("parse") || errorMessage.includes("Invalid") ? 400 : 502; // Example logic

    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}

// Export the handler as POST
// Removed the explicit export line as the function name implies the export for Next.js routing
