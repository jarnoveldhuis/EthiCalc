
// src/utils/serverAuth.ts
import { NextRequest, NextResponse } from 'next/server';
import { firebaseAdminAuth } from '@/lib/firebaseAdmin'; // Import initialized admin auth
import { DecodedIdToken } from 'firebase-admin/auth';

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number = 401) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}

/**
 * Verifies the Firebase ID token from the Authorization header.
 * @param req - The NextRequest object.
 * @returns The decoded ID token containing user information (including uid).
 * @throws AuthError if the token is missing, invalid, or expired.
 */
export async function verifyAuth(req: NextRequest): Promise<DecodedIdToken> {
  const authorization = req.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) {
    throw new AuthError('Missing or invalid Authorization header', 401);
  }

  const idToken = authorization.split('Bearer ')[1];
  if (!idToken) {
    throw new AuthError('Missing token in Authorization header', 401);
  }

  try {
    if (!firebaseAdminAuth) {
        console.error('verifyAuth Error: Firebase Admin Auth is not available.');
        // Throw a generic error BEFORE trying to use it if null
        throw new Error('Firebase Admin SDK not initialized properly.');
    }
    const decodedToken = await firebaseAdminAuth.verifyIdToken(idToken);
    return decodedToken;
  } catch (error: unknown) { // Catch as unknown

    let errorCode: string | undefined;
    let internalErrorMessage: string = 'Authentication error'; // Store original message for logging

    if (typeof error === 'object' && error !== null) {
        if ('code' in error) {
            errorCode = (error as { code: string }).code;
        }
         if ('message' in error) {
            internalErrorMessage = (error as { message: string }).message;
        }
    } else if (error instanceof Error) {
        internalErrorMessage = error.message;
    }

    // *** Log the DETAILED internal error SERVER-SIDE ONLY ***
    console.error('Firebase token verification error:', errorCode, internalErrorMessage, error); // Log full error object too

    // *** Determine the message to send to the CLIENT ***
    let clientErrorMessage: string;
    let clientStatusCode: number = 401; // Default to Unauthorized

    if (errorCode === 'auth/id-token-expired') {
      clientErrorMessage = 'Token expired. Please sign in again.';
      clientStatusCode = 401;
    } else if (errorCode === 'auth/argument-error' || internalErrorMessage.includes('Firebase ID token has invalid signature')) {
        // Catch malformed tokens etc.
         clientErrorMessage = 'Invalid token format.';
         clientStatusCode = 401;
    } else if (internalErrorMessage.includes('Firebase Admin SDK not initialized')) {
        // Catch initialization errors specifically
        clientErrorMessage = 'Authentication service temporarily unavailable.';
        clientStatusCode = 503; // Service Unavailable
    }
     // *** CRITICAL FIX: Catch potential credential errors without leaking details ***
     else if (internalErrorMessage.includes('credential') || internalErrorMessage.includes('private_key')) {
        // If the internal message hints at credential issues, DO NOT include it.
        clientErrorMessage = 'Authentication configuration error.'; // Generic message
        clientStatusCode = 500; // Internal Server Error
     }
     else {
       // For any other unexpected errors during verification
       clientErrorMessage = 'Authentication failed. Please try again later.';
       clientStatusCode = 403; // Forbidden or use 500
    }

    // Throw an AuthError with the SANITIZED client message and appropriate status code
    throw new AuthError(clientErrorMessage, clientStatusCode);
  }
}

// Optional enhancement: handleAuthError could also add server-side logging
export function handleAuthError(error: unknown): NextResponse {
  if (error instanceof AuthError) {
    // Log the error server-side if needed (could add more details here)
    // console.error(`AuthError handled: Status ${error.status}, Message: ${error.message}`);
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  // Handle unexpected non-AuthError errors during auth flow
  console.error("Unexpected error during auth handling:", error);
  return NextResponse.json({ error: 'Internal Server Error during authentication' }, { status: 500 });
}
