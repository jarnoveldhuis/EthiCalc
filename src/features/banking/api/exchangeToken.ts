
// src/features/banking/api/exchangeToken.ts

import { NextRequest, NextResponse } from 'next/server';
import { exchangePublicToken } from '@/core/plaid/plaidService';
import { verifyAuth, handleAuthError, AuthError } from '@/utils/serverAuth'; // Import auth utils

export async function exchangeTokenHandler(req: NextRequest) {
  try {
    // --- Authentication Check ---
    // Verify the user's Firebase ID token. This also implicitly checks if admin SDK is initialized.
    // This step is crucial even for token exchange if you link the access token to a specific user internally.
    // If the access token is user-agnostic initially, you might skip auth here,
    // but it's generally safer to ensure a logged-in user is performing Plaid operations.
    // For this implementation, we will assume authentication is required.
    const decodedToken = await verifyAuth(req);
    console.log(`exchangeTokenHandler: Verified user UID: ${decodedToken.uid}`);
    // --- End Authentication Check ---

    // Read request body safely
    const { public_token } = await req.json();

    if (!public_token) {
      return NextResponse.json({ error: 'Missing public_token' }, { status: 400 });
    }

    // Exchange public_token for access_token
    const access_token = await exchangePublicToken(public_token);
    console.log(`✅ Access Token Received for user ${decodedToken.uid}:`, access_token ? 'OK' : 'Failed');

    // **Important:** Here you would typically associate this access_token
    // with the verified decodedToken.uid in your database or secure storage
    // for future use. The current code stores it in localStorage on client,
    // which is fine, but linking it server-side is more robust.

    return NextResponse.json({ access_token });
  } catch (error) {
     // Handle authentication errors specifically
     if (error instanceof AuthError) {
         return handleAuthError(error);
     }
     // Handle other errors (Plaid API errors, etc.)
     console.error('Plaid Token Exchange Error:', error);
     const message = error instanceof Error ? error.message : 'Plaid token exchange failed';
     return NextResponse.json({ error: message }, { status: 500 });
  }
}
