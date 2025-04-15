// src/features/vendors/vendorStorageService.ts
import { db } from "@/core/firebase/firebase";
import { doc, getDoc, setDoc, Timestamp, collection, CollectionReference, DocumentData } from "firebase/firestore";
import { VendorAnalysis } from "@/shared/types/vendors";

/**
 * Normalizes a vendor name for use as a Firestore document ID.
 * - Converts to lowercase.
 * - Trims whitespace.
 * - Removes trailing store numbers/identifiers (e.g., " #123", " STORE 456"). // <-- Keep Refinement
 * - Replaces sequences of non-alphanumeric characters with a single underscore.
 * - Removes leading/trailing underscores.
 * - Handles common suffixes and ampersands.
 * @param name The raw vendor name.
 * @returns A normalized string suitable for Firestore document IDs.
 */
export function normalizeVendorName(name: string | undefined | null): string {
  if (!name) return "unknown_vendor";
  return name
    .trim()
    .toLowerCase()
    // *** Keep Refinement: Remove trailing store numbers/IDs ***
    .replace(/\s+(?:#|store|no|unit|ste)\s*\d+$/g, '')
    .replace(/\s+\d{3,}$/g, '')
    // *** End Refinement ***
    .replace(/\b(inc|llc|corp|ltd|co)\.?$/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9\s]+/g, '')
    .replace(/\s+/g, '_')
    .replace(/^_+|_+$/g, '')
    || "unknown_vendor";
}

const vendorsCollection: CollectionReference<DocumentData> = collection(db, "vendors");
const CACHE_VALIDITY_DAYS = 90;

export async function getVendorAnalysis(normalizedName: string): Promise<VendorAnalysis | null> {
    // ... (Keep the implementation of getVendorAnalysis from the previous response, including validity check) ...
     if (!normalizedName || normalizedName === "unknown_vendor") {
      return null;
  }
  try {
    const vendorDocRef = doc(vendorsCollection, normalizedName);
    const docSnap = await getDoc(vendorDocRef);
    if (docSnap.exists()) {
      const data = docSnap.data() as VendorAnalysis;
      const now = Timestamp.now();
      const validityThreshold = Timestamp.fromMillis(
        now.toMillis() - CACHE_VALIDITY_DAYS * 24 * 60 * 60 * 1000
      );
      if (data.analyzedAt && data.analyzedAt >= validityThreshold) {
        if (data.originalName && data.analysisSource) {
          return data;
        } else {
          console.warn(`getVendorAnalysis: Cached data for "${normalizedName}" is incomplete/malformed.`);
          return null;
        }
      } else {
        return null;
      }
    } else {
      return null;
    }
  } catch (error) {
    console.error(`Error fetching vendor analysis for "${normalizedName}":`, error);
    return null;
  }
}

export async function saveVendorAnalysis(normalizedName: string, data: Omit<VendorAnalysis, 'analyzedAt'> & { analyzedAt?: Timestamp }): Promise<void> {
    // ... (Keep the implementation of saveVendorAnalysis from the previous response) ...
    if (!normalizedName || normalizedName === "unknown_vendor") {
      console.warn(`saveVendorAnalysis: Skipped due to invalid normalized name: "${normalizedName}" from original "${data.originalName}"`);
      return;
   }
   if (!data.originalName || !data.analysisSource) {
       console.warn(`saveVendorAnalysis: Skipped due to missing required fields (originalName, analysisSource) for "${normalizedName}"`);
       return;
   }
  try {
    const vendorDocRef = doc(vendorsCollection, normalizedName);
    const dataToSave: VendorAnalysis = {
        ...data,
        analyzedAt: Timestamp.now()
    };
    await setDoc(vendorDocRef, dataToSave, { merge: true });
  } catch (error) {
    console.error(`Error saving vendor analysis for "${normalizedName}":`, error);
  }
}