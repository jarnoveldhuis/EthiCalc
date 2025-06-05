// src/features/dashboard/views/DesktopCategoryRow.tsx
"use client";

import React, { useEffect, useMemo } from "react";
import {
  ProcessedCategoryData,
  CategoryInlineOffsetState,
} from "./BalanceSheetView";
import { DetailItem } from "./BalanceSheetView";
import { AnimatedCounter } from "@/shared/ui/AnimatedCounter";
import { LoadingSpinner } from "@/shared/ui/LoadingSpinner";
import { CharityImage } from "@/features/charity/CharityImage";
import { CharityRating } from "@/features/charity/CharityRating";
import { EnrichedCharityResult } from "@/features/charity/types";

// Helper functions
const formatCurrency = (value: number | undefined | null): string => {
  const num = value ?? 0;
  return `$${num.toFixed(2)}`;
};
const getNetImpactColor = (netImpact: number): string => {
  if (netImpact > 0.005) return "text-[var(--success)] dark:text-emerald-400";
  if (netImpact < -0.005) return "text-[var(--destructive)] dark:text-rose-400";
  return "text-gray-500 dark:text-gray-400";
};

interface DesktopCategoryRowProps {
  category: ProcessedCategoryData;
  isExpanded: boolean;
  onToggleExpand: (categoryName: string) => void;
  onOpenModal: (
    categoryName: string,
    amount: number,
    searchTerm?: string
  ) => void;
  inlineOffsetState?: CategoryInlineOffsetState;
  fetchRecommendation: (categoryName: string) => Promise<void>;
  updateInlineOffsetState: (
    categoryName: string,
    updates: Partial<CategoryInlineOffsetState>
  ) => void;
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
  const {
    totalPositiveImpact,
    totalNegativeImpact,
    name: categoryName,
    icon,
    positiveDetails,
    negativeDetails,
  } = category;
  const netImpact = totalPositiveImpact - totalNegativeImpact;
  const netDebtForCategory = useMemo(() => 
    netImpact < 0 ? Math.abs(netImpact) : 0, 
    [netImpact]
  );

  // --- EFFECT RESTORED ---
  // Fetch recommendation if the row is expanded and has a negative impact to offset.
  useEffect(() => {
    if (
      isExpanded &&
      netDebtForCategory > 0.005 &&
      inlineOffsetState?.recommendationStatus === "idle"
    ) {
      fetchRecommendation(categoryName);
    }
  }, [
    isExpanded,
    netDebtForCategory,
    categoryName,
    fetchRecommendation,
    inlineOffsetState?.recommendationStatus,
  ]);

  const handleOpenModalClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onOpenModal(categoryName, netDebtForCategory, categoryName);
  };

  const handleInlineWidgetTrigger = (e: React.MouseEvent) => {
    e.stopPropagation();
    const charity = inlineOffsetState?.recommendedCharity;
    const amount = inlineOffsetState?.donationAmount ?? netDebtForCategory;
    if (charity && amount >= 1) {
      triggerWidget(charity, amount);
    } else {
      updateInlineOffsetState(categoryName, {
        errorMessage:
          "Please select a charity and enter an amount of $1 or more.",
      });
    }
  };

  const handleInlineAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newAmount = Math.max(1, Number(e.target.value));
    updateInlineOffsetState(categoryName, { donationAmount: newAmount });
  };

  const handleOpenModalForChangeCharity = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Use net debt as the fallback amount
    const amount = inlineOffsetState?.donationAmount ?? netDebtForCategory;
    onOpenModal(categoryName, amount, categoryName);
  };

  // --- RENDER FUNCTION RESTORED ---
  const renderInlineOffsetSection = () => {
    // Only render if the row is expanded and there's a negative impact
    if (!isExpanded || netDebtForCategory <= 0.005 || !inlineOffsetState)
      return null;

    return (
      <div className="pt-3  mt-3">

        {inlineOffsetState.recommendationStatus === "loading" && (
          <LoadingSpinner message="Finding charity..." />
        )}
        {inlineOffsetState.recommendationStatus === "error" && (
          <p className="text-xs text-red-500 text-center">
            {inlineOffsetState.errorMessage || "Could not load suggestion."}
          </p>
        )}

        {inlineOffsetState.recommendationStatus === "loaded" &&
          !inlineOffsetState.recommendedCharity && (
            <div className="text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                No specific charity suggestion found.
              </p>
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
                width={32}
                height={32}
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
                <div className="flex items-center flex-grow">
                  <span className="text-gray-500 dark:text-gray-400 mr-1">
                    $
                  </span>
                  <input
                    id={`donationAmount-${categoryName}-desktopRow`}
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
                <button
                  onClick={handleInlineWidgetTrigger}
                  className="flex-shrink-0 text-sm bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-md disabled:opacity-50"
                  disabled={
                    !inlineOffsetState.recommendedCharity ||
                    (inlineOffsetState.donationAmount ?? 0) < 1
                  }
                  title={`Donate to ${inlineOffsetState.recommendedCharity?.name}`}
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
      </div>
    );
  };

  return (
    <div className="card mb-4">
      {/* ... (Header remains unchanged) ... */}
      <div
        role="button"
        tabIndex={0}
        className="w-full bg-gray-50 dark:bg-gray-700/[.5] p-3 flex flex-col text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors rounded-t-lg cursor-pointer"
        onClick={() => onToggleExpand(categoryName)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onToggleExpand(categoryName);
        }}
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
              prefix={
                netImpact >= 0.005 ? "+$" : netImpact <= -0.005 ? "-$" : "$"
              }
              className={`font-bold ${getNetImpactColor(
                netImpact
              )} text-sm sm:text-base w-20 text-right`}
              decimalPlaces={0}
              title={`Precise Net: ${netImpact >= 0 ? "+" : ""}${formatCurrency(
                netImpact
              )}`}
            />
            {netDebtForCategory > 0.005 && (
              <button
                onClick={handleOpenModalClick}
                className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs px-2 py-1 rounded-full transition-colors whitespace-nowrap z-10"
                title={`Offset ${categoryName} negative impact (${formatCurrency(
                  netDebtForCategory
                )})`}
              >
                Offset
              </button>
            )}
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
              />
            </svg>
          </div>
        </div>
      </div>
      {isExpanded && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-0 border-t border-slate-200 dark:border-slate-700">
          <div className="p-3 sm:p-4 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-700 space-y-3">
            <h4 className="text-sm font-semibold mb-2 text-center text-[var(--success)] dark:text-emerald-400">
              Positive Impact ({formatCurrency(totalPositiveImpact)})
            </h4>
            {positiveDetails.length > 0 ? (
              positiveDetails.map((detail, index) => (
                <DetailItem
                  key={`desktop-pos-detail-${categoryName}-${index}`}
                  detail={detail}
                  amountColor="text-[var(--success)] dark:text-emerald-400"
                />
              ))
            ) : (
              <p className="text-xs text-center text-[var(--card-foreground)] opacity-70 py-4">
                No positive impact for this category.
              </p>
            )}
            {/* --- PLACEMENT: Inline offset UI is now here --- */}
            {renderInlineOffsetSection()}
          </div>

          <div className="p-3 sm:p-4 space-y-3">
            <h4 className="text-sm font-semibold mb-2 text-center text-[var(--destructive)] dark:text-rose-400">
              Negative Impact ({formatCurrency(totalNegativeImpact)})
            </h4>
            {negativeDetails.length > 0 ? (
              negativeDetails.map((detail, index) => (
                <DetailItem
                  key={`desktop-neg-detail-${categoryName}-${index}`}
                  detail={detail}
                  amountColor="text-[var(--destructive)] dark:text-rose-400"
                />
              ))
            ) : (
              <p className="text-xs text-center text-[var(--card-foreground)] opacity-70 py-4">
                No negative impact for this category.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
