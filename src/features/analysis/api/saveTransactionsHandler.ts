// src/features/analysis/api/saveTransactionsHandler.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from 'zod';
import { verifyAuth, handleAuthError, AuthError } from '@/utils/serverAuth';
import { saveAnalyzedTransactions } from "@/features/analysis/transactionStorageService";
// Import necessary types, including PlaidLocation and Citation if needed for validation context
import { AnalyzedTransactionData } from "@/shared/types/transactions";
import { errorResponse } from '@/shared/utils/api';

// --- Zod Schema Definition ---

// *** NEW: Zod schema for a single Citation object ***
const CitationSchema = z.object({
    url: z.string().url().or(z.string().startsWith('/')).or(z.literal("")),
    title: z.string().optional(),
}).passthrough(); // Allow other fields if needed

// *** NEW: Zod schema for the PlaidLocation object (matching type definition) ***
const PlaidLocationSchema = z.object({
    address: z.string().nullable(),
    city: z.string().nullable(),
    region: z.string().nullable(),
    postal_code: z.string().nullable(),
    country: z.string().nullable(),
    lat: z.number().nullable(),
    lon: z.number().nullable(),
    store_number: z.string().nullable(),
}).passthrough().nullable();

// Schema for a single transaction within the analyzedData (essential fields for saving)
// This needs to accurately reflect the structure being SENT by the client store
const SavedTransactionSchema = z.object({
  date: z.string().min(1, { message: "Transaction date is required" }),
  name: z.string().min(1, { message: "Transaction name is required" }),
  merchant_name: z.string().optional().nullable(), // Match Transaction type
  amount: z.number({ required_error: "Transaction amount is required" }),
  analyzed: z.boolean({ required_error: "Transaction analyzed status is required" }),
  id: z.string().optional(), // Allow optional ID
  societalDebt: z.number().optional(),
  unethicalPractices: z.array(z.string()).optional(),
  ethicalPractices: z.array(z.string()).optional(),
  practiceWeights: z.record(z.number()).optional(),
  practiceDebts: z.record(z.number()).optional(), // Include if present in Transaction
  practiceSearchTerms: z.record(z.string()).optional(),
  practiceCategories: z.record(z.string()).optional(),
  charities: z.record(z.object({ // Define charity structure if sent
      name: z.string(),
      url: z.string().url(),
  })).optional(),
  information: z.record(z.string()).optional(),
  // *** UPDATED: Expect a record where values are arrays of CitationSchema objects ***
  citations: z.record(z.array(CitationSchema)).optional(),
  isCreditApplication: z.boolean().optional(), // Include if present in Transaction
  creditApplied: z.boolean().optional(), // Include if present in Transaction
  plaidTransactionId: z.string().optional(),
  plaidCategories: z.array(z.string()).optional(),
  // Use the specific location schema
  location: PlaidLocationSchema.optional(),
}).passthrough(); // Use passthrough if other fields might exist

// Schema for the analyzedData object itself
const AnalyzedDataSchema = z.object({
  transactions: z.array(SavedTransactionSchema)
                  .min(1, { message: "Analyzed data must contain at least one transaction" }),
  // Ensure summary fields match calculation results
  totalSocietalDebt: z.number().optional(),
  debtPercentage: z.number().optional(),
  totalPositiveImpact: z.number().optional(),
  totalNegativeImpact: z.number().optional(),
}).passthrough(); // Allow other fields if needed

// Schema for the overall request body
const SaveTransactionsSchema = z.object({
  analyzedData: AnalyzedDataSchema,
  // accessToken: z.string().optional(), // Keep if used
}).passthrough(); // Allow other fields if needed
// --- End Zod Schema Definition ---

// Define expected request body structure for type safety after validation
// Use the actual AnalyzedTransactionData type which uses the updated Transaction type
interface SaveTransactionsRequestBody {
  analyzedData: AnalyzedTransactionData;
  // accessToken?: string;
}


export async function saveTransactionsHandler(req: NextRequest) {
  try {
    // 1. Verify Authentication
    const decodedToken = await verifyAuth(req);
    const userId = decodedToken.uid;
    console.log(`saveTransactionsHandler: Verified UID: ${userId}`);

    // 2. Parse Request Body
     let requestBody: unknown;
     try {
         requestBody = await req.json();
     } catch (parseError) {
         console.error("Save transactions API error: Invalid JSON format", parseError);
         return errorResponse("Invalid JSON format", 400, parseError instanceof Error ? parseError.message : 'Unknown parsing error');
     }

    // 3. Validate Input Data with Zod (using updated schemas)
    const validationResult = SaveTransactionsSchema.safeParse(requestBody);

    if (!validationResult.success) {
       // Log the detailed Zod error for debugging
       console.error("Save transactions API error: Validation failed", validationResult.error.flatten());
       // Return standardized error response
       return errorResponse("Invalid request body", 400, validationResult.error.flatten());
    }

    // Use validated data, cast to the full type expected by the service
    const { analyzedData } = validationResult.data as SaveTransactionsRequestBody;

    // 4. Call the Service Function
    // saveAnalyzedTransactions expects AnalyzedTransactionData which uses the updated Transaction type
    const batchId = await saveAnalyzedTransactions(userId, analyzedData);

    console.log(`Save transactions API: Successfully saved batch ${batchId} for user ${userId}`);

    // 5. Return Success Response
    return NextResponse.json({
      success: true,
      batchId
    }, { status: 201 });

  } catch (error) {
    // Handle Auth Errors
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    // Handle Service/Database Errors
    console.error("❌ Save transactions API error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error while saving transactions";
    const statusCode = errorMessage.includes("required") || errorMessage.includes("Invalid") ? 400 : 500;

    // Use standardized error response
    return errorResponse(errorMessage, statusCode);
  }
}