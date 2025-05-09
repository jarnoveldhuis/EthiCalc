// src/features/dashboard/views/BalanceSheetView.tsx
"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useTransactionStore } from "@/store/transactionStore"; // No UserValueSettings type import needed here
import { calculationService } from "@/core/calculations/impactService";
import { Transaction, Citation } from "@/shared/types/transactions";
import { EnrichedCharityResult } from "@/features/charity/types";
import { LoadingSpinner } from "@/shared/ui/LoadingSpinner";
import { enhancedCharityService } from "@/features/charity/enhancedCharityService";
import { CharityImage } from "@/features/charity/CharityImage";
import { CharityRating } from "@/features/charity/CharityRating";
import { AnimatedCounter } from "@/shared/ui/AnimatedCounter";
import { DonationModal } from "@/features/charity/DonationModal";
import { useDonationModal } from "@/hooks/useDonationModal";
import { valueEmojis } from "@/config/valueEmojis"; // Correct import

// --- Interface Definitions --- (Keep as before)
interface BalanceSheetViewProps {
  transactions: Transaction[];
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
interface CategoryInlineOffsetState {
  recommendationStatus: "idle" | "loading" | "loaded" | "error";
  recommendedCharity: EnrichedCharityResult | null;
  donationAmount: number;
  errorMessage: string | null;
}

interface ProcessedCategoryData {
  name: string;
  icon: string;
  totalPositiveImpact: number;
  totalNegativeImpact: number;
  positiveDetails: CombinedImpactDetail[];
  negativeDetails: CombinedImpactDetail[];
}

interface CategoryCardProps {
  category: ProcessedCategoryData;
  isPositive: boolean;
  isExpanded: boolean;
  onToggleExpand: (categoryName: string) => void;
  onOpenModal: (categoryName: string, amount: number) => void;
  inlineOffsetState?: CategoryInlineOffsetState;
  fetchRecommendation: (categoryName: string) => Promise<void>;
  updateInlineOffsetState: (categoryName: string, updates: Partial<CategoryInlineOffsetState>) => void;
  triggerWidget: (charity: EnrichedCharityResult, amount: number) => void;
}

interface UnifiedCategoryCardProps {
  category: ProcessedCategoryData;
  isExpanded: boolean;
  onToggleExpand: (categoryName: string) => void;
  onOpenModal: (categoryName: string, amount: number) => void;
  inlineOffsetState?: CategoryInlineOffsetState;
  fetchRecommendation: (categoryName: string) => Promise<void>;
  updateInlineOffsetState: (categoryName: string, updates: Partial<CategoryInlineOffsetState>) => void;
  triggerWidget: (charity: EnrichedCharityResult, amount: number) => void;
}

// --- Helper Functions --- (Keep as before)
const formatCurrency = (value: number | undefined | null): string => {
  const num = value ?? 0;
  return `$${num.toFixed(2)}`;
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

// --- Sub-Components (Keep DetailItem, CategoryCard, UnifiedCategoryCard definitions) ---
// Ensure these components use CharityImage and CharityRating imports correctly within their JSX
const DetailItem: React.FC<DetailItemProps> = ({ detail, amountColor }) => {
  /* ... */ const [citationsVisible, setCitationsVisible] = useState(false);
  const citations = detail.citations;
  const hasCitations = Array.isArray(citations) && citations.length > 0;
  const preciseFormatImpact = (amount: number, isPositive: boolean) => {
    const sign = isPositive ? "+" : "-";
    return `${sign}${formatCurrency(amount)}`;
  };
  return (
    <div className="border-b border-slate-200 dark:border-slate-700 pb-2 last:border-b-0 last:pb-0">
      {" "}
      <div className="flex justify-between items-start mb-1 gap-2">
        {" "}
        <div className="flex-grow min-w-0">
          {" "}
          <span
            className="block font-medium text-[var(--card-foreground)] text-sm truncate"
            title={detail.vendorName}
          >
            {" "}
            {detail.vendorName}{" "}
          </span>{" "}
          <span
            className="block text-xs text-blue-600 dark:text-blue-400 truncate"
            title={detail.practice}
          >
            {" "}
            {detail.practice} ({detail.impactWeight}%){" "}
          </span>{" "}
          {detail.contributingTxCount > 1 && (
            <span className="block text-xxs text-[var(--muted-foreground)]">
              {" "}
              ({detail.contributingTxCount} transactions){" "}
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
            title={`Precise: ${preciseFormatImpact(detail.totalImpactAmount, detail.isPositive)}`}
          />{" "}
          <span className="block text-xs text-[var(--muted-foreground)]">
            {" "}
            (Orig: {formatCurrency(detail.totalOriginalAmount)}){" "}
          </span>{" "}
        </div>{" "}
      </div>{" "}
      {detail.information && (
        <p className="mt-1 pl-2 border-l-2 border-gray-300 dark:border-gray-600 text-xs text-[var(--card-foreground)] opacity-80 italic">
          {" "}
          <span aria-hidden="true">ℹ️ </span>
          {detail.information}{" "}
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
                    className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline break-all"
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
  /* ... */ const details = isPositive
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
  const handleOpenModalForChange = (e: React.MouseEvent) => {
    e.stopPropagation();
    const amount =
      inlineOffsetState?.donationAmount ?? category.totalNegativeImpact;
    onOpenModal(category.name, amount);
  };
  const handleOpenModalClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onOpenModal(category.name, Math.abs(totalImpact));
  };
  return (
    <div className="card flex flex-col h-full">
      {" "}
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
        {" "}
        <div className="flex items-center flex-grow min-w-0">
          {" "}
          <span className="text-lg mr-2 sm:mr-3">{category.icon}</span>{" "}
          <span
            className="font-semibold text-gray-700 dark:text-gray-200 text-sm sm:text-base truncate mr-3"
            title={category.name}
          >
            {" "}
            {category.name}{" "}
          </span>{" "}
        </div>{" "}
        <div className="flex items-center flex-shrink-0 gap-2">
          {" "}
          <AnimatedCounter
            value={Math.abs(totalImpact)}
            prefix="$"
            className={`font-bold ${amountColor} text-sm sm:text-base w-20 text-right`}
            decimalPlaces={0}
            title={`Precise: ${formatCurrency(totalImpact)}`}
          />{" "}
          {!isPositive && totalImpact > 0.005 && (
            <button
              onClick={handleOpenModalClick}
              className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs px-2 py-1 rounded-full transition-colors whitespace-nowrap z-10"
              title={`Offset ${category.name} impact`}
            >
              {" "}
              Offset{" "}
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
        </div>{" "}
      </div>{" "}
      <div
        className={`flex-grow overflow-y-auto max-h-96 scrollable-content ${
          showDetails ? "block" : "hidden"
        }`}
      >
        {" "}
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 space-y-3">
          {" "}
          {!isEmpty &&
            details.map((detail: CombinedImpactDetail, index: number) => (
              <DetailItem
                key={`${isPositive ? "pos" : "neg"}-detail-${
                  category.name
                }-${index}-${detail.vendorName}-${detail.practice}`}
                detail={detail}
                amountColor={amountColor}
              />
            ))}{" "}
          {isEmpty && showDetails && !showInlineOffsetUI && (
            <p className="text-xs text-center text-[var(--card-foreground)] opacity-70">
              {" "}
              No {isPositive ? "positive" : "negative"} impact details.{" "}
            </p>
          )}{" "}
          {showInlineOffsetUI && showDetails && inlineOffsetState && (
            <div className="space-y-3">
              {" "}
              <p className="text-xs text-[var(--muted-foreground)] italic text-center">
                {" "}
                Offset negative impact:{" "}
              </p>{" "}
              {inlineOffsetState.recommendationStatus === "loading" && (
                <LoadingSpinner message="Finding best charity..." />
              )}{" "}
              {inlineOffsetState.recommendationStatus === "error" && (
                <p className="text-xs text-red-500 text-center">
                  {" "}
                  {inlineOffsetState.errorMessage || "Could not load."}{" "}
                </p>
              )}{" "}
              {inlineOffsetState.recommendationStatus === "loaded" &&
                !inlineOffsetState.recommendedCharity && (
                  <p className="text-xs text-gray-500 text-center">
                    {" "}
                    No specific charity found.{" "}
                  </p>
                )}{" "}
              {inlineOffsetState.recommendedCharity && (
                <div className="border rounded-md p-3 bg-white dark:bg-gray-700/[.5] space-y-2 border-slate-200 dark:border-slate-600">
                  {" "}
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
                        {" "}
                        {inlineOffsetState.recommendedCharity.name}{" "}
                      </p>{" "}
                      <CharityRating
                        charity={inlineOffsetState.recommendedCharity}
                      />{" "}
                    </div>{" "}
                  </div>{" "}
                  <button
                    onClick={handleOpenModalForChange}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {" "}
                    Change Charity{" "}
                  </button>{" "}
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-600">
                    {" "}
                    <div className="flex items-center justify-between space-x-2">
                      {" "}
                      <label
                        htmlFor={`donationAmount-${category.name}-desktop`}
                        className="sr-only"
                      >
                        {" "}
                        Amount:{" "}
                      </label>{" "}
                      <div className="flex items-center flex-grow">
                        {" "}
                        <span className="text-gray-500 dark:text-gray-400 mr-1">
                          $
                        </span>{" "}
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
                        />{" "}
                      </div>{" "}
                      <button
                        onClick={handleInlineWidgetTrigger}
                        className="flex-shrink-0 text-sm bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-md disabled:opacity-50"
                        disabled={inlineOffsetState.donationAmount < 1}
                      >
                        {" "}
                        Donate{" "}
                      </button>{" "}
                    </div>{" "}
                    {inlineOffsetState.errorMessage && (
                      <p className="text-xs text-red-500 mt-1">
                        {" "}
                        {inlineOffsetState.errorMessage}{" "}
                      </p>
                    )}{" "}
                  </div>{" "}
                </div>
              )}{" "}
              {(inlineOffsetState.recommendationStatus === "error" ||
                (inlineOffsetState.recommendationStatus === "loaded" &&
                  !inlineOffsetState.recommendedCharity)) && (
                <button
                  onClick={handleOpenModalClick}
                  className="w-full mt-1 text-sm bg-gray-500 hover:bg-gray-600 text-white px-3 py-1.5 rounded-md"
                >
                  {" "}
                  Offset (Choose Charity){" "}
                </button>
              )}{" "}
            </div>
          )}{" "}
        </div>{" "}
      </div>{" "}
    </div>
  );
};
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
  /* ... */ const { totalPositiveImpact, totalNegativeImpact } = category;
  const netImpact = totalPositiveImpact - totalNegativeImpact;
  const negativeImpactForOffset = totalNegativeImpact;
  const allDetails = [
    ...category.negativeDetails,
    ...category.positiveDetails,
  ].sort((a, b) => {
    if (a.isPositive !== b.isPositive) return a.isPositive ? 1 : -1;
    return Math.abs(b.totalImpactAmount) - Math.abs(a.totalImpactAmount);
  });
  const showMobileInlineOffsetUI = isExpanded && totalNegativeImpact > 0.005;
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
  const handleOpenModalForChange = (e: React.MouseEvent) => {
    e.stopPropagation();
    const amount =
      inlineOffsetState?.donationAmount ?? category.totalNegativeImpact;
    onOpenModal(category.name, amount);
  };
  const handleOpenModalClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onOpenModal(category.name, negativeImpactForOffset);
  };
  const totalAbsoluteImpact = totalPositiveImpact + totalNegativeImpact;
  let positivePercent = 0;
  let negativePercent = 0;
  if (totalAbsoluteImpact > 0.005) {
    positivePercent = (totalPositiveImpact / totalAbsoluteImpact) * 100;
    negativePercent = (totalNegativeImpact / totalAbsoluteImpact) * 100;
  } else if (totalPositiveImpact > 0.005) positivePercent = 100;
  else if (totalNegativeImpact > 0.005) negativePercent = 100;
  return (
    <div className="card flex flex-col">
      {" "}
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
        {" "}
        <div className="flex justify-between items-center w-full">
          {" "}
          <div className="flex items-center flex-grow min-w-0">
            {" "}
            <span className="text-lg mr-2 sm:mr-3">{category.icon}</span>{" "}
            <span
              className="font-semibold text-gray-700 dark:text-gray-200 text-sm sm:text-base truncate mr-3"
              title={category.name}
            >
              {" "}
              {category.name}{" "}
            </span>{" "}
          </div>{" "}
          <div className="flex items-center flex-shrink-0 gap-2">
            {" "}
            <AnimatedCounter
              value={Math.abs(netImpact)}
              prefix={netImpact >= 0 ? "+$" : "-$"}
              className={`font-bold ${getNetImpactColor(
                netImpact
              )} text-sm sm:text-base w-20 text-right`}
              decimalPlaces={0}
              title={`Precise: ${netImpact >= 0 ? "+" : ""}${formatCurrency(
                netImpact
              )}`}
            />{" "}
            {negativeImpactForOffset > 0.005 && (
              <button
                onClick={handleOpenModalClick}
                className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs px-2 py-1 rounded-full transition-colors whitespace-nowrap z-10"
                title={`Offset ${
                  category.name
                } negative impact (${formatCurrency(negativeImpactForOffset)})`}
              >
                {" "}
                Offset{" "}
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
          </div>{" "}
        </div>{" "}
        {(totalPositiveImpact > 0.005 || totalNegativeImpact > 0.005) && (
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
        )}{" "}
      </div>{" "}
      <div
        className={`flex-grow overflow-y-auto max-h-96 scrollable-content ${
          isExpanded ? "block" : "hidden"
        }`}
      >
        {" "}
        <div className="p-3 space-y-2 border-t border-slate-200 dark:border-slate-700">
          {" "}
          {allDetails.length === 0 && isExpanded && (
            <p className="text-xs text-center text-[var(--card-foreground)] opacity-70 py-4">
              {" "}
              No specific impact details.{" "}
            </p>
          )}{" "}
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
          })}{" "}
          {showMobileInlineOffsetUI && inlineOffsetState && (
            <div className="pt-3 border-t border-slate-200 dark:border-slate-700 mt-3 space-y-3">
              {" "}
              <p className="text-xs text-[var(--muted-foreground)] italic text-center">
                {" "}
                Offset negative impact:{" "}
              </p>{" "}
              {inlineOffsetState.recommendationStatus === "loading" && (
                <LoadingSpinner message="Finding best charity..." />
              )}{" "}
              {inlineOffsetState.recommendationStatus === "error" && (
                <p className="text-xs text-red-500 text-center">
                  {" "}
                  {inlineOffsetState.errorMessage || "Could not load."}{" "}
                </p>
              )}{" "}
              {inlineOffsetState.recommendationStatus === "loaded" &&
                !inlineOffsetState.recommendedCharity && (
                  <p className="text-xs text-gray-500 text-center">
                    {" "}
                    No specific charity found.{" "}
                  </p>
                )}{" "}
              {inlineOffsetState.recommendedCharity && (
                <div className="border rounded-md p-3 bg-white dark:bg-gray-700/[.5] space-y-2 border-slate-200 dark:border-slate-600">
                  {" "}
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
                        {" "}
                        {inlineOffsetState.recommendedCharity.name}{" "}
                      </p>{" "}
                      <CharityRating
                        charity={inlineOffsetState.recommendedCharity}
                      />{" "}
                    </div>{" "}
                  </div>{" "}
                  <button
                    onClick={handleOpenModalForChange}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {" "}
                    Change Charity{" "}
                  </button>{" "}
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-600">
                    {" "}
                    <div className="flex items-center justify-between space-x-2">
                      {" "}
                      <label
                        htmlFor={`donationAmount-${category.name}-mobile`}
                        className="sr-only"
                      >
                        {" "}
                        Amount:{" "}
                      </label>{" "}
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
                      </div>{" "}
                      <button
                        onClick={handleInlineWidgetTrigger}
                        className="flex-shrink-0 text-sm bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-md disabled:opacity-50"
                        disabled={inlineOffsetState.donationAmount < 1}
                      >
                        {" "}
                        Donate{" "}
                      </button>{" "}
                    </div>{" "}
                    {inlineOffsetState.errorMessage && (
                      <p className="text-xs text-red-500 mt-1">
                        {" "}
                        {inlineOffsetState.errorMessage}{" "}
                      </p>
                    )}{" "}
                  </div>{" "}
                </div>
              )}{" "}
              {(inlineOffsetState.recommendationStatus === "error" ||
                (inlineOffsetState.recommendationStatus === "loaded" &&
                  !inlineOffsetState.recommendedCharity)) && (
                <button
                  onClick={handleOpenModalClick}
                  className="w-full mt-1 text-sm bg-gray-500 hover:bg-gray-600 text-white px-3 py-1.5 rounded-md"
                >
                  {" "}
                  Offset (Choose Charity){" "}
                </button>
              )}{" "}
            </div>
          )}{" "}
        </div>{" "}
      </div>{" "}
    </div>
  );
};

// --- Main Balance Sheet Component ---
export function BalanceSheetView({ transactions }: BalanceSheetViewProps) {
  const impactAnalysis = useTransactionStore((state) => state.impactAnalysis);
  const userValueSettings = useTransactionStore(
    (state) => state.userValueSettings
  );
  // <<< FIX: Get function from the store hook >>>
  const getUserValueMultiplier = useTransactionStore(
    (state) => state.getUserValueMultiplier
  );

  const { modalState, openDonationModal, closeDonationModal } =
    useDonationModal();
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [categoryInlineUIState, setCategoryInlineUIState] = useState<
    Record<string, CategoryInlineOffsetState>
  >({});

  const processedData = useMemo(() => {
    console.log("BalanceSheetView: Recalculating processedData memo...");
    // Calculate base category impacts (positive=1x, negative=value-adjusted)
    const categoryImpacts = calculationService.calculateCategoryImpacts(
      transactions ?? [],
      userValueSettings
    );

    // Initialize category map
    const categoryMap: Record<
      string,
      {
        name: string;
        icon: string;
        totalPositiveImpact: number;
        totalNegativeImpact: number;
        positiveDetails: CombinedImpactDetail[];
        negativeDetails: CombinedImpactDetail[];
      }
    > = {};
    Object.keys(categoryImpacts).forEach((catName) => {
      const icon =
        valueEmojis[catName] || valueEmojis["Default Category"] || "❓";
      categoryMap[catName] = {
        name: catName,
        icon: icon,
        totalPositiveImpact: categoryImpacts[catName].positiveImpact,
        totalNegativeImpact: categoryImpacts[catName].negativeImpact,
        positiveDetails: [],
        negativeDetails: [],
      };
    });

    // Aggregate detailed impacts for display (Applying multipliers again for detail view consistency)
    // Note: This duplicates some calculation but ensures details reflect applied multipliers
    const aggregatedDetails: Record<
      string,
      Record<string, CombinedImpactDetail>
    > = {}; // category -> comboKey -> detail

    (transactions ?? []).forEach((tx) => {
      const processPracticesForDetail = (isPositive: boolean) => {
        const practices = isPositive
          ? tx.ethicalPractices || []
          : tx.unethicalPractices || [];
        practices.forEach((practice) => {
          const categoryName = tx.practiceCategories?.[practice];
          if (categoryName && categoryMap[categoryName]) {
            // Check if category is relevant
            const weight = tx.practiceWeights?.[practice] || 0;
            const baseImpactAmount = tx.amount * (weight / 100);
            let finalImpactAmount = baseImpactAmount;

            // <<< FIX: Apply multiplier for NEGATIVE practices using the store function >>>
            if (!isPositive) {
              const multiplier = getUserValueMultiplier(categoryName); // Get from store
              finalImpactAmount *= multiplier;
            }

            if (
              isNaN(finalImpactAmount) ||
              Math.abs(finalImpactAmount) <= 0.005
            )
              return;

            const vendorKey = tx.name || "Unknown Vendor";
            const comboKey = `${vendorKey}|${practice}|${categoryName}`; // Include category in key

            if (!aggregatedDetails[categoryName])
              aggregatedDetails[categoryName] = {};

            if (aggregatedDetails[categoryName][comboKey]) {
              // Aggregate onto existing detail
              aggregatedDetails[categoryName][comboKey].totalImpactAmount +=
                finalImpactAmount;
              aggregatedDetails[categoryName][comboKey].totalOriginalAmount +=
                tx.amount;
              aggregatedDetails[categoryName][
                comboKey
              ].contributingTxCount += 1;
              // Keep citation from first encountered, or merge if needed (complex)
              // Keep information from first encountered
            } else {
              // Create new detail entry
              aggregatedDetails[categoryName][comboKey] = {
                vendorName: vendorKey,
                practice,
                totalImpactAmount: finalImpactAmount,
                totalOriginalAmount: tx.amount,
                impactWeight: weight,
                information: tx.information?.[practice],
                citations: tx.citations?.[practice] ?? [],
                isPositive,
                contributingTxCount: 1,
              };
            }
          }
        });
      };
      processPracticesForDetail(true); // Process positive practices
      processPracticesForDetail(false); // Process negative practices
    });

    // Assign aggregated details to categoryMap and sort
    Object.keys(aggregatedDetails).forEach((catName) => {
      if (categoryMap[catName]) {
        Object.values(aggregatedDetails[catName]).forEach((detail) => {
          if (detail.isPositive)
            categoryMap[catName].positiveDetails.push(detail);
          else categoryMap[catName].negativeDetails.push(detail);
        });
        // Sort details within each category
        categoryMap[catName].positiveDetails.sort(
          (a, b) =>
            Math.abs(b.totalImpactAmount) - Math.abs(a.totalImpactAmount)
        );
        categoryMap[catName].negativeDetails.sort(
          (a, b) =>
            Math.abs(b.totalImpactAmount) - Math.abs(a.totalImpactAmount)
        );
      }
    });

    const finalCategories = Object.values(categoryMap).sort((a, b) => {
      const netA = a.totalPositiveImpact - a.totalNegativeImpact;
      const netB = b.totalPositiveImpact - b.totalNegativeImpact;
      if (Math.abs(netA - netB) > 0.005) return netA - netB;
      return b.totalNegativeImpact - a.totalNegativeImpact;
    });

    return {
      categories: finalCategories,
      overallPositive: impactAnalysis?.positiveImpact ?? 0,
      overallNegative: impactAnalysis?.negativeImpact ?? 0,
    };
    // <<< FIX: Added getUserValueMultiplier dependency >>>
  }, [transactions, impactAnalysis, userValueSettings, getUserValueMultiplier]);

  // ... (Rest of the component: other hooks, handlers, useEffect, render logic) ...
  const updateInlineOffsetState = useCallback(
    (categoryName: string, updates: Partial<CategoryInlineOffsetState>) => {
      setCategoryInlineUIState((prev) => ({
        ...prev,
        [categoryName]: {
          ...(prev[categoryName] || {
            recommendationStatus: "idle",
            recommendedCharity: null,
            donationAmount: 0,
            errorMessage: null,
          }),
          ...updates,
        },
      }));
    },
    []
  );
  const findDominantPracticeSearchTerm = useCallback(
    (categoryName: string) => {
      if (
        !transactions ||
        transactions.length === 0 ||
        categoryName === "All Societal Debt"
      )
        return categoryName === "All Societal Debt"
          ? "environment"
          : categoryName;
      const pc: Record<string, { c: number; t?: string }> = {};
      transactions.forEach((tx) => {
        (tx.unethicalPractices || []).forEach((p) => {
          if (tx.practiceCategories?.[p] === categoryName) {
            const w = tx.practiceWeights?.[p] || 0;
            const c = Math.abs(tx.amount) * (w / 100);
            const cur = pc[p] || { c: 0 };
            pc[p] = { c: cur.c + c, t: tx.practiceSearchTerms?.[p] || cur.t };
          }
        });
      });
      if (Object.keys(pc).length === 0) return categoryName;
      let dp: string | null = null;
      let mc = -1;
      let tdp: string | undefined = undefined;
      for (const [p, d] of Object.entries(pc)) {
        if (d.c > mc) {
          mc = d.c;
          dp = p;
          tdp = d.t;
        }
      }
      if (tdp) return tdp;
      else {
        const fm: Record<string, string> = {
          "Factory Farming": "animal welfare",
          "High Emissions": "climate",
          "Data Privacy Issues": "digital rights",
          "Water Waste": "water conservation",
          "Environmental Degradation": "conservation",
        };
        const ft = (dp && fm[dp]) || categoryName;
        return ft;
      }
    },
    [transactions]
  );
  const fetchRecommendation = useCallback(
    async (categoryName: string) => {
      if (categoryInlineUIState[categoryName]?.recommendationStatus !== "idle")
        return;
      updateInlineOffsetState(categoryName, {
        recommendationStatus: "loading",
        errorMessage: null,
      });
      try {
        const searchTerm = findDominantPracticeSearchTerm(categoryName);
        const results =
          await enhancedCharityService.getTopRatedCharitiesWithPaymentLinks(
            searchTerm,
            1
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
        });
      } catch (error) {
        console.error(
          `Error fetching recommendation for ${categoryName}:`,
          error
        );
        updateInlineOffsetState(categoryName, {
          recommendationStatus: "error",
          recommendedCharity: null,
          errorMessage: "Failed to load.",
        });
      }
    },
    [
      categoryInlineUIState,
      updateInlineOffsetState,
      findDominantPracticeSearchTerm,
      processedData.categories,
    ]
  );
  const triggerEveryOrgWidget = useCallback(
    (charity: EnrichedCharityResult, amount: number) => {
      const charityIdentifier = getWidgetIdentifier(charity);
      const categoryName =
        Object.keys(categoryInlineUIState).find(
          (cn) =>
            categoryInlineUIState[cn]?.recommendedCharity?.id === charity.id
        ) || "Unknown Category";
      if (!charityIdentifier) {
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
  useEffect(() => {
    processedData.categories.forEach((category) => {
      if (!categoryInlineUIState[category.name]) {
        updateInlineOffsetState(category.name, {
          recommendationStatus: "idle",
          recommendedCharity: null,
          donationAmount: Math.max(
            1,
            Math.round(category.totalNegativeImpact ?? 1)
          ),
          errorMessage: null,
        });
      } else {
        const currentAmountState =
          categoryInlineUIState[category.name]?.donationAmount;
        const newDefaultAmount = Math.max(
          1,
          Math.round(category.totalNegativeImpact ?? 1)
        );
        if (Math.abs(currentAmountState - newDefaultAmount) > 0.5) {
          updateInlineOffsetState(category.name, {
            donationAmount: newDefaultAmount,
          });
        }
      }
    });
  }, [
    processedData.categories,
    categoryInlineUIState,
    updateInlineOffsetState,
  ]);
  const toggleCategory = (categoryName: string) => {
    setExpandedCategory((prev) =>
      prev === categoryName ? null : categoryName
    );
  };
  if (!impactAnalysis && (!transactions || transactions.length === 0)) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner message="Loading balance sheet..." />
      </div>
    );
  }
  if (!transactions || transactions.length === 0) {
    return (
      <div className="card p-6 text-center">
        <p>No transaction data found.</p>
      </div>
    );
  }
  const fetchRecommendationCallback = fetchRecommendation;
  return (
    <div className="p-4 md:p-6 space-y-6">
      {" "}
      <div className="lg:hidden space-y-4">
        {" "}
        {processedData.categories.length === 0 && (
          <div className="card p-6 text-center">
            <p>No category impacts identified.</p>
          </div>
        )}{" "}
        {processedData.categories.map((category) => (
          <UnifiedCategoryCard
            key={`unified-mobile-${category.name}`}
            category={category}
            isExpanded={expandedCategory === category.name}
            onToggleExpand={toggleCategory}
            onOpenModal={openDonationModal}
            inlineOffsetState={categoryInlineUIState[category.name]}
            fetchRecommendation={fetchRecommendationCallback}
            updateInlineOffsetState={updateInlineOffsetState}
            triggerWidget={triggerEveryOrgWidget}
          />
        ))}{" "}
      </div>{" "}
      <div className="hidden lg:block space-y-4">
        {" "}
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
        </div>{" "}
        {processedData.categories.length === 0 && (
          <div className="card p-6 text-center col-span-2">
            <p>No category impacts identified.</p>
          </div>
        )}{" "}
        {processedData.categories.map((category) => (
          <div
            key={`cat-row-desktop-${category.name}`}
            className="grid grid-cols-2 gap-x-6 items-start"
          >
            {" "}
            <div>
              {" "}
              <CategoryCard
                category={category}
                isPositive={false}
                isExpanded={expandedCategory === category.name}
                onToggleExpand={toggleCategory}
                onOpenModal={openDonationModal}
                inlineOffsetState={categoryInlineUIState[category.name]}
                fetchRecommendation={fetchRecommendationCallback}
                updateInlineOffsetState={updateInlineOffsetState}
                triggerWidget={triggerEveryOrgWidget}
              />{" "}
            </div>{" "}
            <div>
              {" "}
              <CategoryCard
                category={category}
                isPositive={true}
                isExpanded={expandedCategory === category.name}
                onToggleExpand={toggleCategory}
                onOpenModal={openDonationModal}
                inlineOffsetState={categoryInlineUIState[category.name]}
                fetchRecommendation={fetchRecommendationCallback}
                updateInlineOffsetState={updateInlineOffsetState}
                triggerWidget={triggerEveryOrgWidget}
              />{" "}
            </div>{" "}
          </div>
        ))}{" "}
      </div>{" "}
      {modalState.isOpen && (
        <DonationModal
          isOpen={modalState.isOpen}
          practice={modalState.practice || ""}
          amount={modalState.amount || 0}
          onClose={closeDonationModal}
        />
      )}{" "}
    </div>
  );
}

