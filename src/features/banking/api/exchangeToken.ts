
// src/features/banking/api/exchangeToken.ts

import { NextRequest, NextResponse } from 'next/server';
import { exchangePublicToken } from '@/core/plaid/plaidService';
import { verifyAuth, handleAuthError, AuthError } from '@/utils/serverAuth';
import { z } from 'zod'; // Import Zod

// Define the schema for the request body
const ExchangeTokenSchema = z.object({
  public_token: z.string().min(1, { message: "public_token is required" }),
});

export async function exchangeTokenHandler(req: NextRequest) {
  try {
    // 1. Authentication Check
    const decodedToken = await verifyAuth(req);
    console.log(`exchangeTokenHandler: Verified user UID: ${decodedToken.uid}`);

    // 2. Parse Request Body
    let requestBody: unknown; // Parse as unknown first
    try {
        requestBody = await req.json();
    } catch (parseError) {
        console.error("exchangeTokenHandler: Invalid JSON format", parseError);
        return NextResponse.json({ error: "Invalid JSON format" }, { status: 400 });
    }


    // 3. Validate Input with Zod
    const validationResult = ExchangeTokenSchema.safeParse(requestBody);

    if (!validationResult.success) {
      console.error("exchangeTokenHandler: Validation failed", validationResult.error.flatten());
      return NextResponse.json(
        {
          error: "Invalid request body",
          details: validationResult.error.flatten(), // Provide detailed validation errors
        },
        { status: 400 }
      );
    }

    // Use validated data from now on
    const { public_token } = validationResult.data;

    // 4. Core Logic
    const access_token = await exchangePublicToken(public_token);
    console.log(`✅ Access Token Received for user ${decodedToken.uid}:`, access_token ? 'OK' : 'Failed');

    return NextResponse.json({ access_token });

  } catch (error) {
     if (error instanceof AuthError) { return handleAuthError(error); }
     console.error('Plaid Token Exchange Error:', error);
     const message = error instanceof Error ? error.message : 'Plaid token exchange failed';
     return NextResponse.json({ error: message }, { status: 500 });
  }
}
