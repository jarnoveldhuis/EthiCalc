// src/features/transactions/api/transactionStorageHandler.ts
// API handlers for transaction storage
import { NextRequest, NextResponse } from "next/server";
import { saveAnalyzedTransactions, getUserTransactionBatches, getLatestTransactionBatch } from "../transactionStorageService";
import { AnalyzedTransactionData } from "../types";
// import { getAuth } from "firebase/auth";

interface SaveTransactionsRequest {
  data: AnalyzedTransactionData;
  accessToken?: string;
}

export async function saveTransactionsHandler(req: NextRequest) {
  try {
    // In a real app, get user ID from session/token
    // For this example, we'll need to get it from the request
    const { data, accessToken, userId } = await req.json() as SaveTransactionsRequest & { userId: string };
    
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized: User ID is required" },
        { status: 401 }
      );
    }
    
    if (!data || !data.transactions) {
      return NextResponse.json(
        { error: "Invalid request: transaction data is required" },
        { status: 400 }
      );
    }
    
    const batchId = await saveAnalyzedTransactions(userId, data, accessToken);
    
    return NextResponse.json({ 
      success: true, 
      batchId 
    });
  } catch (error) {
    console.error("❌ Save transactions API error:", error);
    
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

export async function getUserTransactionsHandler(req: NextRequest) {
  try {
    // Get user ID from URL parameters
    const searchParams = req.nextUrl.searchParams;
    const userId = searchParams.get("userId");
    
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized: User ID is required" },
        { status: 401 }
      );
    }
    
    const batches = await getUserTransactionBatches(userId);
    
    return NextResponse.json({ 
      batches
    });
  } catch (error) {
    console.error("❌ Get user transactions API error:", error);
    
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

export async function getLatestTransactionsHandler(req: NextRequest) {
  try {
    // Get user ID from URL parameters
    const searchParams = req.nextUrl.searchParams;
    const userId = searchParams.get("userId");
    
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized: User ID is required" },
        { status: 401 }
      );
    }
    
    const batch = await getLatestTransactionBatch(userId);
    
    if (!batch) {
      return NextResponse.json(
        { batch: null, message: "No transactions found for this user" },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ 
      batch
    });
  } catch (error) {
    console.error("❌ Get latest transactions API error:", error);
    
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}