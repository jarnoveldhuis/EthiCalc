// src/features/banking/api/getTransactions.ts

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod'; // Import Zod
import { getTransactions as getPlaidTransactions } from '@/core/plaid/plaidService';
import { verifyAuth, handleAuthError, AuthError } from '@/utils/serverAuth';
import { errorResponse } from '@/shared/utils/api'; // Import standardized error response

// --- Zod Schema Definition ---
const GetTransactionsSchema = z.object({
  access_token: z.string().min(1, { message: "access_token is required" }),
  // Add other expected fields here if the body structure changes
});
// --- End Zod Schema Definition ---

export async function getTransactionsHandler(req: NextRequest) {
  try {
    // 1. Authentication Check (remains the same)
    const decodedToken = await verifyAuth(req);
    console.log(`getTransactionsHandler: Verified user UID: ${decodedToken.uid}`);

    // 2. Parse Request Body (as unknown first)
    let requestBody: unknown;
    try {
        requestBody = await req.json();
    } catch (parseError) {
        console.error("getTransactionsHandler: Invalid JSON format", parseError);
        // Use standardized error response
        return errorResponse("Invalid JSON format", 400, parseError instanceof Error ? parseError.message : 'Unknown parsing error');
    }


    // 3. Validate Input with Zod
    const validationResult = GetTransactionsSchema.safeParse(requestBody);

    if (!validationResult.success) {
      console.error("getTransactionsHandler: Validation failed", validationResult.error.flatten());
      // Use standardized error response with Zod details
      return errorResponse("Invalid request body", 400, validationResult.error.flatten());
    }

    // Use validated data from now on
    const { access_token } = validationResult.data;


    // **Security Note:** (remains the same)
    // In a production system, you should verify that
    // the access_token provided belongs to the authenticated user (decodedToken.uid).
    // This typically requires storing the access_token associated with the user ID
    // securely on the server-side during the token exchange process.
    // For simplicity in this example, we are proceeding without this check,
    // but it is a critical security consideration.

    // 4. Core Logic (using validated access_token)
    try {
      const transactions = await getPlaidTransactions(access_token);
      console.log(`Plaid returned ${transactions.length} transactions for user ${decodedToken.uid}`);
      return NextResponse.json(transactions); // Keep standard success response for Plaid data
    } catch (error) {
      console.error("💥 Error fetching Plaid transactions:", error);
      const message = error instanceof Error ? error.message : String(error);
      // Use standardized error response for upstream Plaid errors
      return errorResponse("Failed to fetch transactions from Plaid", 502, {
          details: message,
          timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
     // Handle Authentication Errors (remains the same)
     if (error instanceof AuthError) {
         return handleAuthError(error);
     }
     // Handle other unexpected errors
    console.error("💥 Error in getTransactions route:", error);
    const message = error instanceof Error ? error.message : "Unknown server error";
     // Use standardized error response for general errors
     return errorResponse("Failed to process request", 500, {
         details: message,
         timestamp: new Date().toISOString()
     });
  }
}