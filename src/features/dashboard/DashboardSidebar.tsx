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
    Environment: "🌱", "Labor Ethics": "⚖️", "Animal Welfare": "🐮",
    "Political Ethics": "🗳️", Transparency: "🔍", "Default Category": "❓"
};

// --- Helper: Tier Calculation ---
const getTierInfo = (
    scoreRatio: number | null, totalPositiveImpact: number, totalNegativeImpact: number
): { name: string; description: string; colorClass: string; displayRatio?: number } => {
    if (totalNegativeImpact <= 0) { if (totalPositiveImpact > 0) return { name: "S", description: "Beacon of Virtue", colorClass: "text-white", displayRatio: undefined }; return { name: "", description: "", colorClass: "text-white", displayRatio: undefined }; }
    const ratio = scoreRatio ?? 0; const textColor = "text-white";
    if (ratio >= 1.0) return { name: "S", description: "Beacon of Virtue", displayRatio: ratio, colorClass: textColor }; if (ratio >= 0.75) return { name: "A", description: "Conscious Contributor", displayRatio: ratio, colorClass: textColor }; if (ratio >= 0.50) return { name: "B", description: "Neutral Navigator", displayRatio: ratio, colorClass: textColor }; if (ratio >= 0.35) return { name: "C", description: "Passive Liability", displayRatio: ratio, colorClass: textColor }; if (ratio >= 0.20) return { name: "D", description: "Dead Weight", displayRatio: ratio, colorClass: textColor }; return { name: "F", description: "Societal Parasite", displayRatio: ratio, colorClass: textColor };
};

// --- Helper: Score Colors ---
const getScoreColorClasses = (score: number): { textColor: string; bgColor: string } => {
    const positiveThreshold = 1; const negativeThreshold = -1; if (score > positiveThreshold) return { textColor: "text-[var(--success)]", bgColor: "bg-[var(--success)]" }; if (score < negativeThreshold) return { textColor: "text-[var(--destructive)]", bgColor: "bg-[var(--destructive)]" }; return { textColor: "text-[var(--muted-foreground)]", bgColor: "bg-gray-400 dark:bg-gray-500" };
};

// --- Helper: Format Currency ---
const formatCurrency = (value: number | null | undefined): string => `$${(value ?? 0).toFixed(2)}`;


export function DashboardSidebar() {
  const { user } = useAuth();

  // --- State Selection ---
  const isBankConnected = useTransactionStore((state) => state.connectionStatus.isConnected);
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
  // Removed unused feedback state

  // --- Calculations ---
  const applied = useMemo(() => isBankConnected ? (impactAnalysis?.appliedCredit ?? 0) : 0, [impactAnalysis, isBankConnected]);
  const effective = useMemo(() => isBankConnected ? (impactAnalysis?.effectiveDebt ?? 0) : 0, [impactAnalysis, isBankConnected]);
  const available = useMemo(() => isBankConnected ? (impactAnalysis?.availableCredit ?? 0) : 0, [impactAnalysis, isBankConnected]);
  const totalPositiveImpact = useMemo(() => isBankConnected ? (impactAnalysis?.positiveImpact ?? 0) : 0, [impactAnalysis, isBankConnected]);
  const totalNegativeImpact = useMemo(() => isBankConnected ? (impactAnalysis?.negativeImpact ?? 0) : 0, [impactAnalysis, isBankConnected]);

  const targetScoreRatio = useMemo(() => {
      if (!isBankConnected || !impactAnalysis || totalNegativeImpact <= 0) return null;
      return Math.max(0, applied) / totalNegativeImpact;
  }, [impactAnalysis, applied, totalNegativeImpact, isBankConnected]);

  const animatedRatioPercentString = useCountUp(
      isBankConnected && targetScoreRatio !== null ? Math.max(0, targetScoreRatio * 100) : 0,
      { duration: 2000, decimalPlaces: 1, easing: 'easeOut' }
  );

  const currentTierInfo = useMemo(() => {
      if (!isBankConnected) return getTierInfo(null, 0, 0);
      const currentAnimatedRatioValue = parseFloat(animatedRatioPercentString) / 100;
      const ratioForTierCalc = isNaN(currentAnimatedRatioValue) ? targetScoreRatio : currentAnimatedRatioValue;
      return getTierInfo(ratioForTierCalc, totalPositiveImpact, totalNegativeImpact);
  }, [animatedRatioPercentString, targetScoreRatio, totalPositiveImpact, totalNegativeImpact, isBankConnected]);

  const targetCategoryBarData = useMemo(() => {
       if (!isBankConnected || transactions.length === 0) return {};
       const totalSpendingWithAnyValue = transactions.reduce((sum, tx) => { const hasEthical = tx.ethicalPractices && tx.ethicalPractices.length > 0; const hasUnethical = tx.unethicalPractices && tx.unethicalPractices.length > 0; return sum + (hasEthical || hasUnethical ? (tx.amount || 0) : 0); }, 0);
       const catImpacts = calculationService.calculateCategoryImpacts(transactions);
       const results: Record<string, { score: number; tooltip: string; targetWidthForState: number; }> = {};
       const definedCategories = ["Environment", "Labor Ethics", "Animal Welfare", "Political Ethics", "Transparency"];
       definedCategories.forEach(category => { const values = catImpacts[category] || { positiveImpact: 0, negativeImpact: 0, totalSpent: 0 }; const { positiveImpact, negativeImpact } = values; const denominator = totalSpendingWithAnyValue; let posPercent = 0; let negPercent = 0; if (denominator > 0) { posPercent = (positiveImpact / denominator) * 100; negPercent = (negativeImpact / denominator) * 100; } const score = posPercent - negPercent; const targetWidthForState = Math.min(50, Math.abs(score) / 2 * (50/50)); const tooltipText = `Net Score: ${score > 0 ? '+' : ''}${score.toFixed(1)}% (Pos Impact: ${formatCurrency(positiveImpact)}, Neg Impact: ${formatCurrency(negativeImpact)})`; if (Math.abs(score) > 0.01) { results[category] = { score, tooltip: tooltipText, targetWidthForState }; } });
       return results;
   }, [transactions, isBankConnected]);

   useEffect(() => {
        if (!isBankConnected) { setCurrentCategoryWidths({}); return; };
        if (categoryAnimationTimeoutRef.current) clearTimeout(categoryAnimationTimeoutRef.current);
        const targetWidths: Record<string, number> = {};
        Object.entries(targetCategoryBarData).forEach(([category, data]) => { targetWidths[category] = data.targetWidthForState; });
        categoryAnimationTimeoutRef.current = setTimeout(() => { setCurrentCategoryWidths(targetWidths); }, 50);
        return () => { if (categoryAnimationTimeoutRef.current) clearTimeout(categoryAnimationTimeoutRef.current); };
    }, [targetCategoryBarData, isBankConnected]);

  const topCardBackgroundClass = useMemo(() => {
       if (!isBankConnected || !impactAnalysis) return "bg-gray-400 dark:bg-gray-600";
       if (totalNegativeImpact <= 0) { return totalPositiveImpact > 0 ? "bg-sky-500 dark:bg-sky-700" : "bg-gray-400 dark:bg-gray-600"; } const ratio = targetScoreRatio ?? 0; if (ratio >= 1.0) return "bg-green-500 dark:bg-green-700"; if (ratio >= 0.75) return "bg-lime-500 dark:bg-lime-700"; if (ratio >= 0.50) return "bg-yellow-400 dark:bg-yellow-600"; if (ratio >= 0.25) return "bg-amber-400 dark:bg-amber-600"; if (ratio >= 0.10) return "bg-orange-500 dark:bg-orange-700"; return "bg-red-600 dark:bg-red-800";
   }, [impactAnalysis, totalNegativeImpact, totalPositiveImpact, targetScoreRatio, isBankConnected]);

  const targetAppliedPercentage = useMemo(() => {
      if (!isBankConnected) return 0;
      const totalTarget = applied + effective;
      return totalTarget > 0 ? Math.min((applied / totalTarget) * 100, 100) : (effective <= 0 ? 100 : 0);
  }, [applied, effective, isBankConnected]);

  const progressBarTrackColor = effective > 0 ? 'bg-red-200 dark:bg-red-900' : 'bg-green-200 dark:bg-green-900';

  // --- Effects ---
  useEffect(() => {
     if (!isBankConnected) { setIsOverallAnimationReady(false); setCurrentAppliedPercentage(0); return; }
     const timeoutId = overallAnimationTimeoutRef.current; // Capture ref value for cleanup
     if (timeoutId) clearTimeout(timeoutId);
     if (impactAnalysis) {
       overallAnimationTimeoutRef.current = setTimeout(() => {
         setCurrentAppliedPercentage(targetAppliedPercentage);
         setIsOverallAnimationReady(true);
       }, 50);
     } else {
       setIsOverallAnimationReady(false);
       setCurrentAppliedPercentage(0);
     }
     // Use captured value in cleanup
     return () => { if (overallAnimationTimeoutRef.current) clearTimeout(overallAnimationTimeoutRef.current); };
   }, [targetAppliedPercentage, impactAnalysis, isBankConnected]);

  // --- Action Handlers ---
  const creditButtonDisabled = useMemo(() => {
       return !isBankConnected || !impactAnalysis || available <= 0 || isApplyingCredit || effective <= 0;
   }, [impactAnalysis, available, isApplyingCredit, effective, isBankConnected]);

  const offsetButtonDisabled = useMemo(() => {
        return !isBankConnected || !impactAnalysis || effective <= 0;
  }, [impactAnalysis, effective, isBankConnected]);

  const handleApplyCredit = useCallback(async () => {
     if (!user || creditButtonDisabled || !impactAnalysis || available <= 0) return;
     try {
       const amountToApply = available;
       // FIX: Call applyCredit but don't assign the result to the unused 'success' variable
       await applyCredit(amountToApply, user.uid);
       // Feedback logic is removed, handle globally or via store state if needed
     } catch (error) {
        console.error("Error applying credit:", error);
        // Handle error feedback if needed
     }
   }, [applyCredit, user, impactAnalysis, available, creditButtonDisabled]); // Removed isApplyingCredit, ignore warning for applyCredit

  const handleOpenOffsetModal = useCallback(() => {
    if (effective > 0) { openDonationModal("All Societal Debt", effective); }
  }, [openDonationModal, effective]);

    const categoryDataForSharing = useMemo(() => {
        if (!isBankConnected) return {};
        const sharingData: Record<string, { score: number }> = {};
        Object.entries(targetCategoryBarData).forEach(([category, data]) => { sharingData[category] = { score: data.score }; });
        return sharingData;
    }, [targetCategoryBarData, isBankConnected]);

  // --- Render Logic ---
  return (
    <div className="w-full lg:col-span-1 min-h-[100px] lg:min-h-0">
      <div className="card mb-6 h-full flex flex-col">

        {/* Section 1: Tier Display (Always Visible) */}
        <div className={`${topCardBackgroundClass} transition-colors duration-2000 p-4 sm:p-6 rounded-t-xl`}>
             {/* ... Tier Content ... */}
             <div className="text-center"><div className="mb-2"><h2 className={`text-4xl sm:text-5xl font-bold tracking-tight drop-shadow-md ${currentTierInfo.colorClass} transition-colors duration-2000 ease-in-out`}>{currentTierInfo.name || "---"}</h2><p className={`text-sm font-medium ${currentTierInfo.colorClass === 'text-white' ? 'text-white opacity-90' : 'text-gray-200'} mt-1`}>{isBankConnected ? currentTierInfo.description : "Connect Bank to see details"}</p>{isBankConnected && targetScoreRatio !== null && ( <p className={`text-xs ${currentTierInfo.colorClass === 'text-white' ? 'text-white opacity-70' : 'text-gray-300'}`}> (<span className="font-semibold">{animatedRatioPercentString}</span>% Offset) </p> )}</div></div>
        </div>

        {/* Conditionally Rendered Content Wrapper */}
        <div className={`flex-grow flex flex-col ${isBankConnected ? 'block' : 'hidden lg:block'}`}>

            {/* Section 2: Overall Progress Bar */}
            <div className="p-4 space-y-2 border-b border-[var(--border-color)]">
                 {/* ... Progress bar content ... */}
                 <div className="flex justify-between text-xs sm:text-sm mb-1"> <span className="font-medium text-[var(--muted-foreground)]">Applied Credit</span> <span className="font-medium text-[var(--muted-foreground)]">{effective > 0 ? 'Remaining Debt' : 'Debt Offset'}</span> </div> <div className={`w-full ${progressBarTrackColor} rounded-full h-3 overflow-hidden relative transition-colors duration-2000`}> <div className="bg-[var(--success)] h-3 rounded-l-full absolute top-0 left-0 transition-all duration-2000 ease-out" style={{ width: isOverallAnimationReady ? `${currentAppliedPercentage}%` : '0%' }} title={`Applied: ${formatCurrency(applied)}`} /> </div> <div className="flex justify-between text-xs sm:text-sm"> <AnimatedCounter value={applied} prefix="$" className="font-semibold text-[var(--success)]" /> <span className={`font-semibold ${effective > 0 ? 'text-[var(--destructive)]' : 'text-[var(--success)]'}`} title={effective > 0 ? `Remaining Debt: ${formatCurrency(effective)}` : 'All Debt Offset'}> {formatCurrency(effective)} </span> </div>
            </div>

           {/* Section 4: Debt Offset & Available Credit Actions */}
           <div className="p-4 space-y-3">
                {/* ... Action buttons content ... */}
                 <div className="flex items-center justify-between"> <div><span className="text-[var(--muted-foreground)] text-sm sm:text-base">Remaining Debt</span></div> <div className="flex items-center gap-2"> <span className={`font-bold text-sm sm:text-base ${effective > 0 ? 'text-[var(--destructive)]' : 'text-[var(--success)]'}`}>{formatCurrency(effective)}</span> <button onClick={handleOpenOffsetModal} disabled={offsetButtonDisabled} className={`px-3 py-1 rounded-full text-xs font-medium text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--card-background)] focus:ring-[var(--primary)] ${ offsetButtonDisabled ? "bg-gray-400 dark:bg-gray-500 cursor-not-allowed opacity-50" : "bg-[var(--primary)] hover:opacity-80" }`} title={effective <= 0 ? "No remaining debt to offset" : `Offset ${formatCurrency(effective)} remaining debt` }>Offset</button> </div> </div> <div className="flex items-center justify-between"> <div><span className="text-[var(--muted-foreground)] text-sm sm:text-base">Available Credit</span></div> <div className="flex items-center gap-2"> <AnimatedCounter value={available} prefix="$" className="font-bold text-[var(--success)] text-sm sm:text-base" /> <button onClick={handleApplyCredit} disabled={creditButtonDisabled} className={`px-3 py-1 rounded-full text-xs font-medium text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--card-background)] focus:ring-[var(--success)] ${ creditButtonDisabled ? "bg-gray-400 dark:bg-gray-500 cursor-not-allowed opacity-50" : "bg-[var(--success)] hover:opacity-80" }`} title={ available <= 0 ? "No credit available" : effective <= 0 ? "No debt to offset" : `Apply ${formatCurrency(available)} credit` }>{isApplyingCredit ? "Applying..." : "Apply"}</button> </div> </div>
                 {/* Feedback display removed */}
           </div>

           {/* Section 3: Category Values Breakdown */}
           <div className="p-4 sm:p-6 border-t border-[var(--border-color)] flex-grow">
               <h3 className="text-base sm:text-lg font-semibold text-[var(--card-foreground)] mb-4 text-center">Your Values</h3>
               {Object.keys(targetCategoryBarData).length === 0 && ( <p className="text-sm text-center text-[var(--muted-foreground)] py-4">{impactAnalysis ? "No category data available." : "Calculating..."}</p> )}
               <div className="space-y-3">
                   {Object.entries(targetCategoryBarData).sort(([catA], [catB]) => catA.localeCompare(catB)) .map(([category, { score, tooltip }]) => {
                           const animatedBarWidth = currentCategoryWidths[category] || 0; const { textColor, bgColor } = getScoreColorClasses(score); const showPlusSign = score > 1;
                           return ( <div key={category} className="flex items-center justify-between gap-2 sm:gap-4"> <span className="flex-shrink-0 w-[110px] sm:w-[130px] inline-flex items-center text-[var(--card-foreground)] text-xs sm:text-sm truncate" title={category}> <span className="mr-1.5 sm:mr-2 text-base">{categoryIcons[category] || categoryIcons["Default Category"]}</span> <span className="truncate">{category}</span> </span> <div className="flex-grow h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full relative overflow-hidden" title={tooltip} > <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-400 dark:bg-gray-500 transform -translate-x-1/2 z-10"></div> {score < -0.01 && ( <div className={`absolute right-1/2 top-0 bottom-0 ${bgColor} rounded-l-full transition-all duration-2000 ease-out`} style={{ width: `${animatedBarWidth}%` }} ></div> )} {score > 0.01 && ( <div className={`absolute left-1/2 top-0 bottom-0 ${bgColor} rounded-r-full transition-all duration-2000 ease-out`} style={{ width: `${animatedBarWidth}%` }} ></div> )} {score >= -0.01 && score <= 0.01 && animatedBarWidth < 1 && ( <div className={`absolute left-1/2 top-1/2 w-1 h-1 ${bgColor} rounded-full transform -translate-x-1/2 -translate-y-1/2`} ></div> )} </div> <div className={`flex-shrink-0 w-[45px] sm:w-[50px] text-right font-semibold text-xs sm:text-sm ${textColor} flex items-center justify-end`}> {showPlusSign && <span className="opacity-80">+</span>} <AnimatedCounter value={score} suffix="%" prefix="" decimalPlaces={1} className="value-text-score" /> </div> </div> );
                       })}
                </div>
                {/* Share Button Integration */}
                 <ShareImpactButton
                    categoryData={categoryDataForSharing}
                    overallRatio={targetScoreRatio}
                    totalPositiveImpact={totalPositiveImpact}
                />
             </div>

        </div> {/* End Conditional Content Wrapper */}
      </div>

      {/* Donation Modal */}
      {modalState.isOpen && ( <DonationModal isOpen={modalState.isOpen} practice={modalState.practice || ''} amount={modalState.amount || 0} onClose={closeDonationModal} /> )}
    </div>
  );
}