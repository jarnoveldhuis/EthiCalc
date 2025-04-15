// src/shared/types/vendors.ts
import { Timestamp } from "firebase/firestore"; // Import Timestamp type

export interface VendorAnalysis {
  originalName: string; // Store the most common name encountered
  analyzedAt: Timestamp; // Firestore Timestamp type
  analysisSource: 'gemini' | 'openai' | 'manual' | 'cache'; // Track source
  // Store the core analysis details consistent with your Transaction type
  unethicalPractices?: string[];
  ethicalPractices?: string[];
  practiceWeights?: Record<string, number>;
  practiceSearchTerms?: Record<string, string>;
  practiceCategories?: Record<string, string>;
  information?: Record<string, string>;
  citations?: Record<string, string>;
}