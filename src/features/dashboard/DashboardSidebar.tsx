// src/features/dashboard/DashboardSidebar.tsx
import { useState, useCallback, useEffect } from "react";
import { ImpactAnalysis } from "@/core/calculations/type";
import { AnimatedCounter } from "@/shared/ui/AnimatedCounter";
import { DonationModal } from "@/features/charity/DonationModal";
import { useDonationModal } from "@/hooks/useDonationModal";

interface DashboardSidebarProps {
  impactAnalysis: ImpactAnalysis | null;
  activeView: string;
  onViewChange: (view: string) => void;
  onApplyCredit: (amount: number) => Promise<boolean>;
  isApplyingCredit: boolean;
  hasTransactions: boolean;
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
  hasTransactions
}: DashboardSidebarProps) {
  const { modalState, openDonationModal, closeDonationModal } = useDonationModal({ transactions: [] });

  // Local state
  const [showFeedback, setShowFeedback] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string>("");
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [backgroundClass, setBackgroundClass] = useState<string>("bg-green-500");

  // Navigation options
  const navOptions: NavOption[] = [
    // { id: "grouped-impact", label: "Ethical Impact", description: "Impact by ethical category" },
    { id: "balance-sheet", label: "Balance Sheet", description: "View positive and negative impacts" },
    // { id: "transaction-table", label: "Transactions", description: "Details for each purchase" },
    // { id: "vendor-breakdown", label: "Vendors", description: "Impact by merchant" }
  ];

  // Get the label for the current view
  const currentViewLabel = navOptions.find(option => option.id === activeView)?.label || "Dashboard Views";

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
  
  // Handle opening donation modal
  const handleOpenDonationModal = useCallback((practice: string, amount: number) => {
    openDonationModal(practice, amount);
  }, [openDonationModal]);
  
  // Handle "Offset All" button click
  const handleOffsetAll = useCallback(() => {
    handleOpenDonationModal("All Societal Debt", impactAnalysis?.effectiveDebt || 0);
  }, [handleOpenDonationModal, impactAnalysis]);

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
        {/* <div className="block lg:hidden p-4 border-b border-gray-200">
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="w-full flex items-center justify-between py-2 px-3 bg-blue-50 rounded-lg"
          >
            <span className="font-medium">{currentViewLabel}</span>
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
        </div> */}

        {/* Navigation - Always visible on desktop, toggled on mobile */}
        {/* <div className={`${!isMenuOpen ? "hidden" : "block"} lg:block p-4`}>
          <nav className="space-y-2">
            {navOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => {
                  onViewChange(option.id);
                  setIsMenuOpen(false); // Close menu after selection
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
        </div> */}
      </div>

      {/* Donation Modal */}
      {modalState.isOpen && (
        <DonationModal
          practice={modalState.practice}
          amount={modalState.amount}
          isOpen={modalState.isOpen}
          onClose={closeDonationModal}
        />
      )}
    </div>
  );
}