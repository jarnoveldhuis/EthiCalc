// src/features/charity/DonationModal.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react"; // Added useCallback
import {
  CharitySearchResult,
  getRecommendedCharities,
  cleanPracticeName
} from "@/features/charity/charityService";
import { CharitySearch } from "./CharitySearch";
import { CharityImage } from "./CharityImage";
import { LoadingSpinner } from "@/shared/ui/LoadingSpinner";
import { useTransactionStore } from "@/store/transactionStore";
import { Transaction } from "@/shared/types/transactions";

interface DonationModalProps {
  practice: string; // This is the Category Name when offsetting by category
  amount: number;
  isOpen: boolean;
  onClose: () => void;
}

export function DonationModal({
  practice, // Represents the Category Name
  amount,
  isOpen,
  onClose,
}: DonationModalProps) {
  const transactions = useTransactionStore(state => state.transactions);
  const [selectedCharity, setSelectedCharity] = useState<CharitySearchResult | null>(null);
  const [donationAmount, setDonationAmount] = useState(Math.max(5, Math.round(amount)));
  const [showSearch, setShowSearch] = useState(false);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialRecommendation, setInitialRecommendation] = useState<CharitySearchResult | null>(null);
  const [dynamicSearchTerm, setDynamicSearchTerm] = useState<string>("");

  const cleanedPractice = cleanPracticeName(practice);
  const displayPractice = cleanedPractice === "All Societal Debt" ? "Total Impact" : practice;

  // --- NEW: Function to find the search term of the most contributing practice ---
  const findDominantPracticeSearchTerm = useCallback((categoryName: string): string => {
    if (!transactions || transactions.length === 0 || categoryName === "All Societal Debt") {
        // Fallback for 'All Societal Debt' or if no transactions
        return categoryName === "All Societal Debt" ? "environment" : categoryName;
    }

    const practiceContributions: { [practice: string]: number } = {};
    let termForDominantPractice: string | undefined = undefined;

    // Calculate total contribution for each unethical practice within the category
    transactions.forEach((tx: Transaction) => {
      (tx.unethicalPractices || []).forEach(practice => {
        // Check if this practice belongs to the target category
        if (tx.practiceCategories?.[practice] === categoryName) {
          const weight = tx.practiceWeights?.[practice] || 0;
          // Ensure amount is positive for calculation, as we only care about magnitude of negative impact
          const contribution = Math.abs(tx.amount) * (weight / 100);
          practiceContributions[practice] = (practiceContributions[practice] || 0) + contribution;
        }
      });
    });

    if (Object.keys(practiceContributions).length === 0) {
        console.log(`[DonationModal] No contributing practices found for category "${categoryName}". Falling back.`);
        return categoryName; // Fallback to category name if no practices found
    }

    // Find the practice with the maximum contribution
    let dominantPractice: string | null = null;
    let maxContribution = -1;
    for (const [practice, contribution] of Object.entries(practiceContributions)) {
      if (contribution > maxContribution) {
        maxContribution = contribution;
        dominantPractice = practice;
      }
    }

    // Find the search term for the dominant practice
    if (dominantPractice) {
        // Find a transaction that has this dominant practice and its search term
        const txWithSearchTerm = transactions.find(
            tx => tx.practiceSearchTerms?.[dominantPractice!]
        );
        termForDominantPractice = txWithSearchTerm?.practiceSearchTerms?.[dominantPractice!];
        console.log(`[DonationModal] Dominant practice in "${categoryName}" is "${dominantPractice}" (Contribution: ${maxContribution.toFixed(2)}). Search Term: "${termForDominantPractice || 'Not Found'}"`);
    }

    // Return the found term, or fallback to category name or default mappings
    if (termForDominantPractice) {
        return termForDominantPractice;
    } else {
        // Fallback mapping if specific term not found for dominant practice
        const fallbackMappings: Record<string, string> = {
            "Factory Farming": "animal welfare", "High Emissions": "climate",
            "Data Privacy Issues": "digital rights", "Water Waste": "water conservation",
            "Environmental Degradation": "conservation",
        };
        const fallback = (dominantPractice && fallbackMappings[dominantPractice]) || categoryName;
        console.log(`[DonationModal] Search term for dominant practice "${dominantPractice}" not found. Using fallback: "${fallback}"`);
        return fallback;
    }
  // --- Add transactions to dependency array ---
  }, [transactions]);


  // --- Wrap fetchRecommendedCharities in useCallback (as before) ---
  const fetchRecommendedCharities = useCallback(async (searchTerm: string) => {
    setLoadingRecommendations(true);
    setError(null);
    setInitialRecommendation(null); // Reset initial recommendation
    setSelectedCharity(null); // Reset selected charity
    console.log(`[DonationModal] Fetching recommendations using term: "${searchTerm}"`);
    try {
      let charities = await getRecommendedCharities(searchTerm);
      if (charities.length === 0) {
        const fallbackTerm = cleanedPractice === "All Societal Debt" ? "environment" : "charity";
        console.log(`[DonationModal] No results for "${searchTerm}", trying fallback: "${fallbackTerm}"`);
        charities = await getRecommendedCharities(fallbackTerm);
      }

      if (charities.length > 0) {
        // --- Prioritization Logic ---
        // Find the first charity in the results that has a websiteUrl
        const charityWithWebsite = charities.find(c => c.websiteUrl);

        // Use the one with a website if found, otherwise default to the very first result
        const initialSelection = charityWithWebsite || charities[0];
        console.log(`[DonationModal] Initial selection: ${initialSelection.name} (Has website: ${!!initialSelection.websiteUrl})`);

        setInitialRecommendation(initialSelection); // Store the chosen one as initial
        setSelectedCharity(initialSelection);      // Select the chosen one
        // --- End Prioritization Logic ---

      } else {
        setError(`Unable to find charity recommendations for "${searchTerm}". Please try searching.`);
        setShowSearch(true); // Go directly to search if no recommendations
      }
    } catch (err) {
      console.error("[DonationModal] Recommendation fetch error:", err)
      setError("Unable to load charity recommendations. Please try searching.");
      setShowSearch(true);
    } finally {
      setLoadingRecommendations(false);
    }
  // Add cleanedPractice to dependency array as it's used in fallback logic
  }, [cleanedPractice]);


  // Fetch recommended charities (useEffect depends on new function)
  useEffect(() => {
    if (isOpen) {
      setSelectedCharity(null);
      setInitialRecommendation(null);
      setShowSearch(false);
      setDonationAmount(Math.max(5, Math.round(amount)));

      // --- Determine the search term using the new logic ---
      const termToUse = findDominantPracticeSearchTerm(practice); // Call new function
      setDynamicSearchTerm(termToUse);
      fetchRecommendedCharities(termToUse);
    }
  // --- Update dependency array ---
  }, [isOpen, practice, amount, transactions, findDominantPracticeSearchTerm, fetchRecommendedCharities]);


  // Handler for selecting charity from search (remains the same)
  const handleSearchSelect = (charity: CharitySearchResult) => {
    setSelectedCharity(charity);
    setShowSearch(false);
    setError(null);
  };

  // Handle triggering the Every.org widget (remains the same)
  const handleTriggerEveryOrgWidget = () => {
     if (!selectedCharity) { setError("Please select a charity first."); return; }
    setError(null);
    const charitySlug = selectedCharity.slug || selectedCharity.id;
    const finalAmount = Math.max(1, donationAmount);
    console.log(`[DonationModal] Triggering Every.org widget for: ${selectedCharity.name} (Slug/ID: ${charitySlug}), Amount: ${finalAmount}`);
    if (window.everyDotOrgDonateButton) {
        try {
            const optionsToSet = { nonprofitSlug: charitySlug, amount: finalAmount, noExit: false, primaryColor: '#000000', };
            console.log(`[DonationModal] Calling setOptions with:`, optionsToSet);
            window.everyDotOrgDonateButton.setOptions(optionsToSet);
            console.log(`[DonationModal] Calling showWidget()`);
            window.everyDotOrgDonateButton.showWidget();
            onClose();
        } catch (widgetError) {
             console.error("Error configuring or showing Every.org widget:", widgetError);
             setError("Could not initiate donation widget.");
        }
    } else {
        console.error("Every.org widget script not loaded.");
        setError("Donation service is not available. Please try again later.");
    }
  };


  // --- Rest of the component JSX remains the same ---
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
       <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
         {/* Modal Content */}
         <div className="p-6 space-y-4">
           {/* Header */}
           <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100"> Offset: {displayPractice} </h2>
              <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 text-2xl">&times;</button>
           </div>
           {/* Calculated Amount */}
           <div className="text-sm text-gray-600 dark:text-gray-300"> Calculated impact amount: <span className="font-semibold text-red-600 dark:text-red-400 ml-1"> ${Math.abs(amount).toFixed(2)} </span> </div>
           {/* Error Display */}
           {error && ( <div className="my-2 p-3 bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-300 rounded-md text-sm"> {error} </div> )}
           {/* Charity Display / Search Area */}
           <div className="space-y-3">
             {showSearch ? (
                 <div> <CharitySearch initialSearchTerm={dynamicSearchTerm} onSelect={handleSearchSelect} /> </div>
             ) : (
                 <div className="space-y-3 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-700 dark:text-gray-200 text-base mb-3"> {selectedCharity === initialRecommendation ? "Recommended Charity" : "Selected Charity"} </h3>
                    {loadingRecommendations ? ( <LoadingSpinner message="Finding recommended charity..." /> ) : selectedCharity ? (
                        <div className="space-y-2">
                            <div className="flex items-start space-x-3">
                                <CharityImage src={selectedCharity.logoUrl} alt={selectedCharity.name} className="flex-shrink-0 mt-1" width={48} height={48}/>
                                <div className="flex-grow min-w-0">
                                    <h4 className="font-medium text-lg text-blue-800 dark:text-blue-300">{selectedCharity.name}</h4>
                                    <p className="text-sm text-gray-700 dark:text-gray-300 mt-1 whitespace-normal break-words">{selectedCharity.mission}</p>
                                    <div className="mt-1 space-x-3">
                                        <a href={selectedCharity.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 dark:text-blue-400 hover:underline hover:text-blue-800 dark:hover:text-blue-300 inline-block"> View on Every.org ↗ </a>
                                        {selectedCharity.websiteUrl && ( <a href={selectedCharity.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-green-600 dark:text-green-400 hover:underline hover:text-green-800 dark:hover:text-green-300 inline-block"> Official Website ↗ </a> )}
                                    </div>
                                </div>
                            </div>
                            <div className="text-right pt-2"> <button onClick={() => { setShowSearch(true); setError(null); }} className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium underline" > Choose a different charity </button> </div>
                        </div>
                    ) : ( !loadingRecommendations && <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">Could not find a charity.</p> )}
                </div>
             )}
           </div>
           {/* Donation Amount Input */}
           {selectedCharity && !showSearch && (
              <div>
                 <label htmlFor="donationAmountInput" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Donation Amount</label>
                 <div className="flex items-center"> <span className="text-gray-500 dark:text-gray-400 text-lg mr-1">$</span> <input id="donationAmountInput" type="number" min="1" value={donationAmount} onChange={(e) => setDonationAmount(Math.max(1, Number(e.target.value)))} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400" aria-label="Donation Amount" /> </div>
                 {donationAmount < 5 && <p className="text-xs text-orange-600 mt-1">Note: Minimum donation is often $5.</p>}
              </div>
           )}
           {/* Action Buttons */}
           <div className="flex justify-end space-x-3 pt-3 border-t border-gray-200 dark:border-gray-700">
             <button onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-800 dark:text-gray-100 rounded-lg text-sm font-medium"> Cancel </button>
             {!showSearch && selectedCharity && ( <button onClick={handleTriggerEveryOrgWidget} disabled={!selectedCharity || donationAmount < 1} className={`px-5 py-2 rounded-lg text-white text-sm font-semibold ${ selectedCharity && donationAmount >= 1 ? "bg-green-600 hover:bg-green-700" : "bg-gray-400 dark:bg-gray-500 cursor-not-allowed" }`} > Donate ${donationAmount} </button> )}
           </div>
         </div>
       </div>
    </div>
  );
}