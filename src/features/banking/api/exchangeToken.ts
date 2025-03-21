// src/features/banking/api/exchangeToken.ts

import { NextRequest, NextResponse } from 'next/server';
import { exchangePublicToken } from '@/features/banking/plaidService';

export async function exchangeTokenHandler(req: NextRequest) {
  try {
    // Read request body safely
    const { public_token } = await req.json();

    if (!public_token) {
      return NextResponse.json({ error: 'Missing public_token' }, { status: 400 });
    }

    // Exchange public_token for access_token
    const access_token = await exchangePublicToken(public_token);
    console.log("✅ Access Token Received:", access_token);

    return NextResponse.json({ access_token });
  } catch (error) {
    console.error('Plaid Token Exchange Error:', error);
    return NextResponse.json({ error: 'Plaid token exchange failed' }, { status: 500 });
  }
}