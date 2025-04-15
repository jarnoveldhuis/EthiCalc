// src/features/dashboard/DashboardSidebar.tsx
import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useTransactionStore } from "@/store/transactionStore";
import { AnimatedCounter } from "@/shared/ui/AnimatedCounter";
import { useCountUp } from '@/hooks/useCountUp';
import { DonationModal } from "@/features/charity/DonationModal";
import { useDonationModal } from "@/hooks/useDonationModal";
import { useAuth } from "@/hooks/useAuth";
import { calculationService } from "@/core/calculations/impactService";
import { ShareImpactButton } from './ShareImpactButton';

// --- Category Icons ---
const categoryIcons: Record<string, string> = {
    Environment: "🌱",
    "Labor Ethics": "⚖️",
    "Animal Welfare": "🐮",
    "Political Ethics": "🗳️",
    Transparency: "🔍",
    "Default Category": "❓"
};

// --- Helper: Tier Calculation ---
const getTierInfo = (
    scoreRatio: number | null,
    totalPositiveImpact: number,
    totalNegativeImpact: number
): { name: string; description: string; colorClass: string; displayRatio?: number } => {
    if (totalNegativeImpact <= 0) {
        if (totalPositiveImpact > 0) return { name: "S", description: "Beacon of Virtue", colorClass: "text-white", displayRatio: undefined };
        return { name: "", description: "", colorClass: "text-white", displayRatio: undefined };
    }
    const ratio = scoreRatio ?? 0;
    const textColor = "text-white";
    if (ratio >= 1.0) return { name: "S", description: "Beacon of Virtue", displayRatio: ratio, colorClass: textColor };
    if (ratio >= 0.75) return { name: "A", description: "Conscious Contributor", displayRatio: ratio, colorClass: textColor };
    if (ratio >= 0.50) return { name: "B", description: "Neutral Navigator", displayRatio: ratio, colorClass: textColor };
    if (ratio >= 0.35) return { name: "C", description: "Passive Liability", displayRatio: ratio, colorClass: textColor };
    if (ratio >= 0.20) return { name: "D", description: "Dead Weight", displayRatio: ratio, colorClass: textColor };
    return { name: "F", description: "Societal Parasite", displayRatio: ratio, colorClass: textColor };
};

// Gets text and bar color based on the net score
const getScoreColorClasses = (score: number): { textColor: string; bgColor: string } => {
    const positiveThreshold = 1;
    const negativeThreshold = -1;
    if (score > positiveThreshold) return { textColor: "text-[var(--success)]", bgColor: "bg-[var(--success)]" };
    if (score < negativeThreshold) return { textColor: "text-[var(--destructive)]", bgColor: "bg-[var(--destructive)]" };
    return { textColor: "text-[var(--muted-foreground)]", bgColor: "bg-gray-400 dark:bg-gray-500" };
};

// Formats currency
const formatCurrency = (value: number | null | undefined): string => `$${(value ?? 0).toFixed(2)}`;


export function DashboardSidebar() {
  const { user } = useAuth();

  // --- State Selection ---
  const transactions = useTransactionStore((state) => state.transactions);
  const impactAnalysis = useTransactionStore((state) => state.impactAnalysis);
  const applyCredit = useTransactionStore((state) => state.applyCredit);
  const isApplyingCredit = useTransactionStore((state) => state.isApplyingCredit);

  const { modalState, openDonationModal, closeDonationModal } = useDonationModal();

  // --- Local State ---
  const [isOverallAnimationReady, setIsOverallAnimationReady] = useState(false);
  const [currentAppliedPercentage, setCurrentAppliedPercentage] = useState(0);
  const overallAnimationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [currentCategoryWidths, setCurrentCategoryWidths] = useState<Record<string, number>>({});
  const categoryAnimationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [showFeedback, setShowFeedback] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string>("");

  // --- Calculations ---
  const applied = impactAnalysis?.appliedCredit ?? 0;
  const effective = impactAnalysis?.effectiveDebt ?? 0;
  const available = impactAnalysis?.availableCredit ?? 0;
  const totalPositiveImpact = impactAnalysis?.positiveImpact ?? 0;
  const totalNegativeImpact = impactAnalysis?.negativeImpact ?? 0;

  // Calculate TARGET Score Ratio
  const targetScoreRatio = useMemo(() => {
      if (!impactAnalysis || totalNegativeImpact <= 0) return null;
      return applied / totalNegativeImpact;
  }, [impactAnalysis, applied, totalNegativeImpact]);

  // Animate the Score Ratio
  const animatedRatioPercentString = useCountUp(
      targetScoreRatio !== null ? Math.max(0, targetScoreRatio * 100) : 0,
      { duration: 2000, decimalPlaces: 1, easing: 'easeOut' }
  );

  // Dynamic Tier Calculation based on ANIMATED value
  const currentTierInfo = useMemo(() => {
      const currentAnimatedRatioValue = parseFloat(animatedRatioPercentString) / 100;
      const ratioForTierCalc = isNaN(currentAnimatedRatioValue) ? targetScoreRatio : currentAnimatedRatioValue;
      return getTierInfo(ratioForTierCalc, totalPositiveImpact, totalNegativeImpact);
  }, [animatedRatioPercentString, targetScoreRatio, totalPositiveImpact, totalNegativeImpact]);

  // Calculate category data for display and sharing
  const targetCategoryBarData = useMemo(() => {
      // --- Optional Debug Log 1 ---
      // console.log("Sidebar Transactions Input:", JSON.stringify(transactions.slice(0, 5), null, 2)); // Log first 5 transactions

      const totalSpendingWithAnyValue = transactions.reduce((sum, tx) => {
         const hasEthical = tx.ethicalPractices && tx.ethicalPractices.length > 0;
         const hasUnethical = tx.unethicalPractices && tx.unethicalPractices.length > 0;
         return sum + (hasEthical || hasUnethical ? (tx.amount || 0) : 0);
      }, 0);

      const catImpacts = calculationService.calculateCategoryImpacts(transactions);
      // --- Optional Debug Log 2 ---
      // console.log("Calculated Category Impacts:", catImpacts);

      const results: Record<string, { score: number; tooltip: string; targetWidthForState: number; }> = {};
      const definedCategories = ["Environment", "Labor Ethics", "Animal Welfare", "Political Ethics", "Transparency"];

      definedCategories.forEach(category => {
         const values = catImpacts[category] || { positiveImpact: 0, negativeImpact: 0, totalSpent: 0 };
         const { positiveImpact, negativeImpact } = values;
         const denominator = totalSpendingWithAnyValue;

         let posPercent = 0; let negPercent = 0;
         if (denominator > 0) {
             posPercent = (positiveImpact / denominator) * 100;
             negPercent = (negativeImpact / denominator) * 100;
         }
         const score = posPercent - negPercent;
         const targetWidthForState = Math.min(50, Math.abs(score) / 2 * (50/50));
         const tooltipText = `Net Score: ${score > 0 ? '+' : ''}${score.toFixed(1)}% (Pos Impact: ${formatCurrency(positiveImpact)}, Neg Impact: ${formatCurrency(negativeImpact)})`;

         // --- Optional Debug Log 3 ---
         // if (Math.abs(score) > 0.01) {
         //    console.log(`Category: ${category}, Score: ${score.toFixed(2)}, Denom: ${denominator}, Pos%: ${posPercent.toFixed(2)}, Neg%: ${negPercent.toFixed(2)}`);
         // }

         if (Math.abs(score) > 0.01) {
             results[category] = { score, tooltip: tooltipText, targetWidthForState };
         }
      });
      return results;
   }, [transactions]); // Dependency on transactions

   // useEffect hook to update animated widths
   useEffect(() => {
        if (categoryAnimationTimeoutRef.current) clearTimeout(categoryAnimationTimeoutRef.current);
        const targetWidths: Record<string, number> = {};
        Object.entries(targetCategoryBarData).forEach(([category, data]) => {
            targetWidths[category] = data.targetWidthForState;
        });
        categoryAnimationTimeoutRef.current = setTimeout(() => {
            setCurrentCategoryWidths(targetWidths);
        }, 50);
        return () => { if (categoryAnimationTimeoutRef.current) clearTimeout(categoryAnimationTimeoutRef.current); };
    }, [targetCategoryBarData]);


  // --- Determine Top Card Background Color ---
  const topCardBackgroundClass = useMemo(() => {
       if (!impactAnalysis) return "bg-gray-400 dark:bg-gray-600";
       if (totalNegativeImpact <= 0) {
           return totalPositiveImpact > 0 ? "bg-sky-500 dark:bg-sky-700" : "bg-gray-400 dark:bg-gray-600";
       }
       const ratio = targetScoreRatio ?? 0;
       if (ratio >= 1.0) return "bg-green-500 dark:bg-green-700";
       if (ratio >= 0.75) return "bg-lime-500 dark:bg-lime-700";
       if (ratio >= 0.50) return "bg-yellow-400 dark:bg-yellow-600";
       if (ratio >= 0.25) return "bg-amber-400 dark:bg-amber-600";
       if (ratio >= 0.10) return "bg-orange-500 dark:bg-orange-700";
       return "bg-red-600 dark:bg-red-800";
   }, [impactAnalysis, totalNegativeImpact, totalPositiveImpact, targetScoreRatio]);

  // Overall Progress Bar Target Percentage
  const targetAppliedPercentage = useMemo(() => {
      const totalTarget = applied + effective;
      return totalTarget > 0 ? Math.min((applied / totalTarget) * 100, 100) : (effective <= 0 ? 100 : 0);
  }, [applied, effective]);

  // Progress Bar Track Color
  const progressBarTrackColor = effective > 0 ? 'bg-red-200 dark:bg-red-900' : 'bg-green-200 dark:bg-green-900';

  // --- Effects ---
  useEffect(() => {
     if (overallAnimationTimeoutRef.current) clearTimeout(overallAnimationTimeoutRef.current);
     if (impactAnalysis) {
       overallAnimationTimeoutRef.current = setTimeout(() => {
         setCurrentAppliedPercentage(targetAppliedPercentage);
         setIsOverallAnimationReady(true);
       }, 50);
     } else {
       setIsOverallAnimationReady(false);
       setCurrentAppliedPercentage(0);
     }
     return () => { if (overallAnimationTimeoutRef.current) clearTimeout(overallAnimationTimeoutRef.current); };
   }, [targetAppliedPercentage, impactAnalysis]);

  // --- Action Handlers ---
  const creditButtonDisabled = useMemo(() => {
       return !impactAnalysis || available <= 0 || isApplyingCredit || effective <= 0;
   }, [impactAnalysis, available, isApplyingCredit, effective]);

  const offsetButtonDisabled = useMemo(() => {
        return !impactAnalysis || effective <= 0;
  }, [impactAnalysis, effective]);

  const handleApplyCredit = useCallback(async () => {
     if (!user || creditButtonDisabled || !impactAnalysis || available <= 0) return;
     try {
       const amountToApply = available;
       const success = await applyCredit(amountToApply, user.uid);
       setFeedbackMessage(success ? `Applied ${formatCurrency(amountToApply)} credit.` : "Failed to apply credit.");
       setShowFeedback(true);
       setTimeout(() => setShowFeedback(false), 3000);
     } catch (error) {
        console.error("Error applying credit:", error);
        setFeedbackMessage("An error occurred while applying credit.");
        setShowFeedback(true);
        setTimeout(() => setShowFeedback(false), 3000);
     }
   }, [applyCredit, user, impactAnalysis, available, creditButtonDisabled]);

  const handleOpenOffsetModal = useCallback(() => {
    if (effective > 0) {
        openDonationModal("All Societal Debt", effective);
    }
  }, [openDonationModal, effective]);

    // Data needed for sharing
    const categoryDataForSharing = useMemo(() => {
        const sharingData: Record<string, { score: number }> = {};
        Object.entries(targetCategoryBarData).forEach(([category, data]) => {
            sharingData[category] = { score: data.score };
        });
        return sharingData;
    }, [targetCategoryBarData]);

  // --- Render Logic ---
  return (
    <div className="w-full lg:col-span-1">
      <div className="card mb-6">

         {/* Section 1: Tier Display */}
         <div className={`${topCardBackgroundClass} transition-colors duration-2000 p-4 sm:p-6 rounded-t-xl`}>
              <div className="text-center">
                 <div className="mb-2">
                    <h2 className={`text-4xl sm:text-5xl font-bold tracking-tight drop-shadow-md ${currentTierInfo.colorClass} transition-colors duration-2000 ease-in-out`}>{currentTierInfo.name}</h2>
                    <p className={`text-sm font-medium ${currentTierInfo.colorClass === 'text-white' ? 'text-white opacity-90' : 'text-gray-200'} mt-1`}>{currentTierInfo.description}</p>
                    {targetScoreRatio !== null && (
                        <p className={`text-xs ${currentTierInfo.colorClass === 'text-white' ? 'text-white opacity-70' : 'text-gray-300'}`}>
                             (<span className="font-semibold">{animatedRatioPercentString}</span>% Offset)
                         </p>
                     )}
                 </div>
              </div>
         </div>

         {/* Section 2: Overall Progress Bar */}
         <div className="p-4 space-y-2 border-b border-[var(--border-color)]">
             <div className="flex justify-between text-xs sm:text-sm mb-1">
               <span className="font-medium text-[var(--muted-foreground)]">Applied Credit</span>
               <span className="font-medium text-[var(--muted-foreground)]">{effective > 0 ? 'Remaining Debt' : 'Debt Offset'}</span>
             </div>
             <div className={`w-full ${progressBarTrackColor} rounded-full h-3 overflow-hidden relative transition-colors duration-2000`}>
                <div
                    className="bg-[var(--success)] h-3 rounded-l-full absolute top-0 left-0 transition-all duration-2000 ease-out"
                    style={{ width: isOverallAnimationReady ? `${currentAppliedPercentage}%` : '0%' }}
                    title={`Applied: ${formatCurrency(applied)}`}
                />
             </div>
             <div className="flex justify-between text-xs sm:text-sm">
                <AnimatedCounter value={applied} prefix="$" className="font-semibold text-[var(--success)]" />
                <span className={`font-semibold ${effective > 0 ? 'text-[var(--destructive)]' : 'text-[var(--success)]'}`} title={effective > 0 ? `Remaining Debt: ${formatCurrency(effective)}` : 'All Debt Offset'}>
                    {formatCurrency(effective)}
                </span>
             </div>
         </div>

        {/* Section 4: Debt Offset & Available Credit Actions */}
        <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
                 <div><span className="text-[var(--muted-foreground)] text-sm sm:text-base">Remaining Debt</span></div>
                 <div className="flex items-center gap-2">
                    <span className={`font-bold text-sm sm:text-base ${effective > 0 ? 'text-[var(--destructive)]' : 'text-[var(--success)]'}`}>{formatCurrency(effective)}</span>
                    <button onClick={handleOpenOffsetModal} disabled={offsetButtonDisabled} className={`px-3 py-1 rounded-full text-xs font-medium text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--card-background)] focus:ring-[var(--primary)] ${ offsetButtonDisabled ? "bg-gray-400 dark:bg-gray-500 cursor-not-allowed opacity-50" : "bg-[var(--primary)] hover:opacity-80" }`} title={effective <= 0 ? "No remaining debt to offset" : `Offset ${formatCurrency(effective)} remaining debt` }>Offset</button>
                 </div>
            </div>
           <div className="flex items-center justify-between">
             <div><span className="text-[var(--muted-foreground)] text-sm sm:text-base">Available Credit</span></div>
             <div className="flex items-center gap-2">
                <AnimatedCounter value={available} prefix="$" className="font-bold text-[var(--success)] text-sm sm:text-base" />
                <button onClick={handleApplyCredit} disabled={creditButtonDisabled} className={`px-3 py-1 rounded-full text-xs font-medium text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--card-background)] focus:ring-[var(--success)] ${ creditButtonDisabled ? "bg-gray-400 dark:bg-gray-500 cursor-not-allowed opacity-50" : "bg-[var(--success)] hover:opacity-80" }`} title={ available <= 0 ? "No credit available" : effective <= 0 ? "No debt to offset" : `Apply ${formatCurrency(available)} credit` }>{isApplyingCredit ? "Applying..." : "Apply"}</button>
             </div>
           </div>
           {showFeedback && ( <div className="mt-2 text-xs text-center text-[var(--success)] animate-pulse"> {feedbackMessage} </div> )}
        </div>

        {/* Section 3: Category Values Breakdown */}
        <div className="p-4 sm:p-6 border-t border-[var(--border-color)]">
            <h3 className="text-base sm:text-lg font-semibold text-[var(--card-foreground)] mb-4 text-center">Your Values</h3>
            {Object.keys(targetCategoryBarData).length === 0 && (
               <p className="text-sm text-center text-[var(--muted-foreground)] py-4">{impactAnalysis ? "No category data available." : "Calculating..."}</p>
            )}
            <div className="space-y-3">
                {Object.entries(targetCategoryBarData)
                   .sort(([catA], [catB]) => catA.localeCompare(catB))
                   .map(([category, { score, tooltip }]) => { // Destructure only needed score, tooltip
                       const animatedBarWidth = currentCategoryWidths[category] || 0;
                       const { textColor, bgColor } = getScoreColorClasses(score);
                       const showPlusSign = score > 1;

                       return (
                           <div key={category} className="flex items-center justify-between gap-2 sm:gap-4">
                               {/* Category Name & Icon */}
                               <span className="flex-shrink-0 w-[110px] sm:w-[130px] inline-flex items-center text-[var(--card-foreground)] text-xs sm:text-sm truncate" title={category}>
                                   <span className="mr-1.5 sm:mr-2 text-base">{categoryIcons[category] || categoryIcons["Default Category"]}</span>
                                   <span className="truncate">{category}</span>
                               </span>
                               {/* Bidirectional Bar */}
                               <div className="flex-grow h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full relative overflow-hidden" title={tooltip} >
                                   <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-400 dark:bg-gray-500 transform -translate-x-1/2 z-10"></div>
                                   {score < -0.01 && ( <div className={`absolute right-1/2 top-0 bottom-0 ${bgColor} rounded-l-full transition-all duration-2000 ease-out`} style={{ width: `${animatedBarWidth}%` }} ></div> )}
                                   {score > 0.01 && ( <div className={`absolute left-1/2 top-0 bottom-0 ${bgColor} rounded-r-full transition-all duration-2000 ease-out`} style={{ width: `${animatedBarWidth}%` }} ></div> )}
                                   {score >= -0.01 && score <= 0.01 && animatedBarWidth < 1 && ( <div className={`absolute left-1/2 top-1/2 w-1 h-1 ${bgColor} rounded-full transform -translate-x-1/2 -translate-y-1/2`} ></div> )}
                               </div>
                               {/* Score Text */}
                               <div className={`flex-shrink-0 w-[45px] sm:w-[50px] text-right font-semibold text-xs sm:text-sm ${textColor} flex items-center justify-end`}>
                                    {showPlusSign && <span className="opacity-80">+</span>}
                                    
                                    {/* FIX: Change decimalPlaces to 1 */}
                                    <AnimatedCounter value={score} suffix="%" prefix="" decimalPlaces={1} className="value-text-score" />
                               </div>
                           </div>
                       );
                   })}
             </div>
             {/* Share Button Integration */}
              <ShareImpactButton
                 categoryData={categoryDataForSharing}
                 overallRatio={targetScoreRatio}
                 totalPositiveImpact={totalPositiveImpact}
             />
          </div>
      </div>

      {/* Donation Modal */}
      {modalState.isOpen && ( <DonationModal isOpen={modalState.isOpen} practice={modalState.practice || ''} amount={modalState.amount || 0} onClose={closeDonationModal} /> )}
    </div>
  );
}