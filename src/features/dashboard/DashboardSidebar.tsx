// src/features/dashboard/DashboardSidebar.tsx
// Modifications to include all navigation options in the sidebar
import { useState, useEffect, useCallback } from "react";
import { DonationModal } from "@/features/charity/DonationModal";
import { ImpactAnalysis } from "@/core/calculations/type";
import { AnimatedCounter } from "@/shared/ui/AnimatedCounter";

interface DashboardSidebarProps {
  impactAnalysis: ImpactAnalysis | null;
  activeView: string;
  onViewChange: (view: string) => void;
  onApplyCredit: (amount: number) => Promise<boolean>;
  isApplyingCredit: boolean;
  hasTransactions: boolean;
  negativeCategories: Array<{ name: string; amount: number }>;
  positiveCategories: Array<{ name: string; amount: number }>;
}

export function DashboardSidebar({
  impactAnalysis,
  activeView,
  onViewChange,
  onApplyCredit,
  isApplyingCredit,
  hasTransactions,
  negativeCategories,
  positiveCategories,
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
  const creditButtonDisabled =
    !impactAnalysis ||
    impactAnalysis.availableCredit <= 0 ||
    isApplyingCredit ||
    impactAnalysis.effectiveDebt <= 0;

  const [backgroundClass, setBackgroundClass] = useState<string>("");
  const getBackgroundClass = useCallback((debt: number): string => {
    if (debt <= 0) return "bg-green-500";
    if (debt < 50) return "bg-yellow-500";
    return "bg-red-500";
  }, []);
  // In the useEffect where you handle background transitions
  useEffect(() => {
    setBackgroundClass(getBackgroundClass(impactAnalysis?.effectiveDebt || 0));
  }, [impactAnalysis?.effectiveDebt, getBackgroundClass]);

  // Handle applying social credit to debt
  const handleApplyCredit = async () => {
    if (creditButtonDisabled) {
      console.log("Credit button is disabled but was clicked anyway");
      return;
    }

    try {
      const amountToApply = impactAnalysis?.availableCredit || 0;
      console.log("Attempting to apply credit amount:", amountToApply);

      if (amountToApply <= 0) {
        setFeedbackMessage("No debt to offset with credit");
        setShowFeedback(true);
        setTimeout(() => setShowFeedback(false), 3000);
        return;
      }

      const success = await onApplyCredit(amountToApply);
      console.log("Credit application result:", success);

      if (success) {
        setFeedbackMessage(
          `Applied $${amountToApply.toFixed(2)} credit to your social debt`
        );
        setShowFeedback(true);
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

  // Helper function for category emoji
  const getCategoryEmoji = (categoryName: string): string => {
    const emojiMap: Record<string, string> = {
      "Climate Change": "🌍",
      "Environmental Impact": "🌳",
      "Social Responsibility": "👥",
      "Labor Practices": "👷‍♂️",
      "Digital Rights": "💻",
      "Animal Welfare": "🐾",
      "Food Insecurity": "🍽️",
      Poverty: "💰",
      Conflict: "⚔️",
      Inequality: "⚖️",
      "Public Health": "🏥",
      // Default for categories not in our map
      Uncategorized: "⚖️",
    };

    return emojiMap[categoryName] || emojiMap["Uncategorized"];
  };

  return (
    <div className="w-full lg:col-span-1">
      {/* Societal Credit Score */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
      <div className={`${backgroundClass} transition-colors duration-1000 p-4 sm:p-6 text-white`}>

          <div className="text-center">
            <h2 className="text-lg sm:text-xl font-bold mb-1">
              Total Social Debt
            </h2>
            <div className="text-4xl sm:text-5xl font-black mb-2">
              <AnimatedCounter
                value={impactAnalysis?.effectiveDebt || 0}
                className="transition-all duration-1000"
              />
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
        <div className="block lg:hidden p-4 border-b border-gray-200">
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

        {/* Navigation - Always visible on desktop, toggled on mobile */}
        <div className={`p-4 ${!isMenuOpen && "hidden lg:block"}`}>
          <h3 className="font-medium text-gray-800 mb-3">Dashboard Views</h3>
          <nav className="space-y-2">
            <NavButton
              label="Premium View"
              isActive={activeView === "premium-view"}
              onClick={() => {
                onViewChange("premium-view");
                setIsMenuOpen(false);
              }}
              disabled={!hasTransactions}
            />
            <NavButton
              label="Transactions"
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
          </nav>
        </div>
      </div>

      {/* Positive Impact Categories */}
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
      )}

      {/* Negative Impact Categories */}
      {hasTransactions && negativeCategories.length > 0 && (
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
      )}

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
          ? "bg-blue-50 border-blue-200 text-blue-800 border"
          : disabled
          ? "text-gray-400 cursor-not-allowed"
          : "hover:bg-gray-100 text-gray-700"
      }`}
    >
      <span className="capitalize">{label}</span>
    </button>
  );
}
