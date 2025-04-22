// src/features/analysis/api/analyzeTransactionsHandler.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from 'zod'; // Import Zod
import { analyzeTransactionsViaAPI } from "@/features/analysis/transactionAnalysisService";
import { Transaction } from "@/shared/types/transactions";
import { verifyAuth, handleAuthError, AuthError } from '@/utils/serverAuth';
import { errorResponse } from '@/shared/utils/api'; // Import standardized error response

// --- Zod Schema Definition ---
// Define the schema for a single transaction input required for analysis
const TransactionInputSchema = z.object({
  // Ensure essential fields for analysis are present
  date: z.string().min(1, { message: "Transaction date is required" }),
  name: z.string().min(1, { message: "Transaction name is required" }),
  amount: z.number({ required_error: "Transaction amount is required" }),
  analyzed: z.boolean({ required_error: "Transaction analyzed status is required" }),
  // Include optional fields that might be useful inputs if needed, otherwise keep minimal
  plaidTransactionId: z.string().optional(),
  plaidCategories: z.array(z.string()).optional(), // Should be correct (array of strings)
  // FIX: Changed location to z.any() to handle potential object from Plaid
  location: z.any().optional(),
  // FIX: Added .nullable() in case Plaid sends null
  merchant_name: z.string().optional().nullable(),
  // Note: We don't validate output fields like unethicalPractices here, only inputs.
});

// Define the schema for the overall request body
const AnalyzeTransactionsSchema = z.object({
  transactions: z.array(TransactionInputSchema)
                   .min(1, { message: "At least one transaction is required for analysis" }),
});
// --- End Zod Schema Definition ---


// Interface for the expected structure returned by analyzeTransactionsViaAPI
// Ensure this aligns with the return type of analyzeTransactionsViaAPI after Zod changes there
// (Using Partial<Transaction> might be too broad, consider inferring from the service's Zod schema if possible)
interface AnalysisResultTransaction extends Partial<Transaction> {
    citations?: Record<string, string[]>;
    // Add other fields returned by OpenAI/service
}

export async function analyzeTransactionsHandler(req: NextRequest) {
  try {
    // 1. Authentication Check (remains the same)
    const decodedToken = await verifyAuth(req);
    console.log(`analyzeTransactionsHandler: Verified user UID: ${decodedToken.uid}`);

    // 2. Parse Request Body (as unknown first)
    let requestBody: unknown;
    try {
        requestBody = await req.json();
    } catch (parseError) {
        console.error("analyzeTransactionsHandler: Invalid JSON format", parseError);
        // Use standardized error response
        return errorResponse("Invalid JSON format", 400, parseError instanceof Error ? parseError.message : 'Unknown parsing error');
    }

    // 3. Validate Input with Zod
    const validationResult = AnalyzeTransactionsSchema.safeParse(requestBody);

    if (!validationResult.success) {
      // Log the detailed Zod error
      console.error("analyzeTransactionsHandler: Validation failed", validationResult.error.flatten());
      // Use standardized error response with Zod details
      return errorResponse("Invalid request body", 400, validationResult.error.flatten());
    }

    // Use validated data from now on
    // We still cast to Transaction[] because the input schema is a subset,
    // but Zod has ensured the essential fields are present and valid per the *input* schema.
    const transactionsToAnalyze = validationResult.data.transactions as Transaction[];

    console.log(`analyzeTransactionsHandler: Analyzing ${transactionsToAnalyze.length} transactions for user ${decodedToken.uid}`);

    // 4. Core Logic (Call the analysis service - This part should now work)
    // Ensure the type returned by analyzeTransactionsViaAPI is compatible.
    // The previous fix in transactionAnalysisService.ts should make this compatible.
    const analysisResults = await analyzeTransactionsViaAPI(transactionsToAnalyze);


    console.log(`analyzeTransactionsHandler: Analysis complete, returning ${analysisResults.length} results for user ${decodedToken.uid}`);

    // Return the raw analysis results (array of analyzed transaction objects)
    // The structure here depends on what analyzeTransactionsViaAPI returns after its own Zod validation
    return NextResponse.json({ transactions: analysisResults }); // Keep standard success response

  } catch (error) {
     // Handle Authentication Errors (remains the same)
     if (error instanceof AuthError) {
         return handleAuthError(error);
     }

    // Handle other errors (analysis service errors, etc.)
    console.error("❌ Analysis API Handler Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error during analysis";
    // Determine status code based on where the error likely originated
    const statusCode = errorMessage.includes("parse") || errorMessage.includes("Invalid") || errorMessage.includes("validation failed") ? 400 : 502; // 400 for validation/parse, 502 if analysis service fails

    // Use standardized error response
    return errorResponse(errorMessage, statusCode);
  }
}