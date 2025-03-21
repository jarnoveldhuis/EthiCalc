// src/config/index.ts
export const config = {
  plaid: {
    clientId: process.env.PLAID_CLIENT_ID,
    secret: process.env.PLAID_ENV === "sandbox" 
      ? process.env.PLAID_SECRET_SANDBOX 
      : process.env.PLAID_SECRET_PRODUCTION,
    env: process.env.PLAID_ENV || "sandbox",
    isSandbox: process.env.PLAID_ENV === "sandbox",
    useSampleData: process.env.USE_SAMPLE_DATA === "true" || false,
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: "gpt-4o",
    timeout: 180000, // 3 minutes - increased for web search operations
    webSearchEnabled: false, // Flag to indicate we're using web search capabilities
    searchContextSize: "low", // Use minimal search context to reduce costs and speed up response

  },
  firebase: {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  },
  charity: {
    apiKey: process.env.EVERY_ORG_API_KEY,
    baseUrl: "https://partners.every.org/v0.2",
    defaultDonationUrl: "https://www.every.org/donate",
  }
};