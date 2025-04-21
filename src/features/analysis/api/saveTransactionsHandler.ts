
// src/features/analysis/api/saveTransactionsHandler.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, handleAuthError, AuthError } from '@/utils/serverAuth';
import { saveAnalyzedTransactions } from "@/features/analysis/transactionStorageService"; // Use the service function
import { AnalyzedTransactionData } from "@/shared/types/transactions";

// Define expected request body structure (excluding userId)
interface SaveTransactionsRequestBody {
  analyzedData: AnalyzedTransactionData;
  // accessToken might be needed if you store it per batch, keep if necessary
  // accessToken?: string;
}

export async function saveTransactionsHandler(req: NextRequest) {
  try {
    // 1. Verify Authentication
    const decodedToken = await verifyAuth(req);
    const userId = decodedToken.uid; // Get user ID from verified token

    console.log(`saveTransactionsHandler: Verified UID: ${userId}`);

    // 2. Parse Request Body
    let requestBody: SaveTransactionsRequestBody;
    try {
      requestBody = await req.json();
    } catch (parseError) {
      console.error("Save transactions API error: Failed to parse request body", parseError);
      return NextResponse.json({ error: "Invalid request body format" }, { status: 400 });
    }

    const { analyzedData } = requestBody;

    // 3. Validate Input Data
    if (!analyzedData || !analyzedData.transactions || !Array.isArray(analyzedData.transactions)) {
       console.error(`Save transactions API error: Invalid analyzedData for user ${userId}`);
      return NextResponse.json(
        { error: "Invalid request: Analyzed transaction data is required and must contain a transactions array" },
        { status: 400 }
      );
    }
     // Basic check for transaction structure (can be enhanced with Zod)
     if (analyzedData.transactions.length > 0 && (!analyzedData.transactions[0].date || !analyzedData.transactions[0].name || typeof analyzedData.transactions[0].amount !== 'number')) {
        console.error(`Save transactions API error: Invalid transaction structure in data for user ${userId}`);
        return NextResponse.json({ error: "Invalid transaction data structure" }, { status: 400 });
     }


    // 4. Call the Service Function (Pass verified userId)
    // Pass accessToken if needed by your service/schema
    const batchId = await saveAnalyzedTransactions(userId, analyzedData /*, requestBody.accessToken */);

    console.log(`Save transactions API: Successfully saved batch ${batchId} for user ${userId}`);

    // 5. Return Success Response
    return NextResponse.json({
      success: true,
      batchId
    }, { status: 201 }); // 201 Created is appropriate

  } catch (error) {
    // Handle Auth Errors
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    // Handle Service/Database Errors
    console.error("❌ Save transactions API error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error while saving transactions";
    // Determine status code based on error type if possible, default to 500
    const statusCode = errorMessage.includes("required") ? 400 : 500;

    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}
