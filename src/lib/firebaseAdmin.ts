
// src/lib/firebaseAdmin.ts
import admin from 'firebase-admin';

// IMPORTANT: Ensure your Firebase Admin SDK Service Account credentials are
// available in your server environment variables.
// Option 1: Set GOOGLE_APPLICATION_CREDENTIALS=path/to/your/serviceAccountKey.json
// Option 2: Set FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_PRIVATE_KEY, FIREBASE_ADMIN_CLIENT_EMAIL

try {
  if (!admin.apps.length) {
    const credential = process.env.FIREBASE_ADMIN_PRIVATE_KEY
      ? admin.credential.cert({
          projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
          privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY
          // ?.replace(/\\n/g, '\n')
          , // Handle newline characters
          clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        })
      : admin.credential.applicationDefault();

    admin.initializeApp({
      credential,
      // databaseURL: `https://${process.env.FIREBASE_ADMIN_PROJECT_ID}.firebaseio.com` // Optional
    });
    console.log('Firebase Admin SDK initialized successfully.');
  }
} catch (error: unknown) { // Catch as unknown is correct
  // --- TYPE CHECK ADDED ---
  if (error instanceof Error) {
    // Now safe to access error.stack (and error.message)
    console.error('Firebase Admin SDK initialization error:', error.stack);
  } else {
    // Log the error value itself if it's not a standard Error object
    console.error('Firebase Admin SDK initialization error (unknown type):', error);
  }
  // --- END TYPE CHECK ---

  // Optionally throw the error or handle it based on your app's needs
  // Consider throwing a more generic error to avoid leaking details:
  // throw new Error('Failed to initialize Firebase Admin SDK');
}

// In src/lib/firebaseAdmin.ts (from previous fix)
export const firebaseAdminAuth = admin.apps.length ? admin.auth() : null; // Can be null
export const firebaseAdminDb = admin.apps.length ? admin.firestore() : null; // Can be null

// Add a check function if needed elsewhere
export const isAdminSdkInitialized = (): boolean => !!admin.apps.length && !!firebaseAdminAuth && !!firebaseAdminDb;

export default admin; // Export default admin instance if needed, but safer to use specific services
