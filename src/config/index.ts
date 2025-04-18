// src/config/index.ts
export const config = {
  // Add a flag to choose the analysis provider
  analysisProvider: process.env.ANALYSIS_PROVIDER || 'openai', // 'openai' or 'gemini'

  plaid: {
    clientId: process.env.PLAID_CLIENT_ID,
    secret: process.env.PLAID_ENV === "sandbox"
      ? process.env.PLAID_SECRET_SANDBOX
      : process.env.PLAID_SECRET_PRODUCTION,
    env: process.env.PLAID_ENV || "sandbox",
    isSandbox: process.env.PLAID_ENV === "sandbox",
    useSampleData: process.env.USE_SAMPLE_DATA === "false" || false,
  },
  openai: {
    // Keep OpenAI config for fallback or choice
    apiKey: process.env.OPENAI_API_KEY,
    model: "gpt-4o", // Or your preferred OpenAI model
    timeout: 170000,
    webSearchEnabled: false,
    searchContextSize: "high",
  },
  // Add new Gemini configuration section
  gemini: {
    apiKey: process.env.GEMINI_API_KEY, // Add this environment variable
    model: "gemini-2.0-flash", // Default stable model, can be overridden
    // You could specify the preview model via env var if needed:
    // model: process.env.GEMINI_MODEL_OVERRIDE || "gemini-1.5-pro-latest",
    // Let's use the specific one you mentioned for now if ANALYSIS_PROVIDER is 'gemini'
    previewModel: "gemini-2.5-pro-preview-03-25", // The specific model user wants
    timeout: 170000, // Adjust timeout if needed
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
  },
  charityNavigator: {
    apiKey: process.env.CHARITY_NAVIGATOR_API_KEY || "YOUR_CHARITY_NAVIGATOR_API_KEY",
    appId: process.env.CHARITY_NAVIGATOR_APP_ID || "YOUR_CHARITY_NAVIGATOR_APP_ID",
    apiUrl: process.env.CHARITY_NAVIGATOR_API_URL || "https://api.charitynavigator.org/graphql",
  },
};