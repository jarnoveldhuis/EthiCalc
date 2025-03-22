// src/components/dashboard/DashboardSidebar.tsx
"use client";

import { User } from "firebase/auth";
import { useState, useCallback, useEffect } from "react";
import { DonationModal } from "@/features/charity/DonationModal";
import { UserCreditState } from "@/features/analysis/useCreditState";

interface CategoryImpact {
  name: string;
  amount: number;
}

interface DashboardSidebarProps {
  user: User;
  activeView: string;
  onViewChange: (view: string) => void;
  totalSocietalDebt: number;
  offsetsThisMonth: number;
  positiveImpact: number;
  topNegativeCategories: CategoryImpact[];
  hasTransactions: boolean;
  onApplyCredit: (amount: number) => Promise<boolean>;
  creditState: UserCreditState | null;
  isApplyingCredit: boolean;
}

export function DashboardSidebar({
  activeView,
  onViewChange,
  totalSocietalDebt,
  positiveImpact,
  topNegativeCategories,
  hasTransactions,
  onApplyCredit,
  creditState,
  isApplyingCredit
}: DashboardSidebarProps) {
  // Local UI state
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [isDonationModalOpen, setIsDonationModalOpen] = useState(false);
  const [lastAppliedAmount, setLastAppliedAmount] = useState(0);

  // Calculate effective debt (total debt minus applied credit)
  const effectiveDebt = totalSocietalDebt - (creditState?.appliedCredit || 0);
  
  // Track whether the button should be disabled - critical for preventing multiple applications
  const creditButtonDisabled = positiveImpact <= 0 || isApplyingCredit || effectiveDebt <= 0;
  
  // Debug log for credit state
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('Credit sidebar state:', {
        positiveImpact,
        isApplyingCredit,
        effectiveDebt,
        creditState: creditState ? {
          availableCredit: creditState.availableCredit,
          appliedCredit: creditState.appliedCredit,
          lastAppliedAmount: creditState.lastAppliedAmount
        } : null,
        buttonDisabled: creditButtonDisabled
      });
    }
  }, [positiveImpact, isApplyingCredit, effectiveDebt, creditState, creditButtonDisabled]);
  
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
      console.log('Credit button is disabled but was clicked anyway');
      return;
    }

    try {
      // Use the amount of positive impact available, capped by effective debt
      const amountToApply = Math.min(positiveImpact, effectiveDebt);
      
      if (amountToApply <= 0) {
        setFeedbackMessage("No debt to offset with credit");
        setShowFeedback(true);
        setTimeout(() => setShowFeedback(false), 3000);
        return;
      }

      // Store amount locally for UI feedback
      setLastAppliedAmount(amountToApply);
      
      const success = await onApplyCredit(amountToApply);

      if (success) {
        // Show feedback after successful application
        setFeedbackMessage(`Applied $${amountToApply.toFixed(2)} credit to your social debt`);
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

  return (
    <div className="lg:col-span-1">
      {/* Societal Credit Score */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
        <div
          className={`bg-gradient-to-r ${getDebtColor(
            effectiveDebt
          )} p-6 text-white`}
        >
          <div className="text-center">
            <h2 className="text-xl font-bold mb-1">Total Social Debt</h2>
            <div className="text-5xl font-black mb-2">
              ${Math.abs(effectiveDebt).toFixed(2)}
            </div>
            <div className="text-sm font-medium">
              {effectiveDebt <= 0 ? "Positive Impact" : "Negative Impact"}
            </div>

            {/* Only show Offset button if there's effective debt */}
            {effectiveDebt > 0 && (
              <button
                onClick={handleOpenDonationModal}
                className="mt-4 bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-bold shadow transition-colors"
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
            {(creditState?.appliedCredit || 0) > 0 && (
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="text-gray-600">Applied Credit</span>
                </div>
                <div className="text-green-600 font-medium">${(creditState?.appliedCredit || 0).toFixed(2)}</div>
              </div>
            )}
            
            {/* Available Credit with Apply button */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-gray-600">Available Credit</span>
                <span className="text-xs text-gray-500 block">From positive impact</span>
              </div>
              <div className="flex items-center">
                <span className="font-bold text-green-600 mr-2">
                  ${positiveImpact.toFixed(2)}
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
                    positiveImpact <= 0 
                      ? "No credit available" 
                      : effectiveDebt <= 0
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
          
          {/* Debug info - only in development */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-400">
              <div>Credit applied: ${creditState?.appliedCredit.toFixed(2) || "0.00"}</div>
              <div>Last applied: ${lastAppliedAmount.toFixed(2)}</div>
              <div>Button state: {creditButtonDisabled ? "Disabled" : "Enabled"}</div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="p-4">
          <h3 className="font-medium mb-2">Dashboard Views</h3>
          <nav className="space-y-1">
            <NavButton
              label="Transactions"
              isActive={activeView === "transactions"}
              onClick={() => onViewChange("transactions")}
              disabled={!hasTransactions}
            />
            <NavButton
              label="Impact by Category"
              isActive={activeView === "grouped-impact"}
              onClick={() => onViewChange("grouped-impact")}
              disabled={!hasTransactions}
            />
            <NavButton
              label="Impact Summary"
              isActive={activeView === "impact"}
              onClick={() => onViewChange("impact")}
              disabled={!hasTransactions}
            />
            <NavButton
              label="Categories"
              isActive={activeView === "categories"}
              onClick={() => onViewChange("categories")}
              disabled={!hasTransactions}
            />
            <NavButton
              label="Practice Breakdown"
              isActive={activeView === "practices"}
              onClick={() => onViewChange("practices")}
              disabled={!hasTransactions}
            />
          </nav>
        </div>
      </div>

      {/* Recommended Offsets based on highest negative impact categories */}
      {hasTransactions && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-bold">Top Negative Impact Categories</h3>
          </div>
          <div className="p-4 space-y-3">
            {topNegativeCategories.length > 0 ? (
              topNegativeCategories.map((category, index) => (
                <div
                  key={index}
                  className="border border-gray-200 rounded-lg p-3"
                >
                  <div className="flex items-center mb-2">
                    <div className="text-2xl mr-2">
                      {getCategoryEmoji(category.name)}
                    </div>
                    <div>
                      <h4 className="font-medium">{category.name}</h4>
                      <span className="text-xs text-gray-500">
                        Impact Category
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-red-600 font-medium">
                      ${category.amount.toFixed(2)}
                    </span>
                    <button
                      className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-full"
                      onClick={() => {
                        setIsDonationModalOpen(true);
                      }}
                    >
                      Offset Impact
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-gray-500 py-3">
                No negative impact categories found
              </div>
            )}
          </div>
        </div>
      )}

      {/* Donation modal */}
      {isDonationModalOpen && (
        <DonationModal
          practice="All Societal Debt"
          amount={effectiveDebt}
          isOpen={isDonationModalOpen}
          onClose={() => setIsDonationModalOpen(false)}
        />
      )}
    </div>
  );
}

// Helper function for category emoji
function getCategoryEmoji(categoryName: string): string {
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
    "Public Health": "🏥"
  };
  
  return emojiMap[categoryName] || "⚖️";
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
      className={`w-full px-3 py-2 rounded-lg transition-colors flex items-center ${
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