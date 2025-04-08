// src/features/charity/CharitySearch.tsx
"use client";

import React, { useState, useEffect } from "react";
import { searchCharities, CharitySearchResult } from "./charityService"; // Removed cleanPracticeName import
import { CharityImage } from "./CharityImage";
import { LoadingSpinner } from "@/shared/ui/LoadingSpinner";

interface CharitySearchProps {
  initialSearchTerm: string; // Changed prop name
  onSelect: (charity: CharitySearchResult) => void;
}

export function CharitySearch({
  initialSearchTerm,
  onSelect,
}: CharitySearchProps) {
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm); // Use prop for initial state
  const [results, setResults] = useState<CharitySearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Removed useEffect that mapped practice to searchTerm

  // Reset search term if the initial prop changes
  useEffect(() => {
    setSearchTerm(initialSearchTerm);
  }, [initialSearchTerm]);

  // Search for charities when search term changes (debounced)
  // In src/features/charity/CharitySearch.jsx

  // Search for charities when search term changes (debounced)
  useEffect(() => {
    if (!searchTerm) {
      setResults([]);
      setError(null); // Clear error when search term is cleared
      return;
    }
    setLoading(true);
    const timer = setTimeout(() => {
      setError(null);
      searchCharities(searchTerm)
        .then((data) => {
          // --- ADD SORTING LOGIC HERE ---
          const sortedData = data.sort((a, b) => {
            const aHasWebsite = !!a.websiteUrl; // Check if a has a non-empty websiteUrl
            const bHasWebsite = !!b.websiteUrl; // Check if b has a non-empty websiteUrl

            if (aHasWebsite && !bHasWebsite) {
              return -1; // a comes first if it has a website and b doesn't
            } else if (!aHasWebsite && bHasWebsite) {
              return 1; // b comes first if it has a website and a doesn't
            } else {
              return 0; // Keep original relative order if both have/lack website
              // Optionally add secondary sort: return a.name.localeCompare(b.name);
            }
          });
          // --- END SORTING LOGIC ---

          // Set the *sorted* data as the results
          setResults(sortedData);
        })
        .catch((err) => {
          console.error("Search error:", err);
          setError("Failed to search charities. Please try again.");
          setResults([]); // Clear results on error
        })
        .finally(() => setLoading(false));
    }, 500); // 500ms debounce
    return () => clearTimeout(timer);
  }, [searchTerm]); // Dependency remains searchTerm

  return (
    <div className="w-full p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      {/* Input field with added text/placeholder colors */}
      <div className="mb-4">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search charities by name or cause..."
          // Added text color for input and placeholder for visibility
          className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400"
          aria-label="Search for charities"
        />
      </div>

      {/* Results Area */}
      <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
        {loading ? (
          <LoadingSpinner message="Searching..." />
        ) : error ? (
          <div className="text-red-600 dark:text-red-400 p-3 text-sm">
            {error}
          </div>
        ) : results.length === 0 && searchTerm ? (
          <p className="text-gray-500 dark:text-gray-400 text-center text-sm py-4">
            {`No charities found for "{searchTerm}". Try a different search term.`}
          </p>
        ) : (
          // Results Mapping (wrapping handled previously)
          results.map((charity) => (
            <div
              key={charity.id || charity.name}
              className="border border-gray-200 dark:border-gray-600 rounded p-3 hover:bg-blue-50 dark:hover:bg-gray-700 cursor-pointer transition-colors bg-white dark:bg-gray-700/[0.3]"
              onClick={() => onSelect(charity)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") onSelect(charity);
              }}
            >
              <div className="flex items-start space-x-3">
                <CharityImage
                  src={charity.logoUrl}
                  alt={charity.name}
                  className="mr-3 flex-shrink-0 mt-1"
                  width={40}
                  height={40}
                />
                <div className="flex-grow min-w-0">
                  <h4 className="font-medium text-blue-700 dark:text-blue-400 text-base whitespace-normal break-words">
                    {charity.name}
                  </h4>
                  <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 whitespace-normal break-words">
                    {charity.mission || "No mission description available."}
                  </p>
                  {charity.category && (
                    <span className="mt-1 inline-block text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-1.5 py-0.5 rounded-full">
                      {charity.category}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
