// src/features/banking/api/getTransactions.ts

import { NextRequest, NextResponse } from 'next/server';
import { getTransactions } from '@/features/banking/plaidService';

export async function getTransactionsHandler(req: NextRequest) {
  try {
    const { access_token } = await req.json();
    
    // Always require an access token now - no fallback to sample data
    if (!access_token) {
      return NextResponse.json(
        { error: "Missing access_token" },
        { status: 400 }
      );
    }
    
    try {
      const transactions = await getTransactions(access_token);
      
      // Log the raw transactions for debugging
      console.log(`Plaid returned ${transactions.length} transactions`);
      
      return NextResponse.json(transactions);
    } catch (error) {
      // Log detailed error information
      console.error("💥 Error fetching transactions:", error);
      
      // Return error details to the client for debugging
      return NextResponse.json(
        { 
          error: "Failed to fetch transactions", 
          details: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString()
        },
        { status: 500 }
      );
    }
  } catch (error) {
    // This handles request parsing errors
    console.error("💥 Error in transactions route:", error);
    
    return NextResponse.json(
      { 
        error: "Failed to process request", 
        details: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}