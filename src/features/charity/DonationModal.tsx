// src/features/charity/DonationModal.tsx
"use client";

import { useState, useEffect } from "react";
import { 
  CharitySearchResult, 
  getRecommendedCharities, 
  createDonationUrl, 
  cleanPracticeName 
} from "./charityService";
import { CharitySearch } from "./CharitySearch";
import { CharityImage } from "./CharityImage";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

interface DonationModalProps {
  practice: string;
  amount: number;
  isOpen: boolean;
  onClose: () => void;
}

export function DonationModal({
  practice,
  amount,
  isOpen,
  onClose,
}: DonationModalProps) {
  // State management
  const [selectedCharity, setSelectedCharity] = useState<CharitySearchResult | null>(null);
  const [donationAmount, setDonationAmount] = useState(Math.max(5, Math.round(amount)));
  const [showSearch, setShowSearch] = useState(false);
  const [recommendedCharities, setRecommendedCharities] = useState<CharitySearchResult[]>([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Format practice name for display
  const cleanedPractice = cleanPracticeName(practice);
  const displayPractice = cleanedPractice === "All Societal Debt" ? "Total Impact" : practice;
  const isAllSocietalDebt = cleanedPractice === "All Societal Debt";

  // Fetch recommended charities when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchRecommendedCharities();
    }
  }, [isOpen, practice]); // eslint-disable-line react-hooks/exhaustive-deps

  // Set a default charity when recommendations load
  useEffect(() => {
    if (recommendedCharities.length > 0 && !selectedCharity) {
      setSelectedCharity(recommendedCharities[0]);
    }
  }, [recommendedCharities, selectedCharity]);

  // Function to fetch recommended charities
  const fetchRecommendedCharities = async () => {
    setLoadingRecommendations(true);
    setError(null);
    
    try {
      console.log(`Fetching charities for: ${practice}`);
      const charities = await getRecommendedCharities(practice);
      
      if (charities.length === 0) {
        // If no specific recommendations, try a more generic search term
        const fallbackTerm = isAllSocietalDebt ? "environment" : "charity";
        console.log(`No results, trying fallback term: ${fallbackTerm}`);
        const fallbackCharities = await getRecommendedCharities(fallbackTerm);
        setRecommendedCharities(fallbackCharities);
      } else {
        setRecommendedCharities(charities);
      }
    } catch (error) {
      console.error("Error fetching recommended charities:", error);
      setError("Unable to load charity recommendations. Please try searching manually.");
    } finally {
      setLoadingRecommendations(false);
    }
  };

  // Handle donation submission
  const handleDonate = () => {
    if (!selectedCharity) return;
    
    try {
      // Get charity ID from the URL or the ID field
      const charityId = selectedCharity.id || 
                         selectedCharity.url?.split('/').pop() || 
                         'everydotorg';
      
      // Create donation URL consistently using our helper
      const donationUrl = createDonationUrl(
        charityId, 
        donationAmount, 
        practice
      );
      
      console.log("Opening donation URL:", donationUrl);
      
      // Open donation URL in a new tab
      window.open(donationUrl, "_blank");
      onClose();
    } catch (error) {
      console.error("Error processing donation:", error);
      setError("Something went wrong. Please try again.");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            Offset Your Impact: {displayPractice}
          </h2>
          
          <div className="mb-6">
            <p className="text-gray-700 mb-2">
              Your calculated impact:
            </p>
            <p className="text-2xl font-bold text-red-600">
              ${Math.abs(amount).toFixed(2)}
            </p>
          </div>
          
          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">
              {error}
            </div>
          )}
          
          {selectedCharity && !showSearch ? (
            <div className="mb-6 p-4 border border-gray-200 rounded">
              <h3 className="font-semibold text-blue-600">{selectedCharity.name}</h3>
              {selectedCharity.mission && (
                <p className="text-gray-600 text-sm mt-1 mb-2">{selectedCharity.mission}</p>
              )}
              <div className="mt-2 flex justify-end">
                <button
                  onClick={() => setShowSearch(true)}
                  className="text-blue-600 hover:text-blue-800 text-sm underline"
                >
                  Change Charity
                </button>
              </div>
            </div>
          ) : showSearch ? (
            <div className="mb-6">
              <CharitySearch
                practice={practice}
                onSelect={(charity) => {
                  setSelectedCharity(charity);
                  setShowSearch(false);
                }}
              />
              <button
                onClick={() => {
                  setShowSearch(false);
                  fetchRecommendedCharities();
                }}
                className="mt-2 text-blue-600 hover:text-blue-800 text-sm underline"
              >
                Back to recommendations
              </button>
            </div>
          ) : (
            <div className="mb-6">
              <h3 className="font-semibold text-gray-800 mb-3">Recommended Charities</h3>
              
              {loadingRecommendations ? (
                <LoadingSpinner message="Finding recommended charities..." />
              ) : recommendedCharities.length === 0 ? (
                <div className="text-center p-4">
                  <p className="text-gray-700 mb-2">No specific recommendations found.</p>
                  <button
                    onClick={() => setShowSearch(true)}
                    className="text-blue-600 hover:text-blue-800 underline"
                  >
                    Search for a charity
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {recommendedCharities.map((charity) => (
                    <div
                      key={charity.id || charity.name}
                      className="border border-gray-200 rounded p-3 hover:bg-blue-50 cursor-pointer"
                      onClick={() => setSelectedCharity(charity)}
                    >
                      <div className="flex items-center">
                        <CharityImage
                          src={charity.logoUrl}
                          alt={charity.name}
                          className="mr-3"
                          width={40}
                          height={40}
                        />
                        <div>
                          <h4 className="font-medium text-blue-700">{charity.name}</h4>
                          <p className="text-xs text-gray-700 truncate">{charity.mission}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  <div className="text-center pt-2">
                    <button
                      onClick={() => setShowSearch(true)}
                      className="text-blue-600 hover:text-blue-800 text-sm underline"
                    >
                      Search for more charities
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          
          <div className="mb-6">
            <label className="block text-gray-700 mb-2">Donation Amount</label>
            <div className="flex items-center">
              <span className="text-gray-700 text-lg mr-2">$</span>
              <input
                type="number"
                min="1"
                value={donationAmount}
                onChange={(e) => setDonationAmount(Number(e.target.value))}
                className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-800 font-medium"
              />
            </div>
          </div>
          
          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleDonate}
              disabled={!selectedCharity}
              className={`px-4 py-2 rounded-lg text-white ${
                selectedCharity
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-gray-400 cursor-not-allowed"
              }`}
            >
              Donate Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}