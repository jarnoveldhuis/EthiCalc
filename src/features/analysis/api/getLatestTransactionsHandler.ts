
// src/features/analysis/api/getLatestTransactionsHandler.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, handleAuthError, AuthError } from '@/utils/serverAuth';
import { getLatestTransactionBatch } from "@/features/analysis/transactionStorageService"; // Use the service function

export async function getLatestTransactionsHandler(req: NextRequest) {
  // Note: This is a GET request, but Next.js passes the req object
  try {
    // 1. Verify Authentication
    const decodedToken = await verifyAuth(req);
    const userId = decodedToken.uid; // Get user ID from verified token

    console.log(`getLatestTransactionsHandler: Verified UID: ${userId}`);

    // 2. Call the Service Function (using verified userId)
    const batch = await getLatestTransactionBatch(userId);

    // 3. Handle Response
    if (!batch) {
       console.log(`getLatestTransactionsHandler: No batch found for user ${userId}`);
      // It's not an error if no data exists, return 404
      return NextResponse.json(
        { batch: null, message: "No transactions found for this user" },
        { status: 404 }
      );
    }

    console.log(`getLatestTransactionsHandler: Found batch ${batch.id} for user ${userId}`);
    // Return the found batch
    return NextResponse.json({
      batch
    }, { status: 200 });

  } catch (error) {
    // Handle Auth Errors
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    // Handle Service/Database Errors
    console.error("❌ Get latest transactions API error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error while fetching latest transactions";

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
