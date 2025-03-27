// src/features/dashboard/components/DashboardSidebar.tsx
"use client";

import { useState, useCallback } from "react";
import { DonationModal } from "@/features/charity/DonationModal";
import { UserCreditState } from "@/hooks/useCreditState";
import { ImpactAnalysis } from "@/core/calculations/type";
// import { useUIStore } from "@/store/uiStore";

interface DashboardSidebarProps {
  impactAnalysis: ImpactAnalysis | null;
  activeView: string;
  onViewChange: (view: string) => void;
  onApplyCredit: (amount: number) => Promise<boolean>;
  creditState?: UserCreditState | null;
  isApplyingCredit: boolean;
  hasTransactions: boolean;
  negativeCategories: Array<{name: string; amount: number}>;
  positiveCategories: Array<{name: string; amount: number}>;
  isBankConnected?: boolean;
  connectBankProps?: {
    onSuccess: (publicToken: string | null) => Promise<void>;
    isLoading: boolean;
    isSandboxMode: boolean;
  };
}

export function DashboardSidebar({
  impactAnalysis,
  activeView,
  onViewChange,
  onApplyCredit,
  // creditState,
  isApplyingCredit,
  hasTransactions,
  // negativeCategories,
  // positiveCategories
  isBankConnected,
  connectBankProps
}: DashboardSidebarProps) {
  // Local UI state
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [isDonationModalOpen, setIsDonationModalOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Credit button should be disabled if:
  // - No positive impact available
  // - Currently applying credit
  // - No effective debt to offset
  const creditButtonDisabled = !impactAnalysis || 
    impactAnalysis.availableCredit <= 0 || 
    isApplyingCredit || 
    impactAnalysis.effectiveDebt <= 0;

  // Get color based on societal debt (use effective debt for styling)
  const getDebtColor = useCallback((debt: number): string => {
    if (debt <= 0) return "from-green-500 to-teal-600";
    if (debt < 50) return "from-yellow-500 to-orange-600";
    return "from-red-500 to-pink-600";
  }, []);

  // Handle applying social credit to debt
  const handleApplyCredit = async () => {
    // Double-check button should be enabled to prevent race conditions
    if (creditButtonDisabled) {
      console.log("Credit button is disabled but was clicked anyway");
      return;
    }

    try {
      // Use the amount of positive impact available, capped by effective debt
      const amountToApply = impactAnalysis?.availableCredit || 0;

      if (amountToApply <= 0) {
        setFeedbackMessage("No debt to offset with credit");
        setShowFeedback(true);
        setTimeout(() => setShowFeedback(false), 3000);
        return;
      }

      const success = await onApplyCredit(amountToApply);

      if (success) {
        // Show feedback after successful application
        setFeedbackMessage(
          `Applied $${amountToApply.toFixed(2)} credit to your social debt`
        );
        setShowFeedback(true);

        // Hide feedback after 3 seconds
        setTimeout(() => {
          setShowFeedback(false);
        }, 3000);
      }
    } catch (error) {
      console.error("Error applying credit:", error);
      setFeedbackMessage("Failed to apply credit. Please try again.");
      setShowFeedback(true);
      setTimeout(() => setShowFeedback(false), 3000);
    }
  };

  // Handle opening donation modal
  const handleOpenDonationModal = () => {
    setIsDonationModalOpen(true);
  };

  // Toggle mobile menu
  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <div className="w-full lg:col-span-1">
      {/* Societal Credit Score */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
        <div
          className={`bg-gradient-to-r ${getDebtColor(
            impactAnalysis?.effectiveDebt || 0
          )} p-4 sm:p-6 text-white`}
        >
          <div className="text-center">
            <h2 className="text-lg sm:text-xl font-bold mb-1">
              Total Social Debt
            </h2>
            <div className="text-4xl sm:text-5xl font-black mb-2">
              ${Math.abs(impactAnalysis?.effectiveDebt || 0).toFixed(2)}
            </div>
            <div>
                Credit applied: $
                {impactAnalysis?.appliedCredit.toFixed(2) || "0.00"}
              </div>

            {/* Only show Offset button if there's effective debt */}
            {(impactAnalysis?.effectiveDebt || 0) > 0 && (
              <button
                onClick={handleOpenDonationModal}
                className="mt-4 bg-green-600 hover:bg-green-700 text-white px-4 sm:px-6 py-2 rounded-lg font-bold shadow transition-colors text-sm sm:text-base"
                title="Offset your social debt through donations"
              >
                Offset All
              </button>
            )}
          </div>
        </div>

        {/* Credit summary with Apply button */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex flex-col">
            {/* Display applied credit if any */}
            {(impactAnalysis?.appliedCredit || 0) > 0 && (
              <div className="flex items-center justify-between mb-2">
              </div>
            )}

            {/* Available Credit with Apply button */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-gray-600 text-sm sm:text-base">
                  Available Credit
                </span>
              </div>
              <div className="flex items-center">
                <span className="font-bold text-green-600 mr-2 text-sm sm:text-base">
                  ${(impactAnalysis?.availableCredit || 0).toFixed(2)}
                </span>
                <button
                  onClick={handleApplyCredit}
                  disabled={creditButtonDisabled}
                  className={`px-3 py-1 rounded-full text-xs text-white ${
                    creditButtonDisabled
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-green-600 hover:bg-green-700"
                  }`}
                  title={
                    (impactAnalysis?.availableCredit || 0) <= 0
                      ? "No credit available"
                      : (impactAnalysis?.effectiveDebt || 0) <= 0
                      ? "No debt to offset"
                      : "Apply credit to reduce your social debt"
                  }
                >
                  {isApplyingCredit ? "Applying..." : "Apply"}
                </button>
              </div>
            </div>
          </div>

          {/* Feedback message after applying credit */}
          {showFeedback && (
            <div className="mt-2 text-xs text-green-600 animate-fadeIn">
              ✓ {feedbackMessage}
            </div>
          )}
        </div>

        {/* Mobile menu toggle */}
        <div className="block sm:hidden p-4 border-b border-gray-200">
          <button
            onClick={toggleMenu}
            className="w-full flex items-center justify-between py-2 px-3 bg-blue-50 rounded-lg"
          >
            <span className="font-medium">Dashboard Views</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`h-5 w-5 transition-transform ${
                isMenuOpen ? "transform rotate-180" : ""
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <div className={`p-4 ${!isMenuOpen && "hidden"}`}>

          
          {/* Mobile: vertical menu (only visible when isMenuOpen) */}
          <nav className="space-y-1">
            {isMenuOpen && (
              <>
                <NavButton
                  label="Transaction Table"
                  isActive={activeView === "transaction-table"}
                  onClick={() => {
                    onViewChange("transaction-table");
                    setIsMenuOpen(false);
                  }}
                  disabled={!hasTransactions}
                />
                <NavButton
                  label="Balance Sheet"
                  isActive={activeView === "balance-sheet"}
                  onClick={() => {
                    onViewChange("balance-sheet");
                    setIsMenuOpen(false);
                  }}
                  disabled={!hasTransactions}
                />
                <NavButton
                  label="Vendor Breakdown"
                  isActive={activeView === "vendor-breakdown"}
                  onClick={() => {
                    onViewChange("vendor-breakdown");
                    setIsMenuOpen(false);
                  }}
                  disabled={!hasTransactions}
                />
                <NavButton
                  label="Impact by Category"
                  isActive={activeView === "grouped-impact"}
                  onClick={() => {
                    onViewChange("grouped-impact");
                    setIsMenuOpen(false);
                  }}
                  disabled={!hasTransactions}
                />
              </>
            )}
          </nav>
        </div>
      </div>

      {/* Positive Impact Categories
      {hasTransactions && positiveCategories.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-bold text-sm sm:text-base text-green-700">
              Top Positive Impact Categories
            </h3>
          </div>
          <div className="p-3 sm:p-4 space-y-3">
            {positiveCategories.map((category, index) => (
              <div
                key={`pos-${index}`}
                className="border border-green-100 rounded-lg p-2 sm:p-3 bg-green-50"
              >
                <div className="flex items-center mb-2">
                  <div className="text-xl sm:text-2xl mr-2">
                    {getCategoryEmoji(category.name)}
                  </div>
                  <div>
                    <h4 className="font-medium text-sm sm:text-base text-green-800">
                      {category.name}
                    </h4>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-green-600 font-medium text-sm sm:text-base">
                    ${category.amount.toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )} */}

      {/* Negative Impact Categories */}
      {/* {hasTransactions && negativeCategories.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-bold text-sm sm:text-base">
              Top Negative Impact Categories
            </h3>
          </div>
          <div className="p-3 sm:p-4 space-y-3">
            {negativeCategories.map((category, index) => (
              <div
                key={`neg-${index}`}
                className="border border-gray-200 rounded-lg p-2 sm:p-3"
              >
                <div className="flex items-center mb-2">
                  <div className="text-xl sm:text-2xl mr-2">
                    {getCategoryEmoji(category.name)}
                  </div>
                  <div>
                    <h4 className="font-medium text-sm sm:text-base">
                      {category.name}
                    </h4>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-red-600 font-medium text-sm sm:text-base">
                    ${category.amount.toFixed(2)}
                  </span>
                  <button
                    className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-full"
                    onClick={() => {
                      setIsDonationModalOpen(true);
                    }}
                  >
                    Offset Impact
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )} */}

      {/* Donation modal */}
      {isDonationModalOpen && (
        <DonationModal
          practice="All Societal Debt"
          amount={impactAnalysis?.effectiveDebt || 0}
          isOpen={isDonationModalOpen}
          onClose={() => setIsDonationModalOpen(false)}
        />
      )}
    </div>
  );
}

// Helper function for category emoji
// function getCategoryEmoji(categoryName: string): string {
//   const emojiMap: Record<string, string> = {
//     "Climate Change": "🌍",
//     "Environmental Impact": "🌳",
//     "Social Responsibility": "👥",
//     "Labor Practices": "👷‍♂️",
//     "Digital Rights": "💻",
//     "Animal Welfare": "🐾",
//     "Food Insecurity": "🍽️",
//     "Poverty": "💰",
//     "Conflict": "⚔️",
//     "Inequality": "⚖️",
//     "Public Health": "🏥",
//   };

//   return emojiMap[categoryName] || "⚖️";
// }

// Navigation button component
interface NavButtonProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
  disabled?: boolean;
}

function NavButton({
  label,
  isActive,
  onClick,
  disabled = false,
}: NavButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full px-3 py-2 sm:py-2 rounded-lg transition-colors flex items-center text-sm sm:text-base ${
        isActive
          ? "bg-blue-50 border-blue-200 text-blue-800"
          : disabled
          ? "text-gray-400 cursor-not-allowed"
          : "hover:bg-gray-100 text-gray-700"
      }`}
    >
      <span className="capitalize">{label}</span>
    </button>
  );
}