
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
        // This case should ideally not happen if the import worked, but good to check
        console.error('verifyAuth Error: Firebase Admin Auth is not available.');
        throw new Error('Firebase Admin SDK not initialized properly.');
    }
    const decodedToken = await firebaseAdminAuth.verifyIdToken(idToken);
    return decodedToken;
  } catch (error: unknown) { // <-- Catch as unknown
    // Type guard to check if error has code property (like Firebase errors)
    let errorCode: string | undefined;
    let errorMessage: string = 'Authentication error';

    if (typeof error === 'object' && error !== null) {
        if ('code' in error) {
            errorCode = (error as { code: string }).code;
        }
         if ('message' in error) {
            errorMessage = (error as { message: string }).message;
        }
    }

    console.error('Firebase token verification error:', errorCode, errorMessage);

    if (errorCode === 'auth/id-token-expired') {
      throw new AuthError('Token expired', 401);
    } else if (errorCode === 'auth/argument-error') {
         throw new AuthError('Invalid token format', 401);
    }
     // Handle other potential errors (e.g., revoked token, network issues)
    throw new AuthError(`Invalid token: ${errorMessage}`, 403); // Include original message if available
  }
}

/**
 * Helper to create a standard error response for auth errors.
 */
export function handleAuthError(error: unknown): NextResponse { // <-- Catch as unknown
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  // Handle unexpected server errors during auth
  console.error("Unexpected error during auth handling:", error); // Log the actual error
  return NextResponse.json({ error: 'Internal Server Error during authentication' }, { status: 500 });
}
