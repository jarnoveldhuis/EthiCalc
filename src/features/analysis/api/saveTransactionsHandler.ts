// src/features/analysis/api/saveTransactionsHandler.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from 'zod'; // Import Zod
import { verifyAuth, handleAuthError, AuthError } from '@/utils/serverAuth';
import { saveAnalyzedTransactions } from "@/features/analysis/transactionStorageService";
// Removed unused Transaction import
import { AnalyzedTransactionData } from "@/shared/types/transactions";
import { errorResponse } from '@/shared/utils/api'; // Import standardized error response

// --- Zod Schema Definition ---
// Schema for a single transaction within the analyzedData (essential fields for saving)
const SavedTransactionSchema = z.object({
  date: z.string().min(1, { message: "Transaction date is required" }),
  name: z.string().min(1, { message: "Transaction name is required" }),
  amount: z.number({ required_error: "Transaction amount is required" }),
  analyzed: z.boolean({ required_error: "Transaction analyzed status is required" }),
  // Include other fields from Transaction type as optional if they MUST be present when saving,
  // otherwise keep it minimal based on what the service needs/uses.
  // Making most fields optional as they might be added during analysis.
  plaidTransactionId: z.string().optional(),
  societalDebt: z.number().optional(), // Keep societalDebt optional here
  unethicalPractices: z.array(z.string()).optional(),
  ethicalPractices: z.array(z.string()).optional(),
  practiceWeights: z.record(z.number()).optional(),
  practiceSearchTerms: z.record(z.string()).optional(),
  practiceCategories: z.record(z.string()).optional(),
  information: z.record(z.string()).optional(), // Changed from record(z.any()) for better typing if possible
  citations: z.record(z.array(z.string())).optional(), // Ensure citations schema matches type
});

// Schema for the analyzedData object itself
const AnalyzedDataSchema = z.object({
  transactions: z.array(SavedTransactionSchema)
                  .min(1, { message: "Analyzed data must contain at least one transaction" }),
  // Make summary fields optional but ensure they are numbers if provided
  totalSocietalDebt: z.number().optional(),
  debtPercentage: z.number().optional(),
  totalPositiveImpact: z.number().optional(),
  totalNegativeImpact: z.number().optional(),
});

// Schema for the overall request body
const SaveTransactionsSchema = z.object({
  analyzedData: AnalyzedDataSchema,
  // accessToken: z.string().optional(), // Keep if accessToken is part of the request
});
// --- End Zod Schema Definition ---

// Define expected request body structure for type safety after validation
// Note: This is slightly different from the Zod schema definition input
interface SaveTransactionsRequestBody {
  analyzedData: AnalyzedTransactionData; // Use the full type here
  // accessToken?: string;
}


export async function saveTransactionsHandler(req: NextRequest) {
  try {
    // 1. Verify Authentication (remains same)
    const decodedToken = await verifyAuth(req);
    const userId = decodedToken.uid;
    console.log(`saveTransactionsHandler: Verified UID: ${userId}`);

    // 2. Parse Request Body (as unknown first)
     let requestBody: unknown;
     try {
         requestBody = await req.json();
     } catch (parseError) {
         console.error("Save transactions API error: Invalid JSON format", parseError);
         // Use standardized error response
         return errorResponse("Invalid JSON format", 400, parseError instanceof Error ? parseError.message : 'Unknown parsing error');
     }


    // 3. Validate Input Data with Zod
    const validationResult = SaveTransactionsSchema.safeParse(requestBody);

    if (!validationResult.success) {
       console.error("Save transactions API error: Validation failed", validationResult.error.flatten());
       // Use standardized error response with Zod details
       return errorResponse("Invalid request body", 400, validationResult.error.flatten());
    }

    // Use validated data (casting to the full type for the service call)
    // Zod ensures the core structure and essential fields are correct.
    const { analyzedData } = validationResult.data as SaveTransactionsRequestBody;

    // 4. Call the Service Function (Pass verified userId)
    // Pass accessToken if needed by your service/schema (assuming not needed based on current code)
    // Ensure the service function expects the correct type for analyzedData
    const batchId = await saveAnalyzedTransactions(userId, analyzedData);


    console.log(`Save transactions API: Successfully saved batch ${batchId} for user ${userId}`);

    // 5. Return Success Response (remains same)
    return NextResponse.json({
      success: true,
      batchId
    }, { status: 201 }); // 201 Created is appropriate

  } catch (error) {
    // Handle Auth Errors (remains same)
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    // Handle Service/Database Errors
    console.error("❌ Save transactions API error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error while saving transactions";
    // Determine status code based on error type if possible, default to 500
    const statusCode = errorMessage.includes("required") || errorMessage.includes("Invalid") ? 400 : 500;

    // Use standardized error response
    return errorResponse(errorMessage, statusCode);
  }
}