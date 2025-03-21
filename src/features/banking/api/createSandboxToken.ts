// src/features/banking/api/createSandboxToken.ts

import { NextResponse } from "next/server";
import { createSandboxToken } from "@/features/banking/plaidService";

export async function createSandboxTokenHandler() {
  try {
    console.log("🔍 Requesting Plaid Sandbox Token...");

    // Use the consolidated service function
    const public_token = await createSandboxToken();
    
    console.log("✅ Generated Sandbox Public Token:", public_token);

    return NextResponse.json({ public_token });
  } catch (error) {
    console.error("❌ Error creating sandbox token:", error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : "Internal server error" 
    }, { status: 500 });
  }
}