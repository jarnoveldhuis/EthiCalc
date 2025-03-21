// src/components/dashboard/DashboardSidebar.tsx
"use client";

import { User } from "firebase/auth";
import { useCallback, useState } from "react";
import { DonationModal } from "@/features/charity/DonationModal";

interface CategoryImpact {
  name: string;
  amount: number;
}

interface DashboardSidebarProps {
  user: User; // Keep user in props for future use
  activeView: string;
  onViewChange: (view: string) => void;
  totalSocietalDebt: number;
  offsetsThisMonth: number;
  positiveImpact: number;
  topNegativeCategories: CategoryImpact[];
  hasTransactions: boolean;
  onApplyCredit: (amount: number) => Promise<void>; // Add new prop for applying credit
}

export function DashboardSidebar({
  // user, // Commented out since it's not currently used
  activeView,
  onViewChange,
  totalSocietalDebt,
  // offsetsThisMonth,
  positiveImpact,
  topNegativeCategories,
  hasTransactions,
  onApplyCredit,
}: DashboardSidebarProps) {
  // Get color based on societal debt
  const getDebtColor = useCallback((debt: number): string => {
    if (debt <= 0) return "from-green-500 to-teal-600";
    if (debt < 50) return "from-yellow-500 to-orange-600";
    return "from-red-500 to-pink-600";
  }, []);

  // Track apply button state
  const [isApplying, setIsApplying] = useState(false);
  const [lastApplied, setLastApplied] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);

  // Donation modal state
  const [isDonationModalOpen, setIsDonationModalOpen] = useState(false);

  // Handle applying social credit to debt
  const handleApplyCredit = async () => {
    if (positiveImpact <= 0 || isApplying) return;

    try {
      setIsApplying(true);
      const amountToApply = positiveImpact;

      await onApplyCredit(amountToApply);

      // Show feedback after successful application
      setLastApplied(amountToApply);
      setShowFeedback(true);

      // Hide feedback after 3 seconds
      setTimeout(() => {
        setShowFeedback(false);
      }, 3000);
    } catch (error) {
      console.error("Error applying credit:", error);
      alert("Failed to apply credit. Please try again.");
    } finally {
      setIsApplying(false);
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
            totalSocietalDebt
          )} p-6 text-white`}
        >
          <div className="text-center">
            <h2 className="text-xl font-bold mb-1">Total Social Debt</h2>
            <div className="text-5xl font-black mb-2">
              ${Math.abs(totalSocietalDebt).toFixed(2)}
            </div>
            <div className="text-sm font-medium">
              {totalSocietalDebt <= 0 ? "Positive Impact" : "Negative Impact"}
            </div>

            {/* Offset All button - shown whenever there's debt */}
            {totalSocietalDebt > 0 && (
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

        {/* Debt summary with Apply button */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-gray-600">Social Credit</span>
              <span className="text-xs text-gray-500 block"></span>
            </div>
            <div className="flex items-center">
              <span className="font-bold text-green-600 mr-2">
                ${positiveImpact.toFixed(2)}
              </span>
              <button
                onClick={handleApplyCredit}
                disabled={positiveImpact <= 0 || isApplying}
                className={`px-3 py-1 rounded-full text-xs text-white ${
                  positiveImpact <= 0 || isApplying
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-green-600 hover:bg-green-700"
                }`}
                title="Apply credit to reduce your social debt"
              >
                {isApplying ? "Applying..." : "Apply"}
              </button>
            </div>
          </div>

          {/* Feedback message after applying credit */}
          {showFeedback && lastApplied && (
            <div className="mt-2 text-xs text-green-600 animate-fadeIn">
              ✓ Applied ${lastApplied.toFixed(2)} credit to your social debt
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
                      {category.name === "Climate Change"
                        ? "🌍"
                        : category.name === "Environmental Impact"
                        ? "🌳"
                        : category.name === "Social Responsibility"
                        ? "👥"
                        : category.name === "Labor Practices"
                        ? "👷‍♂️"
                        : category.name === "Digital Rights"
                        ? "💻"
                        : "⚖️"}
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
                        // In a real implementation, this would trigger the donation modal
                        alert(
                          `This would open the donation modal for ${category.name} in a complete implementation`
                        );
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

            <div className="text-center">
              <button className="text-sm text-blue-600 font-medium">
                See all impact categories
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Donation modal */}
      {isDonationModalOpen && (
        <DonationModal
          practice="All Societal Debt"
          amount={totalSocietalDebt}
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
