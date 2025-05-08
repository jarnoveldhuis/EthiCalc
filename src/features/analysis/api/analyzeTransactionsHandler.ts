// src/features/analysis/api/analyzeTransactionsHandler.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from 'zod';
import { analyzeTransactionsViaAPI } from "@/features/analysis/transactionAnalysisService";
// Import the Transaction type which now includes PlaidLocation
import { Transaction } from "@/shared/types/transactions";
import { verifyAuth, handleAuthError, AuthError } from '@/utils/serverAuth';
import { errorResponse } from '@/shared/utils/api';

// --- Zod Schema Definition ---

// *** NEW: Zod schema for the PlaidLocation object ***
// (Match the fields defined in the PlaidLocation interface)
const PlaidLocationSchema = z.object({
    address: z.string().nullable(),
    city: z.string().nullable(),
    region: z.string().nullable(),
    postal_code: z.string().nullable(),
    country: z.string().nullable(),
    lat: z.number().nullable(),
    lon: z.number().nullable(),
    store_number: z.string().nullable(),
    // Use passthrough if Plaid might send extra fields you don't care about
}).passthrough().nullable(); // Allow the whole object to be null

// Define the schema for a single transaction input required for analysis
const TransactionInputSchema = z.object({
  date: z.string().min(1, { message: "Transaction date is required" }),
  name: z.string().min(1, { message: "Transaction name is required" }),
  amount: z.number({ required_error: "Transaction amount is required" }),
  analyzed: z.boolean({ required_error: "Transaction analyzed status is required" }),
  plaidTransactionId: z.string().optional(),
  plaidCategories: z.array(z.string()).optional(),
  // *** UPDATED: Use the specific PlaidLocation Zod schema ***
  location: PlaidLocationSchema.optional(), // Make it optional as before
  merchant_name: z.string().optional().nullable(),
});

// Define the schema for the overall request body
const AnalyzeTransactionsSchema = z.object({
  transactions: z.array(TransactionInputSchema)
                   .min(1, { message: "At least one transaction is required for analysis" }),
});
// --- End Zod Schema Definition ---

// Interface for the expected structure returned by analyzeTransactionsViaAPI
// (Assuming AnalysisResultTransaction from transactionAnalysisService is compatible)

export async function analyzeTransactionsHandler(req: NextRequest) {
  try {
    // 1. Authentication Check
    const decodedToken = await verifyAuth(req);
    console.log(`analyzeTransactionsHandler: Verified user UID: ${decodedToken.uid}`);

    // 2. Parse Request Body
    let requestBody: unknown;
    try {
        requestBody = await req.json();
    } catch (parseError) {
        console.error("analyzeTransactionsHandler: Invalid JSON format", parseError);
        return errorResponse("Invalid JSON format", 400, parseError instanceof Error ? parseError.message : 'Unknown parsing error');
    }

    // 3. Validate Input with Zod (using updated schema)
    const validationResult = AnalyzeTransactionsSchema.safeParse(requestBody);

    if (!validationResult.success) {
      console.error("analyzeTransactionsHandler: Validation failed", validationResult.error.flatten());
      return errorResponse("Invalid request body", 400, validationResult.error.flatten());
    }

    // Use validated data
    // Cast to Transaction[] is still okay as the Zod schema is a subset/compatible structure
    const transactionsToAnalyze = validationResult.data.transactions as Transaction[];

    console.log(`analyzeTransactionsHandler: Analyzing ${transactionsToAnalyze.length} transactions for user ${decodedToken.uid}`);

    // 4. Core Logic (Call the analysis service)
    // analysisResults should conform to the updated Transaction type from the service
    const analysisResults = await analyzeTransactionsViaAPI(transactionsToAnalyze);
    console.log(analysisResults)
    console.log(`analyzeTransactionsHandler: Analysis complete, returning ${analysisResults.length} results for user ${decodedToken.uid}`);

    // Return the raw analysis results
    return NextResponse.json({ transactions: analysisResults });

  } catch (error) {
     if (error instanceof AuthError) {
         return handleAuthError(error);
     }
    console.error("❌ Analysis API Handler Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error during analysis";
    const statusCode = errorMessage.includes("parse") || errorMessage.includes("Invalid") || errorMessage.includes("validation failed") ? 400 : 502;
    return errorResponse(errorMessage, statusCode);
  }
}