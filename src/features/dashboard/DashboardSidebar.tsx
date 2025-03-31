// src/features/dashboard/DashboardSidebar.tsx
import { useState, useCallback, useEffect } from "react";
import { ImpactAnalysis } from "@/core/calculations/type";
import { AnimatedCounter } from "@/shared/ui/AnimatedCounter";
import { DonationModal } from "@/features/charity/DonationModal";

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

type NavOption = {
  id: string;
  label: string;
  description: string;
}

export function DashboardSidebar({
  impactAnalysis,
  activeView,
  onViewChange,
  onApplyCredit,
  isApplyingCredit,
  hasTransactions,
  negativeCategories,
  positiveCategories
}: DashboardSidebarProps) {
  // Local state
  const [showFeedback, setShowFeedback] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string>("");
  const [isDonationModalOpen, setIsDonationModalOpen] = useState<boolean>(false);
  const [selectedPractice, setSelectedPractice] = useState<string | null>(null);
  const [selectedAmount, setSelectedAmount] = useState<number>(0);
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [backgroundClass, setBackgroundClass] = useState<string>("bg-green-500");

  // Navigation options
  const navOptions: NavOption[] = [
    { id: "balance-sheet", label: "Balance Sheet", description: "View positive and negative impacts" },
    { id: "transaction-table", label: "Transactions", description: "Details for each purchase" },
    { id: "vendor-breakdown", label: "Vendors", description: "Impact by merchant" },
    { id: "grouped-impact", label: "Categories", description: "Impact by ethical category" }
  ];

  // Credit button disabled logic
  const creditButtonDisabled: boolean = 
    !impactAnalysis || 
    impactAnalysis.availableCredit <= 0 || 
    isApplyingCredit || 
    impactAnalysis.effectiveDebt <= 0;
  
  // Set background color based on debt level
  useEffect(() => {
    if (!impactAnalysis) return;
    
    if (impactAnalysis.effectiveDebt <= 0) {
      setBackgroundClass("bg-green-500");
    } else if (impactAnalysis.effectiveDebt < 50) {
      setBackgroundClass("bg-yellow-500");
    } else {
      setBackgroundClass("bg-red-500");
    }
  }, [impactAnalysis]);

  // Handle applying social credit to debt
  const handleApplyCredit = useCallback(async () => {
    if (creditButtonDisabled) return;
    
    try {
      const amountToApply = impactAnalysis?.availableCredit || 0;
      const success = await onApplyCredit(amountToApply);
      
      if (success) {
        setFeedbackMessage(`Applied $${amountToApply.toFixed(2)} credit to your social debt`);
        setShowFeedback(true);
        setTimeout(() => setShowFeedback(false), 3000);
      }
    } catch (error) {
      console.error("Error applying credit:", error);
      setFeedbackMessage("Failed to apply credit. Please try again.");
      setShowFeedback(true);
      setTimeout(() => setShowFeedback(false), 3000);
    }
  }, [creditButtonDisabled, impactAnalysis, onApplyCredit]);
  
  // Handle opening donation modal for a specific practice or category
  const handleOpenDonationModal = useCallback((practice: string, amount: number) => {
    setSelectedPractice(practice);
    setSelectedAmount(amount);
    setIsDonationModalOpen(true);
  }, []);
  
  // Handle "Offset All" button click
  const handleOffsetAll = useCallback(() => {
    handleOpenDonationModal("All Societal Debt", impactAnalysis?.effectiveDebt || 0);
  }, [handleOpenDonationModal, impactAnalysis]);

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
      "Poverty": "💰",
      "Conflict": "⚔️",
      "Inequality": "⚖️",
      "Public Health": "🏥",
      "Uncategorized": "❓"
    };
    
    return emojiMap[categoryName] || "❓";
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
                onClick={handleOffsetAll}
                className="mt-4 bg-green-600 hover:bg-green-700 text-white px-4 sm:px-6 py-2 rounded-lg font-bold shadow transition-colors text-sm sm:text-base"
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
            onClick={() => setIsMenuOpen(!isMenuOpen)}
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
            {navOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => {
                  onViewChange(option.id);
                  setIsMenuOpen(false);
                }}
                disabled={!hasTransactions}
                className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                  activeView === option.id
                    ? "bg-blue-50 border-blue-200 text-blue-800 border"
                    : !hasTransactions
                    ? "text-gray-400 cursor-not-allowed"
                    : "hover:bg-gray-50 text-gray-700"
                }`}
              >
                <div className="font-medium">{option.label}</div>
                <div className="text-xs text-gray-500">{option.description}</div>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Impact Categories Section */}
      {hasTransactions && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-bold text-gray-800">Impact Categories</h3>
          </div>
          
          <div className="p-4 space-y-4">
            {/* Positive Impact Categories */}
            {positiveCategories.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-green-700 mb-2">Positive Impact</h4>
                <div className="space-y-2">
                  {positiveCategories.slice(0, 2).map((category, index) => (
                    <div
                      key={`pos-${index}`}
                      className="flex items-center justify-between bg-green-50 p-2 rounded border border-green-100"
                    >
                      <div className="flex items-center">
                        <span className="text-xl mr-2">{getCategoryEmoji(category.name)}</span>
                        <span className="font-medium text-green-800">{category.name}</span>
                      </div>
                      <span className="text-green-600 font-medium">${category.amount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Negative Impact Categories */}
            {negativeCategories.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-red-700 mb-2">Negative Impact</h4>
                <div className="space-y-2">
                  {negativeCategories.slice(0, 2).map((category, index) => (
                    <div
                      key={`neg-${index}`}
                      className="flex items-center justify-between bg-red-50 p-2 rounded border border-red-100"
                    >
                      <div className="flex items-center">
                        <span className="text-xl mr-2">{getCategoryEmoji(category.name)}</span>
                        <span className="font-medium text-red-800">{category.name}</span>
                      </div>
                      <div className="flex items-center">
                        <span className="text-red-600 font-medium mr-2">${category.amount.toFixed(2)}</span>
                        <button 
                          className="px-2 py-1 bg-green-500 hover:bg-green-600 text-white text-xs rounded"
                          onClick={() => handleOpenDonationModal(category.name, category.amount)}
                        >
                          Offset
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Donation Modal */}
      {isDonationModalOpen && (
        <DonationModal
          practice={selectedPractice || "All Societal Debt"}
          amount={selectedAmount}
          isOpen={isDonationModalOpen}
          onClose={() => setIsDonationModalOpen(false)}
        />
      )}
    </div>
  );
}