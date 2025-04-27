// src/features/dashboard/views/BalanceSheetView.jsx
"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useTransactionStore } from "@/store/transactionStore";
// Import necessary types
import { Transaction, Citation } from "@/shared/types/transactions";
import { EnrichedCharityResult } from "@/features/charity/types";

// Import components and services needed
import { LoadingSpinner } from "@/shared/ui/LoadingSpinner";
import { enhancedCharityService } from "@/features/charity/enhancedCharityService";
import { CharityImage } from "@/features/charity/CharityImage";
import { CharityRating } from "@/features/charity/CharityRating";
// import { CharitySearch } from "./CharitySearch"; // REMOVED - No longer needed inline
import { AnimatedCounter } from "@/shared/ui/AnimatedCounter";
import { DonationModal } from "@/features/charity/DonationModal";
import { useDonationModal } from "@/hooks/useDonationModal";

// --- Interface Definitions ---
interface BalanceSheetViewProps {
  transactions: Transaction[];
}
interface CategoryData {
  name: string;
  icon: string;
  totalPositiveImpact: number;
  totalNegativeImpact: number;
  positiveDetails: CombinedImpactDetail[];
  negativeDetails: CombinedImpactDetail[];
}
interface CombinedImpactDetail {
  vendorName: string;
  practice: string;
  totalImpactAmount: number;
  totalOriginalAmount: number;
  impactWeight: number;
  information?: string;
  citations?: Citation[];
  isPositive: boolean;
  contributingTxCount: number;
}
interface DetailItemProps {
  detail: CombinedImpactDetail;
  amountColor: string;
}

// State for managing the inline donation UI per category (Simplified)
interface CategoryInlineOffsetState {
  recommendationStatus: "idle" | "loading" | "loaded" | "error";
  // Only store the single recommended charity now
  recommendedCharity: EnrichedCharityResult | null;
  // Removed showSearch
  donationAmount: number;
  errorMessage: string | null;
}
// --- End Interface Definitions ---

// --- Helper Functions (Unchanged) ---
const formatCurrency = (value: number | undefined | null): string => {
  const num = value ?? 0;
  return `$${num.toFixed(2)}`;
};
const categoryIcons: Record<string, string> = {
  Environment: "🌱",
  "Labor Ethics": "⚖️",
  "Animal Welfare": "🐮",
  "Political Ethics": "🗳️",
  "Digital Rights": "🛜",
  Transparency: "🔍",
  "Community Support": "🤝",
  "Uncategorized Positive": "✨",
  "Uncategorized Negative": "💀",
  "Default Category": "❓",
};
const getNetImpactColor = (netImpact: number): string => {
  if (netImpact > 0.01) return "text-[var(--success)] dark:text-emerald-400";
  if (netImpact < -0.01) return "text-[var(--destructive)] dark:text-rose-400";
  return "text-gray-500 dark:text-gray-400";
};
const getWidgetIdentifier = (
  char: EnrichedCharityResult | null
): string | null => {
  if (!char) return null;
  if (char.slug) return char.slug;
  if (char.id?.startsWith("ein:")) {
    const ein = char.id.split(":")[1];
    if (/^\d{9}$/.test(ein)) return ein;
  }
  if (char.id && !char.id.startsWith("ein:")) return char.id;
  return char.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};
// --- End Helper Functions ---

// --- Detail Item Component (Unchanged) ---
const DetailItem: React.FC<DetailItemProps> = ({ detail, amountColor }) => {
  const [citationsVisible, setCitationsVisible] = useState(false);
  const citations = detail.citations;
  const hasCitations =
    citations !== undefined && citations !== null && citations.length > 0;
  return (
    <div className="border-b border-slate-200 dark:border-slate-700 pb-2 last:border-b-0 last:pb-0">
      {" "}
      <div className="flex justify-between items-start mb-1">
        {" "}
        <div className="flex-grow min-w-0 pr-2">
          {" "}
          <span
            className="block font-medium text-[var(--card-foreground)] text-sm truncate"
            title={detail.vendorName}
          >
            {detail.vendorName}
          </span>{" "}
          <span
            className="block text-xs text-blue-600 dark:text-blue-400 truncate"
            title={detail.practice}
          >
            {detail.practice} ({detail.impactWeight}%)
          </span>{" "}
          {detail.contributingTxCount > 1 && (
            <span className="block text-xxs text-[var(--muted-foreground)]">
              ({detail.contributingTxCount} transactions)
            </span>
          )}{" "}
        </div>{" "}
        <div className="text-right flex-shrink-0">
          {" "}
          <AnimatedCounter
            value={detail.totalImpactAmount}
            prefix={detail.isPositive ? "+$" : "-$"}
            className={`block font-medium ${amountColor} text-sm`}
            decimalPlaces={0}
            title={`Precise: ${detail.isPositive ? "+" : "-"}${formatCurrency(
              detail.totalImpactAmount
            )}`}
          />{" "}
          <span className="block text-xs text-[var(--muted-foreground)]">
            (Orig: {formatCurrency(detail.totalOriginalAmount)})
          </span>{" "}
        </div>{" "}
      </div>{" "}
      {detail.information && (
        <p className="mt-1 pl-2 border-l-2 border-gray-300 dark:border-gray-600 text-xs text-[var(--card-foreground)] opacity-80 italic">
          {" "}
          ℹ️ {detail.information}{" "}
          {hasCitations && !citationsVisible && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setCitationsVisible(true);
              }}
              className="ml-2 text-blue-500 hover:underline text-[10px] font-medium"
            >
              [Show Sources]
            </button>
          )}{" "}
          {hasCitations && citationsVisible && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setCitationsVisible(false);
              }}
              className="ml-2 text-blue-500 hover:underline text-[10px] font-medium"
            >
              [Hide Sources]
            </button>
          )}{" "}
        </p>
      )}{" "}
      {hasCitations && citationsVisible && (
        <ul className="mt-1 ml-6 list-disc text-xs space-y-0.5">
          {" "}
          {citations.map(
            (citation: Citation, urlIndex: number) =>
              citation?.url && (
                <li key={urlIndex}>
                  {" "}
                  <a
                    href={citation.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline"
                    onClick={(e) => e.stopPropagation()}
                    title={citation.url}
                  >
                    {" "}
                    {citation.title || `Source ${urlIndex + 1}`}{" "}
                  </a>{" "}
                </li>
              )
          )}{" "}
        </ul>
      )}{" "}
    </div>
  );
};

// --- Reusable Card Component (For Desktop View) ---
interface CategoryCardProps {
  category: CategoryData;
  isPositive: boolean;
  isExpanded: boolean;
  onToggleExpand: (categoryName: string) => void;
  onOpenModal: (categoryName: string, amount: number) => void; // Opens main modal
  // Props for inline donation UI (Positive Column Prompt) - Simplified state
  inlineOffsetState: CategoryInlineOffsetState | undefined;
  fetchRecommendation: (categoryName: string) => void;
  updateInlineOffsetState: (
    categoryName: string,
    updates: Partial<CategoryInlineOffsetState>
  ) => void;
  triggerWidget: (charity: EnrichedCharityResult, amount: number) => void; // Triggers widget directly
}

const CategoryCard: React.FC<CategoryCardProps> = ({
  category,
  isPositive,
  isExpanded,
  onToggleExpand,
  onOpenModal,
  inlineOffsetState,
  fetchRecommendation,
  updateInlineOffsetState,
  triggerWidget,
}) => {
  const details = isPositive
    ? category.positiveDetails
    : category.negativeDetails;
  const amountColor = isPositive
    ? "text-[var(--success)] dark:text-emerald-400"
    : "text-[var(--destructive)] dark:text-rose-400";
  const totalImpact = isPositive
    ? category.totalPositiveImpact
    : category.totalNegativeImpact;
  const showDetails = isExpanded;
  const isEmpty = details.length === 0;
  const showInlineOffsetUI =
    isPositive && isEmpty && category.totalNegativeImpact > 0;

  // Trigger fetch for inline UI recommendation
  useEffect(() => {
    if (
      isExpanded &&
      showInlineOffsetUI &&
      inlineOffsetState?.recommendationStatus === "idle"
    ) {
      fetchRecommendation(category.name);
    }
  }, [
    isExpanded,
    showInlineOffsetUI,
    category.name,
    fetchRecommendation,
    inlineOffsetState?.recommendationStatus,
  ]);

  // Handlers for inline UI
  const handleInlineWidgetTrigger = (e: React.MouseEvent) => {
    e.stopPropagation();
    const charity = inlineOffsetState?.recommendedCharity;
    const amount =
      inlineOffsetState?.donationAmount ?? category.totalNegativeImpact;
    if (charity && amount >= 1) {
      triggerWidget(charity, amount);
    } else {
      updateInlineOffsetState(category.name, {
        errorMessage: "Please enter amount >= $1.",
      });
    }
  };
  const handleInlineAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newAmount = Math.max(1, Number(e.target.value));
    updateInlineOffsetState(category.name, { donationAmount: newAmount });
  };
  // ** NEW ** Handler for "Change Charity" -> Opens Modal
  const handleOpenModalForChange = (e: React.MouseEvent) => {
    e.stopPropagation();
    const amount =
      inlineOffsetState?.donationAmount ?? category.totalNegativeImpact;
    onOpenModal(category.name, amount);
  };
  // Handler for NEGATIVE column button -> Opens Modal
  const handleOpenModalClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onOpenModal(category.name, totalImpact);
  }; // Use totalImpact (negative amount)

  return (
    <div className="card flex flex-col h-full">
      {/* Card Header */}
      <div
        role="button"
        tabIndex={0}
        className={`w-full bg-gray-50 dark:bg-gray-700/[.5] p-3 flex justify-between items-center text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors rounded-t-lg cursor-pointer`}
        onClick={() => onToggleExpand(category.name)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onToggleExpand(category.name);
        }}
        aria-expanded={isExpanded}
      >
        <div className="flex items-center flex-grow min-w-0">
          {" "}
          <span className="text-lg mr-2 sm:mr-3">{category.icon}</span>{" "}
          <span
            className="font-semibold text-gray-700 dark:text-gray-200 text-sm sm:text-base truncate mr-3"
            title={category.name}
          >
            {category.name}
          </span>{" "}
        </div>
        <div className="flex items-center flex-shrink-0 gap-2">
          {" "}
          <AnimatedCounter
            value={totalImpact}
            prefix="$"
            className={`font-bold ${amountColor} text-sm sm:text-base w-20 text-right`}
            decimalPlaces={0}
            title={`Precise: ${formatCurrency(totalImpact)}`}
          />{" "}
          {!isPositive && totalImpact > 0 && (
            <button
              onClick={handleOpenModalClick}
              className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs px-2 py-1 rounded-full transition-colors whitespace-nowrap z-10"
              title={`Offset ${category.name} impact`}
            >
              Offset
            </button>
          )}{" "}
          <svg
            className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform duration-200 ${
              isExpanded ? "rotate-180" : ""
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M19 9l-7 7-7-7"
            ></path>
          </svg>{" "}
        </div>
      </div>
      {/* Expandable Card Content */}
      <div
        className={`flex-grow overflow-y-auto max-h-96 scrollable-content ${
          showDetails ? "block" : "hidden"
        }`}
      >
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 space-y-3">
          {/* Transaction Details List */}
          {!isEmpty &&
            details.map((detail, index) => (
              <DetailItem
                key={`${isPositive ? "pos" : "neg"}-detail-${
                  category.name
                }-${index}-${detail.vendorName}-${detail.practice}`}
                detail={detail}
                amountColor={amountColor}
              />
            ))}
          {isEmpty && showDetails && !showInlineOffsetUI && (
            <p className="text-xs text-center text-[var(--card-foreground)] opacity-70">
              No {isPositive ? "positive" : "negative"} impact details.
            </p>
          )}

          {/* Simplified Inline Offset UI (Only in Positive Card when needed) */}
          {showInlineOffsetUI && showDetails && inlineOffsetState && (
            <div className="space-y-3">
              <p className="text-xs text-[var(--muted-foreground)] italic text-center">
                Offset negative impact:
              </p>
              {/* Display Recommended Charity or Loading/Error State */}
              {inlineOffsetState.recommendationStatus === "loading" && (
                <LoadingSpinner message="Finding best charity..." />
              )}
              {inlineOffsetState.recommendationStatus === "error" && (
                <p className="text-xs text-red-500 text-center">
                  {inlineOffsetState.errorMessage || "Could not load."}
                </p>
              )}
              {inlineOffsetState.recommendationStatus === "loaded" &&
                !inlineOffsetState.recommendedCharity && (
                  <p className="text-xs text-gray-500 text-center">
                    No specific charity found.
                  </p>
                )}

              {/* Display Recommended Charity Info */}
              {inlineOffsetState.recommendedCharity && (
                <div className="border rounded-md p-3 bg-white dark:bg-gray-700/[.5] space-y-2 border-slate-200 dark:border-slate-600">
                  {/* Charity Info + Rating */}
                  <div className="flex items-start space-x-3">
                    <CharityImage
                      src={inlineOffsetState.recommendedCharity.logoUrl}
                      alt={inlineOffsetState.recommendedCharity.name}
                      width={40}
                      height={40}
                    />
                    <div className="flex-grow min-w-0">
                      <p className="text-sm font-medium text-[var(--card-foreground)] truncate">
                        {inlineOffsetState.recommendedCharity.name}
                      </p>
                      <CharityRating
                        charity={inlineOffsetState.recommendedCharity}
                      />
                    </div>
                  </div>
                  {/* "Change Charity" button -> Opens Modal */}
                  <button
                    onClick={handleOpenModalForChange} // <-- OPENS MODAL
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {" "}
                    Change Charity{" "}
                  </button>

                  {/* Amount Input & Donate Button Container */}
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-600">
                    <div className="flex items-center justify-between space-x-2">
                      <label
                        htmlFor={`donationAmount-${category.name}-desktop`}
                        className="sr-only"
                      >
                        Amount:
                      </label>
                      <div className="flex items-center flex-grow">
                        <span className="text-gray-500 dark:text-gray-400 mr-1">
                          $
                        </span>
                        <input
                          id={`donationAmount-${category.name}-desktop`}
                          type="number"
                          min="1"
                          value={inlineOffsetState.donationAmount}
                          onChange={handleInlineAmountChange}
                          className="w-full p-1 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          aria-label="Donation Amount"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        />
                      </div>
                      {/* Donate Button -> Triggers Widget */}
                      <button
                        onClick={handleInlineWidgetTrigger}
                        className="flex-shrink-0 text-sm bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-md disabled:opacity-50"
                        disabled={inlineOffsetState.donationAmount < 1}
                      >
                        Donate
                      </button>
                    </div>
                    {inlineOffsetState.errorMessage && (
                      <p className="text-xs text-red-500 mt-1">
                        {inlineOffsetState.errorMessage}
                      </p>
                    )}
                  </div>
                </div>
              )}
              {/* Fallback Offset Button if no recommendation loads -> Opens Modal */}
              {(inlineOffsetState.recommendationStatus === "error" ||
                (inlineOffsetState.recommendationStatus === "loaded" &&
                  !inlineOffsetState.recommendedCharity)) && (
                <button
                  onClick={handleOpenModalClick}
                  className="w-full mt-1 text-sm bg-gray-500 hover:bg-gray-600 text-white px-3 py-1.5 rounded-md"
                >
                  Offset (Choose Charity)
                </button>
              )}
            </div>
          )}
          {/* End Inline Offset UI */}
        </div>
      </div>
    </div>
  );
};

// --- Unified Category Card Component (FOR MOBILE) ---
interface UnifiedCategoryCardProps {
  category: CategoryData;
  isExpanded: boolean;
  onToggleExpand: (categoryName: string) => void;
  onOpenModal: (categoryName: string, amount: number) => void; // <-- Opens modal
  // Inline UI props
  inlineOffsetState: CategoryInlineOffsetState | undefined;
  fetchRecommendation: (categoryName: string) => void;
  updateInlineOffsetState: (
    categoryName: string,
    updates: Partial<CategoryInlineOffsetState>
  ) => void;
  triggerWidget: (charity: EnrichedCharityResult, amount: number) => void; // <-- Triggers widget
}

const UnifiedCategoryCard: React.FC<UnifiedCategoryCardProps> = ({
  category,
  isExpanded,
  onToggleExpand,
  onOpenModal,
  inlineOffsetState,
  fetchRecommendation,
  updateInlineOffsetState,
  triggerWidget,
}) => {
  const { totalPositiveImpact, totalNegativeImpact } = category;
  const netImpact = totalPositiveImpact - totalNegativeImpact;
  const negativeImpactForOffset = totalNegativeImpact;
  const allDetails = [
    ...category.negativeDetails,
    ...category.positiveDetails,
  ].sort((a, b) => {
    if (a.isPositive !== b.isPositive) return a.isPositive ? 1 : -1;
    return b.totalImpactAmount - a.totalImpactAmount;
  });
  const showMobileInlineOffsetUI = isExpanded && totalNegativeImpact > 0;

  // Trigger fetch for inline UI
  useEffect(() => {
    if (
      isExpanded &&
      showMobileInlineOffsetUI &&
      inlineOffsetState?.recommendationStatus === "idle"
    ) {
      fetchRecommendation(category.name);
    }
  }, [
    isExpanded,
    showMobileInlineOffsetUI,
    category.name,
    fetchRecommendation,
    inlineOffsetState?.recommendationStatus,
  ]);

  // Inline Handlers
  const handleInlineWidgetTrigger = (e: React.MouseEvent) => {
    e.stopPropagation();
    const charity = inlineOffsetState?.recommendedCharity;
    const amount = inlineOffsetState?.donationAmount ?? negativeImpactForOffset;
    if (charity && amount >= 1) {
      triggerWidget(charity, amount);
    } else {
      updateInlineOffsetState(category.name, {
        errorMessage: "Please enter amount >= $1.",
      });
    }
  };
  const handleInlineAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newAmount = Math.max(1, Number(e.target.value));
    updateInlineOffsetState(category.name, { donationAmount: newAmount });
  };
  // ** NEW ** Handler for "Change Charity" -> Opens Modal
  const handleOpenModalForChange = (e: React.MouseEvent) => {
    e.stopPropagation();
    const amount =
      inlineOffsetState?.donationAmount ?? category.totalNegativeImpact;
    onOpenModal(category.name, amount);
  };
  // Handler for Main Offset Button -> Opens Modal
  const handleOpenModalClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onOpenModal(category.name, negativeImpactForOffset);
  };

  // Progress Bar calc
  const totalAbsoluteImpact = totalPositiveImpact + totalNegativeImpact;
  let positivePercent = 0;
  let negativePercent = 0;
  if (totalAbsoluteImpact > 0) {
    positivePercent = (totalPositiveImpact / totalAbsoluteImpact) * 100;
    negativePercent = (totalNegativeImpact / totalAbsoluteImpact) * 100;
  } else if (totalPositiveImpact > 0) positivePercent = 100;
  else if (totalNegativeImpact > 0) negativePercent = 100;

  return (
    <div className="card flex flex-col">
      {/* Card Header */}
      <div
        role="button"
        tabIndex={0}
        className={`w-full bg-gray-50 dark:bg-gray-700/[.5] p-3 flex flex-col text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors rounded-t-lg cursor-pointer`}
        onClick={() => onToggleExpand(category.name)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onToggleExpand(category.name);
        }}
        aria-expanded={isExpanded}
      >
        {/* Top Row */}
        <div className="flex justify-between items-center w-full">
          <div className="flex items-center flex-grow min-w-0">
            {" "}
            <span className="text-lg mr-2 sm:mr-3">{category.icon}</span>{" "}
            <span
              className="font-semibold text-gray-700 dark:text-gray-200 text-sm sm:text-base truncate mr-3"
              title={category.name}
            >
              {category.name}
            </span>{" "}
          </div>
          <div className="flex items-center flex-shrink-0 gap-2">
            {" "}
            <AnimatedCounter
              value={netImpact}
              prefix={netImpact >= 0 ? "+$" : "-$"}
              className={`font-bold ${getNetImpactColor(
                netImpact
              )} text-sm sm:text-base w-20 text-right`}
              decimalPlaces={0}
              title={`Precise: ${netImpact >= 0 ? "+" : ""}${formatCurrency(
                netImpact
              )}`}
            />{" "}
            {/* Main Offset Button -> Opens Modal */}{" "}
            {negativeImpactForOffset > 0 && (
              <button
                onClick={handleOpenModalClick}
                className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs px-2 py-1 rounded-full transition-colors whitespace-nowrap z-10"
                title={`Offset ${
                  category.name
                } negative impact (${formatCurrency(negativeImpactForOffset)})`}
              >
                Offset
              </button>
            )}{" "}
            <svg
              className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform duration-200 ${
                isExpanded ? "rotate-180" : ""
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M19 9l-7 7-7-7"
              ></path>
            </svg>{" "}
          </div>
        </div>
        {/* Progress Bar */}
        {(totalPositiveImpact > 0 || totalNegativeImpact > 0) && (
          <div className="w-full mt-2 px-1">
            {" "}
            <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden flex">
              {" "}
              <div
                className="bg-[var(--success)] dark:bg-emerald-400 h-full"
                style={{ width: `${positivePercent}%` }}
                title={`Positive Impact: ${formatCurrency(
                  totalPositiveImpact
                )}`}
              />{" "}
              <div
                className="bg-[var(--destructive)] dark:bg-rose-400 h-full"
                style={{ width: `${negativePercent}%` }}
                title={`Negative Impact: ${formatCurrency(
                  totalNegativeImpact
                )}`}
              />{" "}
            </div>{" "}
          </div>
        )}
      </div>
      {/* Expandable Content */}
      <div
        className={`flex-grow overflow-y-auto max-h-96 scrollable-content ${
          isExpanded ? "block" : "hidden"
        }`}
      >
        <div className="p-3 space-y-2 border-t border-slate-200 dark:border-slate-700">
          {/* Transaction Details */}
          {allDetails.length === 0 && isExpanded && (
            <p className="text-xs text-center text-[var(--card-foreground)] opacity-70 py-4">
              No specific impact details.
            </p>
          )}
          {allDetails.map((detail, index) => {
            const detailAmountColor = detail.isPositive
              ? "text-[var(--success)] dark:text-emerald-400"
              : "text-[var(--destructive)] dark:text-rose-400";
            const detailBackgroundClass = detail.isPositive
              ? "bg-emerald-50/[.6] dark:bg-emerald-900/[.3]"
              : "bg-rose-50/[.6] dark:bg-rose-900/[.3]";
            return (
              <div
                key={`unified-detail-${category.name}-${index}-${detail.vendorName}-${detail.practice}`}
                className={`${detailBackgroundClass} p-2 rounded border-b border-gray-200/[.5] dark:border-gray-700/[.5] last:border-b-0`}
              >
                {" "}
                <DetailItem
                  detail={detail}
                  amountColor={detailAmountColor}
                />{" "}
              </div>
            );
          })}
          {/* Mobile Inline Offset UI */}
          {showMobileInlineOffsetUI && inlineOffsetState && (
            <div className="pt-3 border-t border-slate-200 dark:border-slate-700 mt-3 space-y-3">
              <p className="text-xs text-[var(--muted-foreground)] italic text-center">
                Offset negative impact:
              </p>
              {/* Display Recommended Charity or Loading/Error State */}
              {inlineOffsetState.recommendationStatus === "loading" && (
                <LoadingSpinner message="Finding best charity..." />
              )}
              {inlineOffsetState.recommendationStatus === "error" && (
                <p className="text-xs text-red-500 text-center">
                  {inlineOffsetState.errorMessage || "Could not load."}
                </p>
              )}
              {inlineOffsetState.recommendationStatus === "loaded" &&
                !inlineOffsetState.recommendedCharity && (
                  <p className="text-xs text-gray-500 text-center">
                    No specific charity found.
                  </p>
                )}

              {/* Display Recommended Charity Info */}
              {inlineOffsetState.recommendedCharity && (
                <div className="border rounded-md p-3 bg-white dark:bg-gray-700/[.5] space-y-2 border-slate-200 dark:border-slate-600">
                  {/* Charity Info + Rating */}
                  <div className="flex items-start space-x-3">
                    {" "}
                    <CharityImage
                      src={inlineOffsetState.recommendedCharity.logoUrl}
                      alt={inlineOffsetState.recommendedCharity.name}
                      width={40}
                      height={40}
                    />{" "}
                    <div className="flex-grow min-w-0">
                      {" "}
                      <p className="text-sm font-medium text-[var(--card-foreground)] truncate">
                        {inlineOffsetState.recommendedCharity.name}
                      </p>{" "}
                      <CharityRating
                        charity={inlineOffsetState.recommendedCharity}
                      />{" "}
                    </div>{" "}
                  </div>
                  {/* "Change Charity" button -> Opens Modal */}
                  <button
                    onClick={handleOpenModalForChange} // <-- OPENS MODAL
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {" "}
                    Change Charity{" "}
                  </button>
                  {/* Amount Input & Donate Button Container */}
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-600">
                    <div className="flex items-center justify-between space-x-2">
                      <label
                        htmlFor={`donationAmount-${category.name}-mobile`}
                        className="sr-only"
                      >
                        Amount:
                      </label>
                      <div className="flex items-center flex-grow">
                        {" "}
                        <span className="text-gray-500 dark:text-gray-400 mr-1">
                          $
                        </span>{" "}
                        <input
                          id={`donationAmount-${category.name}-mobile`}
                          type="number"
                          min="1"
                          value={inlineOffsetState.donationAmount}
                          onChange={handleInlineAmountChange}
                          className="w-full p-1 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          aria-label="Donation Amount"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        />{" "}
                      </div>
                      {/* Donate Button -> Triggers Widget */}
                      <button
                        onClick={handleInlineWidgetTrigger}
                        className="flex-shrink-0 text-sm bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-md disabled:opacity-50"
                        disabled={inlineOffsetState.donationAmount < 1}
                      >
                        Donate
                      </button>{" "}
                      {/* <-- TEXT SIMPLIFIED */}
                    </div>
                    {inlineOffsetState.errorMessage && (
                      <p className="text-xs text-red-500 mt-1">
                        {inlineOffsetState.errorMessage}
                      </p>
                    )}
                  </div>
                </div>
              )}
              {/* Fallback Offset Button if no recommendation loads -> Opens Modal */}
              {(inlineOffsetState.recommendationStatus === "error" ||
                (inlineOffsetState.recommendationStatus === "loaded" &&
                  !inlineOffsetState.recommendedCharity)) && (
                <button
                  onClick={handleOpenModalClick}
                  className="w-full mt-1 text-sm bg-gray-500 hover:bg-gray-600 text-white px-3 py-1.5 rounded-md"
                >
                  Offset (Choose Charity)
                </button>
              )}
            </div>
          )}
          {/* End Mobile Inline Offset UI */}
        </div>
      </div>
    </div>
  );
};

// --- Main Balance Sheet Component ---
export function BalanceSheetView({ transactions }: BalanceSheetViewProps) {
  const { impactAnalysis } = useTransactionStore();
  // Restore Modal Hook
  const { modalState, openDonationModal, closeDonationModal } =
    useDonationModal();
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [categoryInlineUIState, setCategoryInlineUIState] = useState<
    Record<string, CategoryInlineOffsetState>
  >({});

  // Helper to update inline UI state
  const updateInlineOffsetState = useCallback(
    (categoryName: string, updates: Partial<CategoryInlineOffsetState>) => {
      setCategoryInlineUIState((prev) => ({
        ...prev,
        [categoryName]: {
          ...(prev[categoryName] || {
            recommendationStatus: "idle",
            recommendedCharity: null,
            /* removed showSearch */ donationAmount: 0,
            errorMessage: null,
          }),
          ...updates,
        },
      }));
    },
    []
  );

  // Helper to find search term for recommendations - Uses Dominant Practice Logic
  const findDominantPracticeSearchTerm = useCallback(
    (categoryName: string): string => {
      if (!transactions || transactions.length === 0) {
        return categoryName;
      }
      const practiceContributions: Record<
        string,
        { contribution: number; term?: string }
      > = {};
      transactions.forEach((tx) => {
        (tx.unethicalPractices || []).forEach((practice) => {
          if (tx.practiceCategories?.[practice] === categoryName) {
            const weight = tx.practiceWeights?.[practice] || 0;
            const contribution = Math.abs(tx.amount) * (weight / 100);
            const current = practiceContributions[practice] || {
              contribution: 0,
            };
            practiceContributions[practice] = {
              contribution: current.contribution + contribution,
              term: tx.practiceSearchTerms?.[practice] || current.term,
            };
          }
        });
      });
      if (Object.keys(practiceContributions).length === 0) {
        return categoryName;
      }
      let dominantPractice: string | null = null;
      let maxContribution = -1;
      let termForDominantPractice: string | undefined = undefined;
      for (const [practice, data] of Object.entries(practiceContributions)) {
        if (data.contribution > maxContribution) {
          maxContribution = data.contribution;
          dominantPractice = practice;
          termForDominantPractice = data.term;
        }
      }
      if (termForDominantPractice) {
        /* console.log(`Dominant term for "${categoryName}" is "${termForDominantPractice}"`); */ return termForDominantPractice;
      } else {
        const fallbackMappings: Record<string, string> = {
          "Factory Farming": "animal welfare",
          "High Emissions": "climate",
          "Data Privacy Issues": "digital rights",
          "Water Waste": "water conservation",
          "Environmental Degradation": "conservation",
        };
        const fallbackTerm =
          (dominantPractice && fallbackMappings[dominantPractice]) ||
          categoryName;
        /* console.log(`Search term not found. Using fallback: "${fallbackTerm}"`); */ return fallbackTerm;
      }
    },
    [transactions]
  ); // Depends only on transactions

  // Function to fetch recommendation for inline UI
  const fetchRecommendation = useCallback(
    async (categoryName: string) => {
      if (categoryInlineUIState[categoryName]?.recommendationStatus !== "idle")
        return;
      updateInlineOffsetState(categoryName, {
        recommendationStatus: "loading",
        errorMessage: null,
      });
      try {
        const searchTerm = findDominantPracticeSearchTerm(categoryName); // <-- CONFIRMED: Uses correct logic
        
        console.log(
          `Fetching recommendation for category "${categoryName}" using search term: "${searchTerm}"`
        );
        const results =
          await enhancedCharityService.getTopRatedCharitiesWithPaymentLinks(
            searchTerm,
            5
          );

        const recommendation = results.length > 0 ? results[0] : null;
        const categoryData = processedData.categories.find(
          (c) => c.name === categoryName
        );
        const defaultAmount = Math.max(
          1,
          Math.round(categoryData?.totalNegativeImpact ?? 1)
        );
        updateInlineOffsetState(categoryName, {
          recommendationStatus: "loaded",
          recommendedCharity: recommendation,
          donationAmount: defaultAmount,
        }); // Store in recommendedCharity
      } catch (error) {
        console.error(
          `Error fetching recommendation for ${categoryName}:`,
          error
        );
        updateInlineOffsetState(categoryName, {
          recommendationStatus: "error",
          recommendedCharity: null,
          errorMessage: "Failed to load recommendation.",
        });
      }
    },
    [
      findDominantPracticeSearchTerm,
      updateInlineOffsetState,
      categoryInlineUIState,
    ]
  ); // Removed processedData dependency, will add below

  // Function to trigger widget directly from inline UI
  const triggerEveryOrgWidget = useCallback(
    (charity: EnrichedCharityResult, amount: number) => {
      const charityIdentifier = getWidgetIdentifier(charity);
      // Find category name better
      const categoryName =
        Object.keys(categoryInlineUIState).find(
          (cn) =>
            categoryInlineUIState[cn]?.recommendedCharity?.id === charity.id
        ) || "Unknown Category";
      if (!charityIdentifier) {
        console.error("Could not get identifier for charity:", charity);
        updateInlineOffsetState(categoryName, {
          errorMessage: "Could not identify charity.",
        });
        return;
      }
      const finalAmount = Math.max(1, Math.round(amount));
      if (window.everyDotOrgDonateButton) {
        try {
          const optionsToSet = {
            nonprofitSlug: charityIdentifier,
            amount: finalAmount,
            noExit: false,
            primaryColor: "#3b82f6",
          };
          window.everyDotOrgDonateButton.setOptions(optionsToSet);
          window.everyDotOrgDonateButton.showWidget();
        } catch (widgetError) {
          console.error(
            "Error configuring/showing Every.org widget:",
            widgetError
          );
          updateInlineOffsetState(categoryName, {
            errorMessage: "Could not init widget.",
          });
        }
      } else {
        console.error("Every.org widget script not loaded.");
        updateInlineOffsetState(categoryName, {
          errorMessage: "Donation service unavailable.",
        });
      }
    },
    [updateInlineOffsetState, categoryInlineUIState]
  );

  // Processed Data Memoization
  const processedData = useMemo(() => {
    // ... (Keep data processing logic) ...
    const categoryMap: Record<
      string,
      {
        name: string;
        icon: string;
        totalPositiveImpact: number;
        totalNegativeImpact: number;
        tempPositiveDetails: Record<string, CombinedImpactDetail>;
        tempNegativeDetails: Record<string, CombinedImpactDetail>;
      }
    > = {};
    const allCategoryNames = new Set<string>();
    const defaultPositiveCategory = "Uncategorized Positive";
    const defaultNegativeCategory = "Uncategorized Negative";
    transactions?.forEach((tx) => {
      const processImpacts = (isPositive: boolean) => {
        const practices = isPositive
          ? tx.ethicalPractices || []
          : tx.unethicalPractices || [];
        practices.forEach((practice) => {
          const categoryName =
            tx.practiceCategories?.[practice] ||
            (isPositive ? defaultPositiveCategory : defaultNegativeCategory);
          const weight = tx.practiceWeights?.[practice] || 0;
          const impactAmount = Math.abs(tx.amount * (weight / 100));
          const vendorName = tx.name || "Unknown Vendor";
          if (isNaN(impactAmount) || impactAmount <= 0.005) return;
          allCategoryNames.add(categoryName);
          if (!categoryMap[categoryName]) {
            categoryMap[categoryName] = {
              name: categoryName,
              icon:
                categoryIcons[categoryName] ||
                categoryIcons["Default Category"],
              totalPositiveImpact: 0,
              totalNegativeImpact: 0,
              tempPositiveDetails: {},
              tempNegativeDetails: {},
            };
          }
          const comboKey = `${vendorName}|${practice}`;
          const detailStore = isPositive
            ? categoryMap[categoryName].tempPositiveDetails
            : categoryMap[categoryName].tempNegativeDetails;
          if (detailStore[comboKey]) {
            detailStore[comboKey].totalImpactAmount += impactAmount;
            detailStore[comboKey].totalOriginalAmount += tx.amount;
            detailStore[comboKey].contributingTxCount += 1;
          } else {
            detailStore[comboKey] = {
              vendorName,
              practice,
              totalImpactAmount: impactAmount,
              totalOriginalAmount: tx.amount,
              impactWeight: weight,
              information: tx.information?.[practice],
              citations: tx.citations?.[practice] ?? [],
              isPositive,
              contributingTxCount: 1,
            };
          }
          if (isPositive) {
            categoryMap[categoryName].totalPositiveImpact += impactAmount;
          } else {
            categoryMap[categoryName].totalNegativeImpact += impactAmount;
          }
        });
      };
      processImpacts(true);
      processImpacts(false);
    });
    const finalCategories: CategoryData[] = Array.from(allCategoryNames)
      .map((categoryName) => {
        const categoryData = categoryMap[categoryName];
        if (categoryData) {
          const positiveDetails = Object.values(
            categoryData.tempPositiveDetails
          ).sort((a, b) => b.totalImpactAmount - a.totalImpactAmount);
          const negativeDetails = Object.values(
            categoryData.tempNegativeDetails
          ).sort((a, b) => b.totalImpactAmount - a.totalImpactAmount);
          return {
            name: categoryName,
            icon: categoryData.icon,
            totalPositiveImpact: categoryData.totalPositiveImpact,
            totalNegativeImpact: categoryData.totalNegativeImpact,
            positiveDetails,
            negativeDetails,
          };
        } else {
          return {
            name: categoryName,
            icon:
              categoryIcons[categoryName] || categoryIcons["Default Category"],
            totalPositiveImpact: 0,
            totalNegativeImpact: 0,
            positiveDetails: [],
            negativeDetails: [],
          };
        }
      })
      .sort((a, b) => {
        const netA = a.totalPositiveImpact - a.totalNegativeImpact;
        const netB = b.totalPositiveImpact - b.totalNegativeImpact;
        if (Math.abs(netA - netB) > 0.005) {
          return netA - netB;
        }
        return b.totalNegativeImpact - a.totalNegativeImpact;
      });
    const overallPositive = impactAnalysis?.positiveImpact ?? 0;
    const overallNegative = impactAnalysis?.negativeImpact ?? 0;
    return { categories: finalCategories, overallPositive, overallNegative };
  }, [transactions, impactAnalysis]);

  // Effect to initialize inline UI state when processedData is available
  useEffect(() => {
    processedData.categories.forEach((category) => {
      if (!categoryInlineUIState[category.name]) {
        updateInlineOffsetState(category.name, {
          recommendationStatus: "idle",
          recommendedCharity: null, // Initial state
          donationAmount: Math.max(
            1,
            Math.round(category.totalNegativeImpact ?? 1)
          ),
          errorMessage: null,
        });
      }
    });
  }, [
    processedData.categories,
    categoryInlineUIState,
    updateInlineOffsetState,
  ]);

  // Ensure fetchRecommendation updates its dependency correctly
  const fetchRecommendationCallback = useCallback(fetchRecommendation, [
    findDominantPracticeSearchTerm,
    updateInlineOffsetState,
    categoryInlineUIState,
    processedData.categories,
  ]);

  const toggleCategory = (categoryName: string) => {
    setExpandedCategory((prev) =>
      prev === categoryName ? null : categoryName
    );
  };

  // --- Render Logic ---
  if (!impactAnalysis && (!transactions || transactions.length === 0)) {
    return (
      <div className="flex items-center justify-center h-64">
        {" "}
        <LoadingSpinner message="Loading balance sheet data..." />{" "}
      </div>
    );
  }
  if (!transactions || transactions.length === 0) {
    return (
      <div className="card p-6 text-center">
        {" "}
        <p className="text-[var(--card-foreground)] opacity-70">
          {" "}
          No transaction data found.
        </p>{" "}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Mobile View */}
      <div className="lg:hidden space-y-4">
        {processedData.categories.length === 0 && (
          <div className="card p-6 text-center">
            {" "}
            <p className="text-[var(--card-foreground)] opacity-70">
              {" "}
              No category impacts identified.{" "}
            </p>{" "}
          </div>
        )}
        {processedData.categories.map((category) => (
          <UnifiedCategoryCard
            key={`unified-mobile-${category.name}`}
            category={category}
            isExpanded={expandedCategory === category.name}
            onToggleExpand={toggleCategory}
            onOpenModal={openDonationModal} // CORRECT: Opens modal
            inlineOffsetState={categoryInlineUIState[category.name]}
            fetchRecommendation={fetchRecommendationCallback} // Use stable callback
            updateInlineOffsetState={updateInlineOffsetState}
            triggerWidget={triggerEveryOrgWidget} // CORRECT: Triggers widget inline
          />
        ))}
      </div>

      {/* Desktop View */}
      <div className="hidden lg:block space-y-4">
        {/* Header */}
        <div className="grid grid-cols-2 gap-x-6 pb-2 border-b border-slate-200 dark:border-slate-700">
          {" "}
          <h3 className="text-xl font-semibold text-center text-[var(--destructive)] dark:text-rose-400">
            {" "}
            Negative Impact{" "}
            <span className="text-lg">
              (
              <AnimatedCounter
                value={processedData.overallNegative}
                prefix="$"
                decimalPlaces={0}
                title={`Precise: ${formatCurrency(
                  processedData.overallNegative
                )}`}
              />
              )
            </span>{" "}
          </h3>{" "}
          <h3 className="text-xl font-semibold text-center text-[var(--success)] dark:text-emerald-400">
            {" "}
            Positive Impact{" "}
            <span className="text-lg">
              (
              <AnimatedCounter
                value={processedData.overallPositive}
                prefix="$"
                decimalPlaces={0}
                title={`Precise: ${formatCurrency(
                  processedData.overallPositive
                )}`}
              />
              )
            </span>{" "}
          </h3>{" "}
        </div>
        {processedData.categories.length === 0 && (
          <div className="card p-6 text-center col-span-2">
            {" "}
            <p className="text-[var(--card-foreground)] opacity-70">
              {" "}
              No category impacts identified.{" "}
            </p>{" "}
          </div>
        )}
        {/* Category Rows */}
        {processedData.categories.map((category) => (
          <div
            key={`cat-row-desktop-${category.name}`}
            className="grid grid-cols-2 gap-x-6 items-start"
          >
            {/* Negative Card */}
            <div>
              <CategoryCard
                category={category}
                isPositive={false}
                isExpanded={expandedCategory === category.name}
                onToggleExpand={toggleCategory}
                onOpenModal={openDonationModal} // CORRECT: Opens modal
                inlineOffsetState={categoryInlineUIState[category.name]}
                fetchRecommendation={fetchRecommendationCallback} // Use stable callback
                updateInlineOffsetState={updateInlineOffsetState}
                triggerWidget={triggerEveryOrgWidget}
              />
            </div>
            {/* Positive Card */}
            <div>
              <CategoryCard
                category={category}
                isPositive={true}
                isExpanded={expandedCategory === category.name}
                onToggleExpand={toggleCategory}
                onOpenModal={openDonationModal} // Pass but not used by inline UI's primary button
                inlineOffsetState={categoryInlineUIState[category.name]}
                fetchRecommendation={fetchRecommendationCallback} // Use stable callback
                updateInlineOffsetState={updateInlineOffsetState}
                triggerWidget={triggerEveryOrgWidget} // CORRECT: Triggers widget inline
              />
            </div>
          </div>
        ))}
      </div>

      {/* --- Render Main Donation Modal --- */}
      {modalState.isOpen && (
        <DonationModal
          isOpen={modalState.isOpen}
          practice={modalState.practice || ""}
          amount={modalState.amount || 0}
          onClose={closeDonationModal}
        />
      )}
      {/* --- End Render --- */}
    </div>
  );
}
