// src/features/banking/api/createLinkToken.ts

import { NextResponse } from "next/server";
import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from "plaid";
import { config } from "@/config";

export async function createLinkTokenHandler() {
  try {
    console.log("🚀 Requesting Plaid Link Token...");
    
    // Configure Plaid client
    const configuration = new Configuration({
      basePath: PlaidEnvironments[config.plaid.env as keyof typeof PlaidEnvironments],
      baseOptions: {
        headers: {
          "PLAID-CLIENT-ID": config.plaid.clientId!,
          "PLAID-SECRET": config.plaid.secret!,
        },
      },
    });

    const plaidClient = new PlaidApi(configuration);
    
    // Create a user ID for this session
    const userId = Math.random().toString(36).substring(2, 15);
    
    // Create link token request
    const createTokenRequest = {
      user: { client_user_id: userId },
      client_name: "Ethinomics App",
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: "en",
    };
    
    const response = await plaidClient.linkTokenCreate(createTokenRequest);
    
    if (!response.data.link_token) {
      throw new Error("Plaid did not return a link token");
    }
    
    const linkToken = response.data.link_token;
    console.log("✅ Plaid Link Token Created:", linkToken.substring(0, 10) + "...");
    
    return NextResponse.json({ link_token: linkToken });
  } catch (error) {
    console.error("❌ Plaid API Error:", error);
    return NextResponse.json(
      { error: "Plaid API request failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}