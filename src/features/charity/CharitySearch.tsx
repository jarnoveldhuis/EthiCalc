// src/features/charity/CharitySearch.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  CharityNavigatorRating,
  EnrichedCharityResult,
} from "@/features/charity/types"; // Keep EnrichedCharityResult
import { enhancedCharityService } from "@/features/charity/enhancedCharityService";
// import { charityNavigatorService } from './charityNavigatorService'; // Needed for EIN lookup potentially
import { searchCharities as searchEveryOrg } from "./charityService"; // Basic Every.org search

import { CharityImage } from "./CharityImage";
import { LoadingSpinner } from "@/shared/ui/LoadingSpinner";
import { CharityRating } from "./CharityRating";

// Helper function to normalize EINs (remove prefix and hyphens)
const normalizeEin = (id: string | undefined | null): string | null => {
  if (!id) return null;
  const einPattern = /(\d{2})-?(\d{7})/; // Matches 9 digits with optional hyphen
  const match = String(id).match(einPattern);
  return match ? `${match[1]}${match[2]}` : null; // Return only the 9 digits or null
};

// Helper function to parse score safely (handles strings, nulls, undefined)
const parseScore = (score: string | number | null | undefined): number => {
  if (typeof score === "number") {
    return !isNaN(score) ? score : -1; // Return -1 for NaN numbers
  }
  if (typeof score === "string") {
    const parsed = parseFloat(String(score)); // Ensure string for parseFloat
    return !isNaN(parsed) ? parsed : -1; // Return -1 if string parsing fails
  }
  return -1; // Default for null, undefined, or other types
};

interface CharitySearchProps {
  initialSearchTerm: string;
  onSelect: (charity: EnrichedCharityResult) => void;
}

export function CharitySearch({
  initialSearchTerm,
  onSelect,
}: CharitySearchProps) {
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const [results, setResults] = useState<EnrichedCharityResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const performSearchAndSort = useCallback(
    async (currentSearchTerm: string) => {
      if (!currentSearchTerm) {
        setResults([]);
        setError(null);
        return;
      }
      setLoading(true);
      setError(null);

      try {
        // Fetch CN and EO results in parallel
        const [cnResponse, eoCharities] = await Promise.all([
          fetch(
            `/api/charity/navigator/search?term=${encodeURIComponent(
              currentSearchTerm
            )}`
          ),
          searchEveryOrg(currentSearchTerm), // Basic Every.org search
        ]);

        let cnCharities: CharityNavigatorRating[] = [];
        if (cnResponse.ok) {
          const cnData = await cnResponse.json();
          cnCharities = cnData.charities || [];
        } else {
          console.warn(`Charity Navigator search failed: ${cnResponse.status}`);
        }

        // Use a Map for robust deduplication based on normalized EIN first, then slug, then name
        const combinedResults = new Map<string, EnrichedCharityResult>();

        // --- Step 1: Process Charity Navigator Results (Prioritize EIN) ---
        for (const cnCharity of cnCharities) {
          const einKey = normalizeEin(cnCharity.ein);
          if (einKey && !combinedResults.has(`ein:${einKey}`)) {
            // Try to find matching Every.org data *immediately* for enrichment
            const eoMatch =
              await enhancedCharityService.findMatchingEveryOrgCharity(
                cnCharity
              );
            if (eoMatch) {
              // Combine EO data with CN rating
              combinedResults.set(`ein:${einKey}`, {
                ...eoMatch, // Base info from Every.org
                cnRating: cnCharity, // Add the CN rating we already have
              });
            } else {
              // Keep CN result even without EO match, using EIN as ID
              combinedResults.set(`ein:${einKey}`, {
                id: `ein:${einKey}`, // Use namespaced ID
                name: cnCharity.name,
                url: cnCharity.charityNavigatorUrl || "",
                mission:
                  cnCharity.mission ||
                  "Mission details available on Charity Navigator.",
                category: cnCharity.cause || "Unknown",
                websiteUrl: cnCharity.websiteUrl,
                // slug will be missing here
                cnRating: cnCharity,
              });
            }
          }
          // Optional: Handle CN results without EINs (e.g., using name as key), but might lead to more duplicates
          else if (
            !combinedResults.has(`name:${cnCharity.name.toLowerCase()}`)
          ) {
            // We could potentially add CN-only results by name, but risk duplicates if name matching isn't perfect.
            // For now, prioritize EIN matching for better accuracy.
          }
        }

        // --- Step 2: Process Every.org Results, merging or adding if not present ---
        for (const eoCharity of eoCharities) {
          const einKey = normalizeEin(eoCharity.id);
          let uniqueKey: string | null = null;

          if (einKey) {
            uniqueKey = `ein:${einKey}`;
          } else if (eoCharity.slug) {
            uniqueKey = `slug:${eoCharity.slug}`;
          } else {
            uniqueKey = `name:${eoCharity.name.toLowerCase()}`; // Fallback to name
          }

          if (uniqueKey && combinedResults.has(uniqueKey)) {
            // Already exists (likely from CN processing), potentially merge missing fields if needed
            const existingEntry = combinedResults.get(uniqueKey)!;
            if (!existingEntry.slug && eoCharity.slug)
              existingEntry.slug = eoCharity.slug;
            if (!existingEntry.logoUrl && eoCharity.logoUrl)
              existingEntry.logoUrl = eoCharity.logoUrl;
            // Add more merge logic if necessary
            continue; // Don't add a duplicate entry
          }

          // If it's a new entry (not found by EIN, slug, or name), add it
          if (uniqueKey && !combinedResults.has(uniqueKey)) {
            // Fetch CN rating if we haven't already processed it via CN results
            let cnRating: CharityNavigatorRating | null = null;
            if (einKey) {
              // Only fetch rating if we have an EIN
              const ratingData = await fetch(
                `/api/charity/ratings?ein=${einKey}`
              );
              if (ratingData.ok) {
                const ratingJson = await ratingData.json();
                if (
                  ratingJson.rating &&
                  typeof ratingJson.rating === "object"
                ) {
                  cnRating = {
                    /* ... map fields carefully ... */
                    ein: ratingJson.rating.ein || einKey,
                    name: ratingJson.rating.name || eoCharity.name,
                    mission: ratingJson.rating.mission,
                    websiteUrl:
                      ratingJson.rating.websiteUrl ||
                      ratingJson.rating.websiteURL,
                    charityNavigatorUrl:
                      ratingJson.rating.charityNavigatorUrl ||
                      ratingJson.rating.charityNavigatorURL,
                    score: ratingJson.rating.score ?? null,
                    ratingStars:
                      ratingJson.rating.ratingStars ??
                      ratingJson.rating.rating ??
                      null,
                    cause:
                      ratingJson.rating.cause ||
                      ratingJson.rating.category?.categoryName,
                    hasAdvisories: ratingJson.rating.hasAdvisories ?? false,
                  };
                }
              }
            }
            combinedResults.set(uniqueKey, { ...eoCharity, cnRating });
          }
        }

        // --- Step 3: Sort Combined Results ---
        const finalResults = Array.from(combinedResults.values()).sort(
          (a, b) => {
            const scoreA = parseScore(a.cnRating?.score);
            const scoreB = parseScore(b.cnRating?.score);
            if (scoreB !== scoreA) return scoreB - scoreA; // Highest score first
            if (a.cnRating && !b.cnRating) return -1; // Prioritize rated
            if (!a.cnRating && b.cnRating) return 1;
            return a.name.localeCompare(b.name); // Alphabetical tie-break
          }
        );

        setResults(finalResults);
      } catch (err) {
        console.error("Charity search/sort error:", err);
        setError("Failed to search charities. Please try again.");
        setResults([]);
      } finally {
        setLoading(false);
      }
      // Removed `enhancedCharityService` from dependency array as it's used internally, not as a prop
    },
    []
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      performSearchAndSort(searchTerm);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm, performSearchAndSort]);

  return (
    <div className="w-full p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      {/* Input field */}
      <div className="mb-4">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search charities by name, EIN, or cause..."
          className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400"
          aria-label="Search for charities"
        />
      </div>

      {/* Results Area */}
      <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
        {/* Loading State */}
        {loading && <LoadingSpinner message="Searching & Sorting..." />}

        {/* Error State */}
        {!loading && error && (
          <div className="text-red-600 dark:text-red-400 p-3 text-sm">
            {" "}
            {error}{" "}
          </div>
        )}

        {/* No Results State */}
        {!loading && !error && results.length === 0 && searchTerm && (
          <p className="text-gray-500 dark:text-gray-400 text-center text-sm py-4">
            {" "}
            {`No charities found for "${searchTerm}". Try a different search.`}{" "}
          </p>
        )}

        {/* Results List */}
        {!loading &&
          !error &&
          results.length > 0 &&
          results.map((charity) => {
            // Use a reliable key for React rendering
            const renderKey =
              normalizeEin(charity.id) || charity.slug || charity.name;
            return (
              <div
                key={renderKey}
                className="border border-gray-200 dark:border-gray-600 rounded p-3 hover:bg-blue-50 dark:hover:bg-gray-700 cursor-pointer transition-colors bg-white dark:bg-gray-700/[0.3]"
                onClick={() => onSelect(charity)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") onSelect(charity);
                }}
              >
                <div className="flex items-start space-x-3">
                  {/* Image Container: Prevent shrinking */}
                  <div className="flex-shrink-0">
                    <CharityImage
                      src={charity.logoUrl}
                      alt={charity.name}
                      width={40}
                      height={40}
                    />
                  </div>
                  {/* Text Container: Allow growing, set min-width */}
                  <div className="flex-grow min-w-0">
                    <h4 className="font-medium text-blue-700 dark:text-blue-400 text-base whitespace-normal break-words">
                      {" "}
                      {charity.name}{" "}
                    </h4>
                  </div>
                </div>
                <CharityRating charity={charity} />
                {/* Conditionally render mission if it exists */}
                {(charity.mission || charity.cnRating?.mission) && (
                  <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 whitespace-normal break-words">
                    {charity.mission || charity.cnRating?.mission}
                  </p>
                )}
                {/* Category/Cause */}
                {(charity.category || charity.cnRating?.cause) && (
                  <span className="mt-1 inline-block text-xxs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-1.5 py-0.5 rounded-full">
                    {charity.category || charity.cnRating?.cause}
                  </span>
                )}
                {/* Uncomment below if you prefer mission below the flex box */}
                {/* {(charity.mission || charity.cnRating?.mission) && (
                                    <p className="text-xs text-gray-600 dark:text-gray-300 mt-2 whitespace-normal break-words">
                                        {charity.mission || charity.cnRating?.mission}
                                    </p>
                                )} */}
              </div>
            );
          }) // End map
        }
      </div>
    </div>
  );
}
