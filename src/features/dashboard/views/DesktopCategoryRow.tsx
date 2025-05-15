// src/features/dashboard/views/DesktopCategoryRow.jsx
"use client";

import React, { useEffect } from "react";
import { ProcessedCategoryData, CategoryInlineOffsetState } from "./BalanceSheetView"; // Assuming types are exported or defined in a shared place
import { DetailItem } from "./BalanceSheetView"; // Assuming DetailItem is also exported or accessible
import { AnimatedCounter } from "@/shared/ui/AnimatedCounter";
import { LoadingSpinner } from "@/shared/ui/LoadingSpinner";
import { CharityImage } from "@/features/charity/CharityImage";
import { CharityRating } from "@/features/charity/CharityRating";
import { EnrichedCharityResult } from "@/features/charity/types";

// Helper functions (can be moved to a shared utils file if not already)
const formatCurrency = (value: number) => `$${(value ?? 0).toFixed(2)}`;
const getNetImpactColor = (netImpact: number) => {
  if (netImpact > 0.01) return "text-[var(--success)] dark:text-emerald-400";
  if (netImpact < -0.01) return "text-[var(--destructive)] dark:text-rose-400";
  return "text-gray-500 dark:text-gray-400";
};


interface DesktopCategoryRowProps {
  category: ProcessedCategoryData;
  isExpanded: boolean;
  onToggleExpand: (categoryName: string) => void;
  onOpenModal: (categoryName: string, amount: number) => void;
  inlineOffsetState?: CategoryInlineOffsetState;
  fetchRecommendation: (categoryName: string) => Promise<void>;
  updateInlineOffsetState: (categoryName: string, updates: Partial<CategoryInlineOffsetState>) => void;
  triggerWidget: (charity: EnrichedCharityResult, amount: number) => void;
}

export function DesktopCategoryRow({
  category,
  isExpanded,
  onToggleExpand,
  onOpenModal,
  inlineOffsetState,
  fetchRecommendation,
  updateInlineOffsetState,
  triggerWidget,
}: DesktopCategoryRowProps) {
  const { totalPositiveImpact, totalNegativeImpact, name: categoryName, icon } = category;
  const netImpact = totalPositiveImpact - totalNegativeImpact;
  const negativeImpactForOffset = totalNegativeImpact; // Amount to offset for this category

  // Progress bar calculation
  const totalAbsoluteImpact = totalPositiveImpact + totalNegativeImpact;
  let positivePercent = 0;
  let negativePercent = 0;
  if (totalAbsoluteImpact > 0.005) {
    positivePercent = (totalPositiveImpact / totalAbsoluteImpact) * 100;
    negativePercent = (totalNegativeImpact / totalAbsoluteImpact) * 100;
  } else if (totalPositiveImpact > 0.005) {
    positivePercent = 100;
  } else if (totalNegativeImpact > 0.005) {
    negativePercent = 100;
  }

  // Inline offset UI logic (for collapsed view or positive details empty view)
  const showInlineOffsetWhenCollapsed = !isExpanded && negativeImpactForOffset > 0.005 && inlineOffsetState?.recommendationStatus === 'loaded' && inlineOffsetState?.recommendedCharity;
  const showInlineOffsetInPositiveDetails = isExpanded && category.positiveDetails.length === 0 && negativeImpactForOffset > 0.005;


  useEffect(() => {
    // Fetch recommendation if card is collapsed but has debt, or if expanded and positive details are empty but has debt
    const shouldFetch = (!isExpanded && negativeImpactForOffset > 0.005) || (isExpanded && category.positiveDetails.length === 0 && negativeImpactForOffset > 0.005);
    if (
      shouldFetch &&
      inlineOffsetState?.recommendationStatus === "idle"
    ) {
      fetchRecommendation(categoryName);
    }
  }, [
    isExpanded,
    negativeImpactForOffset,
    categoryName,
    fetchRecommendation,
    inlineOffsetState?.recommendationStatus,
    category.positiveDetails.length
  ]);

  const handleOpenModalClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onOpenModal(categoryName, negativeImpactForOffset);
  };
  
  const handleInlineWidgetTrigger = (e: React.MouseEvent) => {
    e.stopPropagation();
    const charity = inlineOffsetState?.recommendedCharity;
    const amount = inlineOffsetState?.donationAmount ?? negativeImpactForOffset;
    if (charity && amount >= 1) {
      triggerWidget(charity, amount);
    } else {
      updateInlineOffsetState(categoryName, {
        errorMessage: "Please select a charity and enter amount >= $1.",
      });
    }
  };

  const handleInlineAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newAmount = Math.max(1, Number(e.target.value));
    updateInlineOffsetState(categoryName, { donationAmount: newAmount });
  };
  
  const handleOpenModalForChangeCharity = (e: React.MouseEvent) => {
    e.stopPropagation();
    const amount = inlineOffsetState?.donationAmount ?? negativeImpactForOffset;
    onOpenModal(categoryName, amount);
  };

  const renderInlineOffsetSection = (isForCollapsedHeader: boolean = false) => {
    if (isForCollapsedHeader) {
      return null;
    }
    if (!inlineOffsetState) return null;
    // Only show if there's a negative impact to offset
    if (negativeImpactForOffset <= 0.005) return null;
    // Specific condition for collapsed header
    if (isForCollapsedHeader && !(showInlineOffsetWhenCollapsed && inlineOffsetState.recommendedCharity)) return null;
    // Specific condition for positive details section
    if (!isForCollapsedHeader && !showInlineOffsetInPositiveDetails) return null;


    return (
      <div className={`mt-2 ${isForCollapsedHeader ? 'px-3 pb-3' : 'pt-3 border-t border-dashed border-slate-300 dark:border-slate-600'}`}>
        {!isForCollapsedHeader && (
            <p className="text-xs text-[var(--muted-foreground)] italic text-center mb-2">
                This category has related negative impacts of {formatCurrency(negativeImpactForOffset)}. You can offset this:
            </p>
        )}
        {inlineOffsetState.recommendationStatus === "loading" && (
          <LoadingSpinner message="Finding best charity..." />
        )}
        {inlineOffsetState.recommendationStatus === "error" && (
          <p className="text-xs text-red-500 text-center">
            {inlineOffsetState.errorMessage || "Could not load charity."}
          </p>
        )}
        {inlineOffsetState.recommendationStatus === "loaded" &&
          !inlineOffsetState.recommendedCharity && (
             <div className="text-center">
                <p className="text-xs text-gray-500">No specific charity found.</p>
                 <button
                    onClick={handleOpenModalClick}
                    className="text-blue-500 hover:underline text-xs font-medium"
                  >
                    Offset Manually
                  </button>
             </div>
          )}
        {inlineOffsetState.recommendedCharity && (
          <div className="border rounded-md p-2 sm:p-3 bg-white dark:bg-gray-700/[.5] space-y-2 border-slate-200 dark:border-slate-600">
            <div className="flex items-start space-x-2 sm:space-x-3">
              <CharityImage
                src={inlineOffsetState.recommendedCharity.logoUrl}
                alt={inlineOffsetState.recommendedCharity.name}
                width={32} height={32} // Slightly smaller for inline
              />
              <div className="flex-grow min-w-0">
                <p className="text-sm font-medium text-[var(--card-foreground)] truncate">
                  {inlineOffsetState.recommendedCharity.name}
                </p>
                <CharityRating charity={inlineOffsetState.recommendedCharity} />
              </div>
            </div>
            <button
              onClick={handleOpenModalForChangeCharity}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              Change Charity
            </button>
            <div className="pt-2 border-t border-slate-200 dark:border-slate-600">
              <div className="flex items-center justify-between space-x-2">
                <label
                  htmlFor={`donationAmount-${categoryName}-desktopRow`}
                  className="sr-only"
                >
                  Amount:
                </label>
                <div className="flex items-center flex-grow">
                  <span className="text-gray-500 dark:text-gray-400 mr-1">$</span>
                  <input
                    id={`donationAmount-${categoryName}-desktopRow`}
                    type="number" min="1"
                    value={inlineOffsetState.donationAmount}
                    onChange={handleInlineAmountChange}
                    className="w-full p-1 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    aria-label="Donation Amount"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                </div>
                <button
                  onClick={handleInlineWidgetTrigger}
                  className="flex-shrink-0 text-sm bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-md disabled:opacity-50"
                  disabled={!inlineOffsetState.recommendedCharity || inlineOffsetState.donationAmount < 1}
                  title={`Donate to ${inlineOffsetState.recommendedCharity?.name}`}
                >
                  Donate
                </button>
              </div>
              {inlineOffsetState.errorMessage && (
                <p className="text-xs text-red-500 mt-1">{inlineOffsetState.errorMessage}</p>
              )}
            </div>
          </div>
        )}
         {(inlineOffsetState.recommendationStatus === "error" || (inlineOffsetState.recommendationStatus === "loaded" && !inlineOffsetState.recommendedCharity)) && (
            <button
                onClick={handleOpenModalClick}
                className="w-full mt-1 text-sm bg-gray-500 hover:bg-gray-600 text-white px-3 py-1.5 rounded-md"
            >
                Offset (Choose Charity)
            </button>
        )}
      </div>
    );
  };


  return (
    <div className="card mb-4">
      {/* Unified Header */}
      <div
        role="button"
        tabIndex={0}
        className="w-full bg-gray-50 dark:bg-gray-700/[.5] p-3 flex flex-col text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors rounded-t-lg cursor-pointer"
        onClick={() => onToggleExpand(categoryName)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onToggleExpand(categoryName); }}
        aria-expanded={isExpanded}
      >
        <div className="flex justify-between items-center w-full">
          <div className="flex items-center flex-grow min-w-0">
            <span className="text-lg mr-2 sm:mr-3">{icon}</span>
            <span
              className="font-semibold text-gray-700 dark:text-gray-200 text-sm sm:text-base truncate mr-3"
              title={categoryName}
            >
              {categoryName}
            </span>
          </div>
          <div className="flex items-center flex-shrink-0 gap-2">
            <AnimatedCounter
              value={Math.abs(netImpact)}
              prefix={netImpact >= 0 ? "+$" : "-$"}
              className={`font-bold ${getNetImpactColor(netImpact)} text-sm sm:text-base w-20 text-right`}
              decimalPlaces={0}
              title={`Precise Net: ${netImpact >= 0 ? "+" : ""}${formatCurrency(netImpact)}`}
            />
            {negativeImpactForOffset > 0.005 && (
              <button
                onClick={handleOpenModalClick}
                className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs px-2 py-1 rounded-full transition-colors whitespace-nowrap z-10"
                title={`Offset ${categoryName} negative impact (${formatCurrency(negativeImpactForOffset)})`}
              >
                Offset
              </button>
            )}
            <svg
              className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
        {(totalPositiveImpact > 0.005 || totalNegativeImpact > 0.005) && (
          <div className="w-full mt-2 px-1">
            <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden flex">
              <div
                className="bg-[var(--success)] dark:bg-emerald-400 h-full"
                style={{ width: `${positivePercent}%` }}
                title={`Positive Impact: ${formatCurrency(totalPositiveImpact)}`}
              />
              <div
                className="bg-[var(--destructive)] dark:bg-rose-400 h-full"
                style={{ width: `${negativePercent}%` }}
                title={`Negative Impact: ${formatCurrency(totalNegativeImpact)}`}
              />
            </div>
          </div>
        )}
        {/* Render inline offset section if card is collapsed and conditions met */}
        {renderInlineOffsetSection(true)}
      </div>

      {/* Details Section (conditionally rendered) */}
      {isExpanded && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-0 border-t border-slate-200 dark:border-slate-700">
          {/* Negative Details Panel */}
          <div className="p-3 sm:p-4 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-700 space-y-3">
            <h4 className="text-sm font-semibold mb-2 text-center text-[var(--destructive)] dark:text-rose-400">
              Negative Details ({formatCurrency(category.totalNegativeImpact)})
            </h4>
            {category.negativeDetails.length > 0 ? (
              category.negativeDetails.map((detail, index) => (
                <DetailItem key={`desktop-neg-detail-${categoryName}-${index}`} detail={detail} amountColor="text-[var(--destructive)] dark:text-rose-400" />
              ))
            ) : (
              <p className="text-xs text-center text-[var(--card-foreground)] opacity-70 py-4">No negative details for this category.</p>
            )}
          </div>
          {/* Positive Details Panel */}
          <div className="p-3 sm:p-4 space-y-3">
            <h4 className="text-sm font-semibold mb-2 text-center text-[var(--success)] dark:text-emerald-400">
              Positive Details ({formatCurrency(category.totalPositiveImpact)})
            </h4>
            {category.positiveDetails.length > 0 ? (
              category.positiveDetails.map((detail, index) => (
                <DetailItem key={`desktop-pos-detail-${categoryName}-${index}`} detail={detail} amountColor="text-[var(--success)] dark:text-emerald-400" />
              ))
            ) : (
              <p className="text-xs text-center text-[var(--card-foreground)] opacity-70 py-4">No positive details for this category.</p>
            )}
            {/* Render inline offset section if positive details are empty and conditions met */}
            {renderInlineOffsetSection(false)}
          </div>
        </div>
      )}
    </div>
  );
}