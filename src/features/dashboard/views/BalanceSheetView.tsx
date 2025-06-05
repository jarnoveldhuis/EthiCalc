// src/features/dashboard/views/BalanceSheetView.jsx
"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useTransactionStore } from "@/store/transactionStore";
import { calculationService } from "@/core/calculations/impactService";
import { Transaction, Citation } from "@/shared/types/transactions"; // Citation needs to be imported if used in DetailItem
import { ImpactAnalysis } from "@/core/calculations/type"; // Import ImpactAnalysis
import { EnrichedCharityResult } from "@/features/charity/types";
import { LoadingSpinner } from "@/shared/ui/LoadingSpinner";
import { enhancedCharityService } from "@/features/charity/enhancedCharityService";
import { CharityImage } from "@/features/charity/CharityImage";
import { CharityRating } from "@/features/charity/CharityRating";
import { AnimatedCounter } from "@/shared/ui/AnimatedCounter";
import { DonationModal } from "@/features/charity/DonationModal";
import { useDonationModal } from "@/hooks/useDonationModal"; // Corrected path
import { valueEmojis } from "@/config/valueEmojis";
import { DesktopCategoryRow } from "./DesktopCategoryRow";


// --- Interface Definitions ---
export interface CombinedImpactDetail {
  vendorName: string;
  practice: string;
  totalImpactAmount: number;
  totalOriginalAmount: number;
  impactWeight: number;
  information?: string;
  citations?: Citation[]; // Ensure Citation is imported
  isPositive: boolean;
  contributingTxCount: number;
}
export interface ProcessedCategoryData {
  name: string;
  icon: string;
  totalPositiveImpact: number;
  totalNegativeImpact: number;
  positiveDetails: CombinedImpactDetail[];
  negativeDetails: CombinedImpactDetail[];
}
export interface CategoryInlineOffsetState {
  recommendationStatus: "idle" | "loading" | "loaded" | "error";
  recommendedCharity: EnrichedCharityResult | null;
  donationAmount: number;
  errorMessage: string | null;
}

// --- Helper Functions ---
const formatCurrency = (value: number | undefined | null): string => {
  const num = value ?? 0;
  return `$${num.toFixed(2)}`;
};
const getNetImpactColor = (netImpact: number): string => {
  if (netImpact > 0.005) return "text-[var(--success)] dark:text-emerald-400";
  if (netImpact < -0.005) return "text-[var(--destructive)] dark:text-rose-400";
  return "text-gray-500 dark:text-gray-400";
};
const getWidgetIdentifier = (char: EnrichedCharityResult | null): string | null => {
  if (!char) return null;
  if (char.slug) return char.slug;
  if (char.id?.startsWith("ein:")) {
    const ein = char.id.split(":")[1];
    if (/^\d{9}$/.test(ein)) return ein; // Ensure it's a 9-digit EIN
  }
  if (char.id && !char.id.startsWith("ein:")) return char.id;
  return char.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
};

// --- DetailItem Component ---
export const DetailItem: React.FC<{detail: CombinedImpactDetail, amountColor: string}> = ({ detail, amountColor }) => {
  const [citationsVisible, setCitationsVisible] = useState(false);
  const citations = detail.citations;
  const hasCitations = Array.isArray(citations) && citations.length > 0;
  const preciseFormatImpact = (amount: number, isPositive: boolean) => {
    const sign = isPositive ? "+" : "-";
    return `${sign}$${Math.abs(amount ?? 0).toFixed(2)}`;
  };
  return (
    <div className="border-b border-slate-200 dark:border-slate-700 pb-2 last:border-b-0 last:pb-0 mb-2 last:mb-0">
      <div className="flex justify-between items-start mb-1 gap-2">
        <div className="flex-grow min-w-0">
          <span className="block font-medium text-[var(--card-foreground)] text-sm truncate" title={detail.vendorName}>
            {detail.vendorName}
          </span>
          <span className="block text-xs text-blue-600 dark:text-blue-400 truncate" title={detail.practice}>
            {detail.practice} ({detail.impactWeight}%)
          </span>
          {detail.contributingTxCount > 1 && (
            <span className="block text-xxs text-[var(--muted-foreground)]">
              ({detail.contributingTxCount} transactions)
            </span>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <AnimatedCounter
            value={Math.abs(detail.totalImpactAmount)}
            prefix={detail.isPositive ? "+$" : "-$"}
            className={`block font-medium ${amountColor} text-sm`}
            decimalPlaces={0}
            title={`Precise: ${preciseFormatImpact(detail.totalImpactAmount, detail.isPositive)}`}
          />
          <span className="block text-xs text-[var(--muted-foreground)]">
            (Orig: ${(detail.totalOriginalAmount ?? 0).toFixed(2)})
          </span>
        </div>
      </div>
      {detail.information && (
        <p className="mt-1 pl-2 border-l-2 border-gray-300 dark:border-gray-600 text-xs text-[var(--card-foreground)] opacity-80 italic">
          <span aria-hidden="true">ℹ️ </span>
          {detail.information}
          {hasCitations && !citationsVisible && (
            <button onClick={(e) => { e.stopPropagation(); setCitationsVisible(true); }} className="ml-2 text-blue-500 hover:underline text-[10px] font-medium">
              [Show Sources]
            </button>
          )}
          {hasCitations && citationsVisible && (
            <button onClick={(e) => { e.stopPropagation(); setCitationsVisible(false); }} className="ml-2 text-blue-500 hover:underline text-[10px] font-medium">
              [Hide Sources]
            </button>
          )}
        </p>
      )}
      {hasCitations && citationsVisible && (
        <ul className="mt-1 ml-6 list-disc text-xs space-y-0.5">
          {citations.map((citation: Citation, urlIndex: number) =>
              citation?.url && (
                <li key={urlIndex}>
                  <a href={citation.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline break-all" onClick={(e) => e.stopPropagation()} title={citation.url}>
                    {citation.title || `Source ${urlIndex + 1}`}
                  </a>
                </li>
              )
          )}
        </ul>
      )}
    </div>
  );
};


// --- Main Balance Sheet Component ---
export function BalanceSheetView({ transactions }: { transactions: Transaction[] }) {
  const impactAnalysis: ImpactAnalysis | null = useTransactionStore((state) => state.impactAnalysis); // Ensure type
  const userValueSettings = useTransactionStore((state) => state.userValueSettings);
  const getUserValueMultiplier = useTransactionStore((state) => state.getUserValueMultiplier);

  const { modalState, openDonationModal, closeDonationModal } = useDonationModal();
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [categoryInlineUIState, setCategoryInlineUIState] = useState<Record<string, CategoryInlineOffsetState>>({});

  const processedData = useMemo(() => {
    const categoryImpacts = calculationService.calculateCategoryImpacts(transactions ?? [], userValueSettings);
    const categoryMap: Record<string, ProcessedCategoryData> = {};

    Object.keys(categoryImpacts).forEach((catName) => {
      const icon = valueEmojis[catName] || valueEmojis["Default Category"] || "❓";
      categoryMap[catName] = {
        name: catName, icon: icon,
        totalPositiveImpact: categoryImpacts[catName].positiveImpact,
        totalNegativeImpact: categoryImpacts[catName].negativeImpact,
        positiveDetails: [], negativeDetails: [],
      };
    });

    const aggregatedDetails: Record<string, Record<string, CombinedImpactDetail>> = {};

    (transactions ?? []).forEach((tx) => {
      const processPracticesForDetail = (isPositivePractice: boolean) => {
        const practices = isPositivePractice ? tx.ethicalPractices || [] : tx.unethicalPractices || [];
        practices.forEach((practice) => {
          const categoryName = tx.practiceCategories?.[practice];
          if (categoryName && categoryMap[categoryName]) {
            const weight = tx.practiceWeights?.[practice] || 0;
            const baseImpactAmount = tx.amount * (weight / 100);
            let finalImpactAmount = baseImpactAmount;
            if (!isPositivePractice) {
              const multiplier = getUserValueMultiplier(categoryName);
              finalImpactAmount *= multiplier;
            }
            if (isNaN(finalImpactAmount) || Math.abs(finalImpactAmount) <= 0.005) return;
            const vendorKey = tx.name || "Unknown Vendor";
            const comboKey = `${vendorKey}|${practice}`;
            if (!aggregatedDetails[categoryName]) aggregatedDetails[categoryName] = {};
            if (aggregatedDetails[categoryName][comboKey]) {
              aggregatedDetails[categoryName][comboKey].totalImpactAmount += finalImpactAmount;
              aggregatedDetails[categoryName][comboKey].totalOriginalAmount += tx.amount;
              aggregatedDetails[categoryName][comboKey].contributingTxCount += 1;
            } else {
              aggregatedDetails[categoryName][comboKey] = {
                vendorName: vendorKey, practice, totalImpactAmount: finalImpactAmount,
                totalOriginalAmount: tx.amount, impactWeight: weight,
                information: tx.information?.[practice],
                citations: tx.citations?.[practice] ?? [],
                isPositive: isPositivePractice, contributingTxCount: 1,
              };
            }
          }
        });
      };
      processPracticesForDetail(true);
      processPracticesForDetail(false);
    });

    Object.keys(aggregatedDetails).forEach((catName) => {
      if (categoryMap[catName]) {
        Object.values(aggregatedDetails[catName]).forEach((detail) => {
          if (detail.isPositive) categoryMap[catName].positiveDetails.push(detail);
          else categoryMap[catName].negativeDetails.push(detail);
        });
        categoryMap[catName].positiveDetails.sort((a, b) => Math.abs(b.totalImpactAmount) - Math.abs(a.totalImpactAmount));
        categoryMap[catName].negativeDetails.sort((a, b) => Math.abs(b.totalImpactAmount) - Math.abs(a.totalImpactAmount));
      }
    });

     const finalCategories = Object.values(categoryMap).sort((a, b) => {
        const netA = a.totalPositiveImpact - a.totalNegativeImpact;
        const netB = b.totalPositiveImpact - b.totalNegativeImpact;
        if (netA < 0 && netB >= 0) return -1; 
        if (netA >= 0 && netB < 0) return 1;  
        if (netA < 0 && netB < 0) return netA - netB; // Sort by most negative first
        if (netB !== netA) return netB - netA; // Then sort by highest positive net
        return b.totalNegativeImpact - a.totalNegativeImpact; // Tie-breaker
    });
    
    return {
      categories: finalCategories,
      overallPositive: impactAnalysis?.positiveImpact ?? 0,
      overallNegative: impactAnalysis?.negativeImpact ?? 0,
    };
  }, [transactions, impactAnalysis, userValueSettings, getUserValueMultiplier]);

  const updateInlineOffsetState = useCallback((categoryName: string, updates: Partial<CategoryInlineOffsetState>) => {
    setCategoryInlineUIState((prev) => ({ ...prev, [categoryName]: { ...(prev[categoryName] || { recommendationStatus: "idle", recommendedCharity: null, donationAmount: 0, errorMessage: null }), ...updates }}));
  }, []);

  const findDominantPracticeSearchTerm = useCallback((categoryName: string): string => {
    if (!transactions || transactions.length === 0 || categoryName === "All Societal Debt") return categoryName === "All Societal Debt" ? "environment" : categoryName;
    const practiceContributions: Record<string, { amount: number; term?: string }> = {};
    transactions.forEach((tx) => {
        (tx.unethicalPractices || []).forEach((practice) => {
        if (tx.practiceCategories?.[practice] === categoryName) {
            const weight = tx.practiceWeights?.[practice] || 0;
            const contribution = Math.abs(tx.amount) * (weight / 100);
            const currentTotal = practiceContributions[practice]?.amount || 0;
            practiceContributions[practice] = { amount: currentTotal + contribution, term: tx.practiceSearchTerms?.[practice] || practiceContributions[practice]?.term };
        }
        });
    });
    if (Object.keys(practiceContributions).length === 0) return categoryName; // Default to category name if no specific practice found
    let dominantPractice: string | null = null;
    let maxContribution = -1;
    let termForDominantPractice: string | undefined = undefined;
    for (const [practice, data] of Object.entries(practiceContributions)) {
        if (data.amount > maxContribution) { maxContribution = data.amount; dominantPractice = practice; termForDominantPractice = data.term; }
    }
    if (termForDominantPractice) return termForDominantPractice;
    const fallbackMappings: Record<string, string> = { "Factory Farming": "animal welfare", "High Emissions": "climate", "Data Privacy Issues": "digital rights", "Water Waste": "water conservation", "Environmental Degradation": "conservation", "Labor Exploitation": "labor rights" };
    return (dominantPractice && fallbackMappings[dominantPractice]) || categoryName;
  }, [transactions]);
  
  const fetchRecommendation = useCallback(async (categoryName: string) => {
    if (categoryInlineUIState[categoryName]?.recommendationStatus !== "idle") return;
    updateInlineOffsetState(categoryName, { recommendationStatus: "loading", errorMessage: null });
    try {
      const searchTerm = findDominantPracticeSearchTerm(categoryName);
      const results = await enhancedCharityService.getTopRatedCharitiesWithPaymentLinks(searchTerm, 1);
      const recommendation = results.length > 0 ? results[0] : null;
      const categoryData = processedData.categories.find((c) => c.name === categoryName);



      const netDebt = Math.max(0, (categoryData?.totalNegativeImpact ?? 0) - (categoryData?.totalPositiveImpact ?? 0));
      const defaultAmount = Math.max(1, Math.round(netDebt));

      
      updateInlineOffsetState(categoryName, { 
        recommendationStatus: "loaded", 
        recommendedCharity: recommendation, 
        donationAmount: defaultAmount 
    });
    } catch (error) {
      console.error(`Error fetching recommendation for ${categoryName}:`, error);
      updateInlineOffsetState(categoryName, { recommendationStatus: "error", recommendedCharity: null, errorMessage: "Failed to load charity suggestion." });
    }
  }, [categoryInlineUIState, updateInlineOffsetState, findDominantPracticeSearchTerm, processedData.categories]);

  const triggerEveryOrgWidget = useCallback((charity: EnrichedCharityResult, amount: number) => {
    const charityIdentifier = getWidgetIdentifier(charity);
    const categoryName = Object.keys(categoryInlineUIState).find(cn => categoryInlineUIState[cn]?.recommendedCharity?.id === charity.id || categoryInlineUIState[cn]?.recommendedCharity?.name === charity.name) || "Unknown Category";
    if (!charityIdentifier) { updateInlineOffsetState(categoryName, { errorMessage: "Could not identify charity for donation widget." }); return; }
    const finalAmount = Math.max(1, Math.round(amount));
    if (window.everyDotOrgDonateButton) {
      try {
        const optionsToSet = { nonprofitSlug: charityIdentifier, amount: finalAmount, noExit: false, primaryColor: "#3b82f6" };
        window.everyDotOrgDonateButton.setOptions(optionsToSet);
        window.everyDotOrgDonateButton.showWidget();
      } catch (widgetError) {
        console.error("Error configuring/showing Every.org widget:", widgetError);
        updateInlineOffsetState(categoryName, { errorMessage: "Could not initialize donation widget." });
      }
    } else {
      console.error("Every.org widget script not loaded.");
      updateInlineOffsetState(categoryName, { errorMessage: "Donation service is unavailable." });
    }
  }, [updateInlineOffsetState, categoryInlineUIState]);

  useEffect(() => { 
    processedData.categories.forEach((category) => {
      if (!categoryInlineUIState[category.name]) {
        updateInlineOffsetState(category.name, { recommendationStatus: "idle", recommendedCharity: null, donationAmount: Math.max(1, Math.round(Math.abs(category.totalNegativeImpact ?? 1))), errorMessage: null });
      } else {
        const currentAmountState = categoryInlineUIState[category.name]?.donationAmount;
        const newDefaultAmount = Math.max(1, Math.round(Math.abs(category.totalNegativeImpact ?? 1)));
        if (currentAmountState === undefined || Math.abs(currentAmountState - newDefaultAmount) > 0.5) {
           if (categoryInlineUIState[category.name]?.recommendationStatus !== 'loading') { updateInlineOffsetState(category.name, { donationAmount: newDefaultAmount }); }
        }
      }
    });
  }, [processedData.categories, categoryInlineUIState, updateInlineOffsetState]);

  const toggleCategory = (categoryName: string) => { 
    setExpandedCategory((prev) => (prev === categoryName ? null : categoryName));
  };

  if (!impactAnalysis && (!transactions || transactions.length === 0)) {
    return (<div className="flex items-center justify-center h-64"> <LoadingSpinner message="Loading balance sheet..." /> </div>);
  }
  if (!transactions || transactions.length === 0) {
    return (<div className="card p-6 text-center"> <p>No transaction data found.</p> </div>);
  }
  
  const fetchRecommendationCallback = fetchRecommendation;

  const UnifiedCategoryCard: React.FC<{
      category: ProcessedCategoryData; isExpanded: boolean;
      onToggleExpand: (categoryName: string) => void;
      onOpenModal: (categoryName: string, amount: number, searchTerm?: string) => void; // Add searchTerm
      inlineOffsetState?: CategoryInlineOffsetState;
      fetchRecommendation: (categoryName: string) => Promise<void>;
      updateInlineOffsetState: (categoryName: string, updates: Partial<CategoryInlineOffsetState>) => void;
      triggerWidget: (charity: EnrichedCharityResult, amount: number) => void;
    }> = ({ category, isExpanded, onToggleExpand, onOpenModal, inlineOffsetState, fetchRecommendation, updateInlineOffsetState, triggerWidget }) => {
        const { totalPositiveImpact, totalNegativeImpact, name: categoryName, icon } = category;
        const netImpact = totalPositiveImpact - totalNegativeImpact;
        const negativeImpactForOffset = totalNegativeImpact;
        const showMobileInlineOffsetUI = isExpanded && negativeImpactForOffset > 0.005;

        useEffect(() => {
            if (isExpanded && showMobileInlineOffsetUI && inlineOffsetState?.recommendationStatus === "idle") { fetchRecommendation(categoryName); }
        }, [isExpanded, showMobileInlineOffsetUI, categoryName, fetchRecommendation, inlineOffsetState?.recommendationStatus]);

        const handleOpenModalClick = (e: React.MouseEvent) => { e.stopPropagation(); onOpenModal(categoryName, negativeImpactForOffset, categoryName); }; // Pass categoryName as searchTerm
        const handleInlineWidgetTrigger = (e: React.MouseEvent) => { e.stopPropagation(); const charity = inlineOffsetState?.recommendedCharity; const amount = inlineOffsetState?.donationAmount ?? negativeImpactForOffset; if (charity && amount >= 1) triggerWidget(charity, amount); else updateInlineOffsetState(categoryName, { errorMessage: "Please select a charity and enter amount >= $1."}); };
        const handleInlineAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => { const newAmount = Math.max(1, Number(e.target.value)); updateInlineOffsetState(categoryName, { donationAmount: newAmount }); };
        const handleOpenModalForChangeCharity = (e: React.MouseEvent) => { e.stopPropagation(); const amount = inlineOffsetState?.donationAmount ?? negativeImpactForOffset; onOpenModal(categoryName, amount, categoryName); }; // Pass categoryName as searchTerm

        return (
            <div className="card flex flex-col">
              <div role="button" tabIndex={0} className="w-full bg-gray-50 dark:bg-gray-700/[.5] p-3 flex flex-col text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors rounded-t-lg cursor-pointer" onClick={() => onToggleExpand(categoryName)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onToggleExpand(categoryName); }} aria-expanded={isExpanded}>
                  <div className="flex justify-between items-center w-full">
                      <div className="flex items-center flex-grow min-w-0">
                          <span className="text-lg mr-2 sm:mr-3">{icon}</span>
                          <span className="font-semibold text-gray-700 dark:text-gray-200 text-sm sm:text-base truncate mr-3" title={categoryName}>{categoryName}</span>
                      </div>
                      <div className="flex items-center flex-shrink-0 gap-2">
                          <AnimatedCounter value={Math.abs(netImpact)} prefix={netImpact >= 0.005 ? "+$" : (netImpact <= -0.005 ? "-$" : "$")} className={`font-bold ${getNetImpactColor(netImpact)} text-sm sm:text-base w-20 text-right`} decimalPlaces={0} title={`Precise: ${netImpact >= 0 ? "+" : ""}${formatCurrency(netImpact)}`} />
                          {negativeImpactForOffset > 0.005 && (<button onClick={handleOpenModalClick} className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs px-2 py-1 rounded-full transition-colors whitespace-nowrap z-10" title={`Offset ${categoryName} negative impact (${formatCurrency(negativeImpactForOffset)})`}>Offset</button>)}
                          <svg className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                      </div>
                  </div>
              </div>
              <div className={`flex-grow overflow-y-auto max-h-96 scrollable-content ${isExpanded ? "block" : "hidden"}`}>
                  <div className="p-3 space-y-2 border-t border-slate-200 dark:border-slate-700">
                      {category.negativeDetails.concat(category.positiveDetails).length === 0 && isExpanded && (<p className="text-xs text-center text-[var(--card-foreground)] opacity-70 py-4">No specific impact details.</p>)}
                      {category.negativeDetails.map((detail, index) => (<div key={`mob-neg-detail-${index}`} className="bg-rose-50/[.6] dark:bg-rose-900/[.3] p-2 rounded"><DetailItem detail={detail} amountColor="text-[var(--destructive)] dark:text-rose-400" /></div>))}
                      {category.positiveDetails.map((detail, index) => (<div key={`mob-pos-detail-${index}`} className="bg-emerald-50/[.6] dark:bg-emerald-900/[.3] p-2 rounded"><DetailItem detail={detail} amountColor="text-[var(--success)] dark:text-emerald-400" /></div>))}
                      {showMobileInlineOffsetUI && inlineOffsetState && (
                          <div className="pt-3 border-t border-slate-200 dark:border-slate-700 mt-3 space-y-3">
                              <p className="text-xs text-[var(--muted-foreground)] italic text-center">Offset {formatCurrency(negativeImpactForOffset)} from {categoryName}:</p>
                              {inlineOffsetState.recommendationStatus === "loading" && <LoadingSpinner message="Finding best charity..." />}
                              {inlineOffsetState.recommendationStatus === "error" && <p className="text-xs text-red-500 text-center">{inlineOffsetState.errorMessage || "Could not load."}</p>}
                              {inlineOffsetState.recommendationStatus === "loaded" && !inlineOffsetState.recommendedCharity && <p className="text-xs text-gray-500 text-center">No specific charity found.</p>}
                              {inlineOffsetState.recommendedCharity && (
                                  <div className="border rounded-md p-3 bg-white dark:bg-gray-700/[.5] space-y-2 border-slate-200 dark:border-slate-600">
                                      <div className="flex items-start space-x-3">
                                          <CharityImage src={inlineOffsetState.recommendedCharity.logoUrl} alt={inlineOffsetState.recommendedCharity.name} width={40} height={40}/>
                                          <div className="flex-grow min-w-0"><p className="text-sm font-medium text-[var(--card-foreground)] truncate">{inlineOffsetState.recommendedCharity.name}</p><CharityRating charity={inlineOffsetState.recommendedCharity}/></div>
                                      </div>
                                      <button onClick={handleOpenModalForChangeCharity} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">Change Charity</button>
                                      <div className="pt-2 border-t border-slate-200 dark:border-slate-600">
                                          <div className="flex items-center justify-between space-x-2">
                                              <label htmlFor={`donationAmount-${categoryName}-mobile`} className="sr-only">Amount:</label>
                                              <div className="flex items-center flex-grow"><span className="text-gray-500 dark:text-gray-400 mr-1">$</span><input id={`donationAmount-${categoryName}-mobile`} type="number" min="1" value={inlineOffsetState.donationAmount} onChange={handleInlineAmountChange} className="w-full p-1 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" aria-label="Donation Amount" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}/></div>
                                              <button onClick={handleInlineWidgetTrigger} className="flex-shrink-0 text-sm bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-md disabled:opacity-50" disabled={!inlineOffsetState.recommendedCharity || (inlineOffsetState.donationAmount ?? 0) < 1} title={`Donate to ${inlineOffsetState.recommendedCharity?.name}`}>Donate</button>
                                          </div>
                                          {inlineOffsetState.errorMessage && <p className="text-xs text-red-500 mt-1">{inlineOffsetState.errorMessage}</p>}
                                      </div>
                                  </div>
                              )}
                              {(inlineOffsetState.recommendationStatus === "error" || (inlineOffsetState.recommendationStatus === "loaded" && !inlineOffsetState.recommendedCharity)) && <button onClick={handleOpenModalClick} className="w-full mt-1 text-sm bg-gray-500 hover:bg-gray-600 text-white px-3 py-1.5 rounded-md">Offset (Choose Charity)</button>}
                          </div>
                      )}
                  </div>
              </div>
            </div>
        );
    };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Mobile View (Unified Cards) */}
      <div className="lg:hidden space-y-4">
        {processedData.categories.length === 0 && (
          <div className="card p-6 text-center"> <p>No category impacts identified.</p> </div>
        )}
        {processedData.categories.map((category) => (
          <UnifiedCategoryCard
            key={`unified-mobile-${category.name}`}
            category={category}
            isExpanded={expandedCategory === category.name}
            onToggleExpand={toggleCategory}
            onOpenModal={openDonationModal} // This is useDonationModal's openDonationModal
            inlineOffsetState={categoryInlineUIState[category.name]}
            fetchRecommendation={fetchRecommendationCallback}
            updateInlineOffsetState={updateInlineOffsetState}
            triggerWidget={triggerEveryOrgWidget}
          />
        ))}
      </div>

      {/* Desktop View (NEW STRUCTURE USING DesktopCategoryRow) */}
      <div className="hidden lg:block space-y-0">
        {/* UPDATED HEADER ORDER */}
        <div className="grid grid-cols-2 gap-x-6 pb-2 mb-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-xl font-semibold text-center text-[var(--card-foreground)] opacity-80">
            Positive Impact
             <span className="text-lg text-[var(--success)] dark:text-emerald-400">
              {" "}(Total: <AnimatedCounter
                value={processedData.overallPositive}
                prefix="$"
                decimalPlaces={0}
                title={`Precise Total Positive: ${formatCurrency(processedData.overallPositive)}`}
              />)
            </span>
          </h3>
          <h3 className="text-xl font-semibold text-center text-[var(--card-foreground)] opacity-80">
            Negative Impact
            <span className="text-lg text-[var(--destructive)] dark:text-rose-400">
              {" "}(Total: -<AnimatedCounter
                value={processedData.overallNegative}
                prefix="$"
                decimalPlaces={0}
                title={`Precise Total Negative: ${formatCurrency(processedData.overallNegative)}`}
              />)
            </span>
          </h3>
        </div>
        {processedData.categories.length === 0 && (
          <div className="card p-6 text-center col-span-2"> <p>No category impacts identified.</p> </div>
        )}
        {processedData.categories.map((category) => (
          <DesktopCategoryRow
            key={`desktop-row-${category.name}`}
            category={category}
            isExpanded={expandedCategory === category.name}
            onToggleExpand={toggleCategory}
            onOpenModal={openDonationModal} // This is useDonationModal's openDonationModal
            inlineOffsetState={categoryInlineUIState[category.name]}
            fetchRecommendation={fetchRecommendationCallback}
            updateInlineOffsetState={updateInlineOffsetState}
            triggerWidget={triggerEveryOrgWidget}
          />
        ))}
      </div>

      {/* Donation Modal */}
      {modalState.isOpen && (
        <DonationModal
          isOpen={modalState.isOpen}
          practice={modalState.practice || ""} // from useDonationModal
          amount={modalState.amount || 0}     // from useDonationModal
          onClose={closeDonationModal}
        />
      )}
    </div>
  );
}