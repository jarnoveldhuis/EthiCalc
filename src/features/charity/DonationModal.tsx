// src/features/charity/DonationModal.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  cleanPracticeName
} from "@/features/charity/charityService";
import { EnrichedCharityResult } from '@/features/charity/types';
import { enhancedCharityService } from '@/features/charity/enhancedCharityService';

import { CharityRating } from './CharityRating';
import { CharitySearch } from "./CharitySearch";
import { CharityImage } from "./CharityImage";
import { LoadingSpinner } from "@/shared/ui/LoadingSpinner";
// Removed useTransactionStore and Transaction as they are no longer needed for findDominantPracticeSearchTerm

interface DonationModalProps {
  practice: string; // This is the category name or "All Societal Debt"
  amount: number;
  isOpen: boolean;
  onClose: () => void;
}

export function DonationModal({
  practice, // This prop directly represents the category or "All Societal Debt"
  amount,
  isOpen,
  onClose,
}: DonationModalProps) {
  const [selectedCharity, setSelectedCharity] = useState<EnrichedCharityResult | null>(null);
  const [donationAmount, setDonationAmount] = useState(Math.max(5, Math.round(amount)));
  const [showSearch, setShowSearch] = useState(false);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialRecommendation, setInitialRecommendation] = useState<EnrichedCharityResult | null>(null);
  const [dynamicSearchTerm, setDynamicSearchTerm] = useState<string>("");

  const cleanedPractice = cleanPracticeName(practice); // Used for display and potentially initial search
  const displayPractice = cleanedPractice === "All Societal Debt" ? "Total Impact" : practice;

  // Simplified fetchRecommendedCharities: searchTerm is now directly based on the practice/category prop
  const fetchRecommendedCharities = useCallback(async (searchTerm: string) => {
    setLoadingRecommendations(true);
    setError(null);
    setInitialRecommendation(null);
    setSelectedCharity(null);

    try {
      let charities = await enhancedCharityService.getTopRatedCharitiesWithPaymentLinks(searchTerm);

      if (charities.length > 0) {
        const initialSelection = charities[0];
        setInitialRecommendation(initialSelection);
        setSelectedCharity(initialSelection);
      } else {
         // Fallback if no charities found for the direct category term
         const fallbackTerm = cleanedPractice === "All Societal Debt" ? "environment" : "charity";
         console.log(`[DonationModal] No results for "${searchTerm}", trying broader fallback: "${fallbackTerm}"`);
         charities = await enhancedCharityService.getTopRatedCharitiesWithPaymentLinks(fallbackTerm);

         if (charities.length > 0) {
             const initialSelection = charities[0];
             setInitialRecommendation(initialSelection);
             setSelectedCharity(initialSelection);
         } else {
             setError(`Could not find charity recommendations for "${searchTerm}" or fallback terms. Please try searching manually.`);
             setShowSearch(true); // Encourage manual search
         }
      }
    } catch (err) {
      console.error("[DonationModal] Recommendation fetch error:", err);
      setError("Error loading charity recommendations. Please search manually.");
      setShowSearch(true); // Encourage manual search
    } finally {
      setLoadingRecommendations(false);
    }
  }, [cleanedPractice]); // Depends on cleanedPractice for the fallback logic

   useEffect(() => {
     if (isOpen) {
       setSelectedCharity(null);
       setInitialRecommendation(null);
       setShowSearch(false);
       setDonationAmount(Math.max(5, Math.round(amount)));

       // Directly use the cleanedPractice (category name or mapped "All Societal Debt" via API)
       // The API handler for /api/charity/recommend already maps "All Societal Debt" to "climate"
       // and uses other practice names (category names) directly.
       const termToUse = cleanedPractice;
       
       setDynamicSearchTerm(termToUse); // For CharitySearch initial term
       fetchRecommendedCharities(termToUse);
     }
   }, [isOpen, practice, amount, fetchRecommendedCharities, cleanedPractice]); // Added cleanedPractice

  const handleSearchSelect = (charity: EnrichedCharityResult) => {
    setSelectedCharity(charity);
    setShowSearch(false);
    setError(null);
  };

  const handleTriggerEveryOrgWidget = () => {
     if (!selectedCharity) { setError("Please select a charity first."); return; }
     setError(null);
     const getSlugOrId = (char: EnrichedCharityResult): string => {
        if (char.slug) return char.slug;
        if (char.id?.startsWith('ein:')) return char.id.split(':')[1];
        if (char.id) return char.id;
        return char.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
     }
     const charityIdentifier = getSlugOrId(selectedCharity);
     const finalAmount = Math.max(1, donationAmount);

     console.log(`[DonationModal] Triggering Every.org widget for: ${selectedCharity.name} (Identifier: ${charityIdentifier}), Amount: ${finalAmount}`);

     if (window.everyDotOrgDonateButton) {
         try {
             const optionsToSet = {
                 nonprofitSlug: charityIdentifier,
                 amount: finalAmount,
                 noExit: false,
                 primaryColor: '#3b82f6',
             };
             window.everyDotOrgDonateButton.setOptions(optionsToSet);
             window.everyDotOrgDonateButton.showWidget();
         } catch (widgetError) {
              console.error("Error configuring or showing Every.org widget:", widgetError);
              setError("Could not initiate donation widget.");
         }
     } else {
         console.error("Every.org widget script not loaded.");
         setError("Donation service is not available. Please try again later.");
     }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
       <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
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
                    <h3 className="font-semibold text-gray-700 dark:text-gray-200 text-base mb-3">
                        {selectedCharity === initialRecommendation ? "Highest Rated Recommendation" : "Selected Charity"}
                    </h3>
                    {loadingRecommendations ? ( <LoadingSpinner message="Finding best charity..." /> ) : selectedCharity ? (
                        <div className="space-y-2">
                            <div className="flex flex-shrink-0 items-start space-x-3">
                                <CharityImage src={selectedCharity.logoUrl} alt={selectedCharity.name} className="flex-shrink-0 mt-1" width={48} height={48}/>
                                <div className="flex-grow min-w-0">
                                    <h4 className="font-medium text-lg text-blue-800 dark:text-blue-300">{selectedCharity.name}</h4>
                                    <CharityRating charity={selectedCharity} />
                                    {dynamicSearchTerm && (
                                        <p className="text-xs text-[var(--muted-foreground)] mt-1">
                                            Searching: {dynamicSearchTerm}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <p className="text-sm text-gray-700 dark:text-gray-300 mt-1 whitespace-normal break-words">{selectedCharity.mission || selectedCharity.cnRating?.mission}</p>
                            <div className="mt-1 space-x-3">
                                {(selectedCharity.websiteUrl || selectedCharity.cnRating?.websiteUrl) && (
                                    <a href={selectedCharity.websiteUrl || selectedCharity.cnRating?.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-green-600 dark:text-green-400 hover:underline hover:text-green-800 dark:hover:text-green-300 inline-block">
                                        Official Website ↗
                                     </a>
                                )}
                            </div>
                            <div className="text-right pt-2">
                               <button
                                 onClick={() => { setShowSearch(true); setError(null); }}
                                 className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium underline"
                               >
                                 Choose a different charity
                               </button>
                             </div>
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