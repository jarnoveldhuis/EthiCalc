
// src/features/banking/api/getTransactions.ts

import { NextRequest, NextResponse } from 'next/server';
import { getTransactions as getPlaidTransactions } from '@/core/plaid/plaidService'; // Renamed import
import { verifyAuth, handleAuthError, AuthError } from '@/utils/serverAuth'; // Import auth utils

export async function getTransactionsHandler(req: NextRequest) {
  try {
    // --- Authentication Check ---
    const decodedToken = await verifyAuth(req);
    console.log(`getTransactionsHandler: Verified user UID: ${decodedToken.uid}`);
    // --- End Authentication Check ---

    // Read request body safely
    const { access_token } = await req.json();

    // Always require an access token now
    if (!access_token) {
      return NextResponse.json(
        { error: "Missing access_token" },
        { status: 400 }
      );
    }

    // **Security Note:** In a production system, you should verify that
    // the access_token provided belongs to the authenticated user (decodedToken.uid).
    // This typically requires storing the access_token associated with the user ID
    // securely on the server-side during the token exchange process.
    // For simplicity in this example, we are proceeding without this check,
    // but it is a critical security consideration.

    try {
      // Call the core Plaid service function
      const transactions = await getPlaidTransactions(access_token);

      // Log the raw transactions for debugging
      console.log(`Plaid returned ${transactions.length} transactions for user ${decodedToken.uid}`);

      return NextResponse.json(transactions);
    } catch (error) {
      // Log detailed error information
      console.error("💥 Error fetching Plaid transactions:", error);

      // Return error details to the client for debugging
      const message = error instanceof Error ? error.message : String(error);
      return NextResponse.json(
        {
          error: "Failed to fetch transactions from Plaid",
          details: message,
          timestamp: new Date().toISOString()
        },
        { status: 502 } // 502 Bad Gateway might be appropriate for upstream errors
      );
    }
  } catch (error) {
     // Handle authentication errors specifically
     if (error instanceof AuthError) {
         return handleAuthError(error);
     }
     // Handle other errors (request parsing, unexpected server issues)
    console.error("💥 Error in getTransactions route:", error);
    const message = error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json(
      {
        error: "Failed to process request",
        details: message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
