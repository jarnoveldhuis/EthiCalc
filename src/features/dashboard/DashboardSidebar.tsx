// src/features/dashboard/DashboardSidebar.jsx
import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useTransactionStore } from "@/store/transactionStore";
import { AnimatedCounter } from "@/shared/ui/AnimatedCounter"; // Ensure this is imported
import { DonationModal } from "@/features/charity/DonationModal";
import { useDonationModal } from "@/hooks/useDonationModal";
import { useAuth } from "@/hooks/useAuth";
import { calculationService } from "@/core/calculations/impactService";

// --- Category Icons ---
const categoryIcons: Record<string, string> = {
    Environment: "🌱",
    "Labor Ethics": "⚖️",
    "Animal Welfare": "🐮",
    "Political Ethics": "🗳️",
    Transparency: "🔍",
    "Default Category": "❓" // Fallback icon
};

// --- Helper: Tier Calculation ---
// Calculates the user's overall tier based on impact and credit usage
const getTierInfo = (appliedCredit: number, totalPositiveImpact: number, totalNegativeImpact: number): { name: string; description: string; colorClass: string; ratio?: number } => {
    if (totalNegativeImpact <= 0) { // Handle cases with no negative impact
        if (totalPositiveImpact > 0 || appliedCredit > 0) {
            // If positive impact exists or credit was applied, assign highest tier
            return { name: "S", description: "Impact Positive", colorClass: "text-cyan-400" }; // Example S-tier color
        }
        // If no impact at all, neutral
        return { name: "N", description: "Neutral / No Data", colorClass: "text-gray-500" };
    }

    // Calculate offset ratio only if there's negative impact to offset
    const scoreRatio = appliedCredit / totalNegativeImpact;

    // Determine tier based on how much of the negative impact has been offset
    if (scoreRatio >= 1.0) return { name: "A+", description: "Transformative Steward", ratio: scoreRatio, colorClass: "text-green-500" };
    if (scoreRatio >= 0.75) return { name: "A", description: "Conscious Cultivator", ratio: scoreRatio, colorClass: "text-lime-500" };
    if (scoreRatio >= 0.50) return { name: "B", description: "Mindful Participant", ratio: scoreRatio, colorClass: "text-yellow-500" };
    if (scoreRatio >= 0.25) return { name: "C", description: "Awakening Consumer", ratio: scoreRatio, colorClass: "text-amber-500" };
    if (scoreRatio >= 0.10) return { name: "D", description: "Passive Participant", ratio: scoreRatio, colorClass: "text-orange-500" };
    // Default to lowest tier if offset ratio is less than 0.10
    return { name: "F", description: "Passive Consumer", ratio: scoreRatio, colorClass: "text-red-500" };
};

// Gets text and bar color based on the net score
const getScoreColorClasses = (score: number): { textColor: string; bgColor: string } => {
    // Use a small threshold around zero for neutral color
    if (score > 0.5) return { textColor: "text-[var(--success)]", bgColor: "bg-[var(--success)]" };
    if (score < -0.5) return { textColor: "text-[var(--destructive)]", bgColor: "bg-[var(--destructive)]" };
    // Neutral (close to zero)
    return { textColor: "text-[var(--muted-foreground)]", bgColor: "bg-gray-400 dark:bg-gray-500" };
};

// Formats currency
const formatCurrency = (value: number): string => `$${value.toFixed(2)}`;


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
  // Overall impact figures from store analysis
  const applied = impactAnalysis?.appliedCredit ?? 0;
  const effective = impactAnalysis?.effectiveDebt ?? 0;
  const available = impactAnalysis?.availableCredit ?? 0;
  const totalPositiveImpact = impactAnalysis?.positiveImpact ?? 0;
  const totalNegativeImpact = impactAnalysis?.negativeImpact ?? 0;

  // Tier Calculation based on overall figures
  const tierInfo = useMemo(() => {
    if (!impactAnalysis) {
       return { name: "?", description: "Calculating...", colorClass: "text-gray-500" };
    }
    return getTierInfo(applied, totalPositiveImpact, totalNegativeImpact);
  }, [impactAnalysis, applied, totalPositiveImpact, totalNegativeImpact, effective]);

  // Calculate TARGET category data for bars and text score display
  const targetCategoryBarData = useMemo(() => {
    // Calculate Total Spending Associated with ANY Value (used as denominator for scores/bars)
    const totalSpendingWithAnyValue = transactions.reduce((sum, tx) => {
        const hasValue = (tx.ethicalPractices && tx.ethicalPractices.length > 0) ||
                         (tx.unethicalPractices && tx.unethicalPractices.length > 0);
        return sum + (hasValue ? (tx.amount || 0) : 0);
    }, 0);

    // Get category-specific impacts { positiveImpact, negativeImpact } per category
    const catImpacts = calculationService.calculateCategoryImpacts(transactions);
    const results: Record<string, {
        score: number; // NET difference score (pos% - neg%) for text display & bar color
        targetBarWidthPercent: number; // Target width for animation (0-50 based on abs(score))
        tooltip: string; // Tooltip text
     }> = {};
    // Define categories to ensure all are processed
    const definedCategories = ["Environment", "Labor Ethics", "Animal Welfare", "Political Ethics", "Transparency"];

     definedCategories.forEach(category => {
       const values = catImpacts[category] || { positiveImpact: 0, negativeImpact: 0 };
       const { positiveImpact, negativeImpact } = values;

       // Calculate percentages relative to VALUE-ASSOCIATED spending
       let posPercent = 0;
       let negPercent = 0;
       if (totalSpendingWithAnyValue > 0) {
           posPercent = (positiveImpact / totalSpendingWithAnyValue) * 100;
           negPercent = (negativeImpact / totalSpendingWithAnyValue) * 100;
       } // Handle edge cases like 0 denominator if needed

       // Calculate final SCORE: net difference of the percentages
       const score = posPercent - negPercent;

       // Calculate TARGET BAR WIDTH: absolute value of the score (0-100), halved for visual space (0-50)
       const targetBarWidthPercent = Math.min(100, Math.abs(score)) / 2;

       // Create Tooltip text explaining score basis
       const tooltipText = `Net Score: ${score > 0 ? '+' : ''}${score.toFixed(1)}% (Pos: ${posPercent.toFixed(0)}%, Neg: ${negPercent.toFixed(0)}% of value spend)`;

       results[category] = {
           score,
           targetBarWidthPercent,
           tooltip: tooltipText
       };
    });
    return results;
  }, [transactions]); // Recalculate only when transactions change

  // Determine Top Card Background Color based on overall effective debt
  const topCardBackgroundClass = useMemo(() => {
       if (!impactAnalysis) return "bg-[var(--secondary)] text-[var(--secondary-foreground)]";
       if (effective <= 0) return "bg-[var(--success)] text-[var(--success-foreground)]";
       if (effective < 50) return "bg-[var(--warning)] text-[var(--warning-foreground)]";
       return "bg-[var(--destructive)] text-[var(--destructive-foreground)]";
   }, [impactAnalysis, effective]);

  // Overall Progress Bar Target Percentage for animation
  const targetAppliedPercentage = useMemo(() => {
      const totalTarget = applied + effective; // Total potential progress = applied + remaining debt
      return totalTarget > 0 ? Math.min((applied / totalTarget) * 100, 100) : (effective <= 0 ? 100 : 0);
  }, [applied, effective]);

  // Progress Bar Track Color based on remaining debt
  const progressBarTrackColor = effective > 0 ? 'bg-red-200 dark:bg-red-900' : 'bg-green-200 dark:bg-green-900';

  // --- Effects ---
  // Effect for Overall Progress Bar animation
  useEffect(() => {
     if (overallAnimationTimeoutRef.current) clearTimeout(overallAnimationTimeoutRef.current);
     if (impactAnalysis) { // Only animate if analysis data is ready
       overallAnimationTimeoutRef.current = setTimeout(() => {
         setCurrentAppliedPercentage(targetAppliedPercentage);
         setIsOverallAnimationReady(true);
       }, 50); // Short delay to allow CSS transition setup
     } else { // Reset if analysis data disappears
       setIsOverallAnimationReady(false);
       setCurrentAppliedPercentage(0);
     }
     // Cleanup timeout on unmount or dependency change
     return () => { if (overallAnimationTimeoutRef.current) clearTimeout(overallAnimationTimeoutRef.current); };
   }, [targetAppliedPercentage, impactAnalysis]);

  // Effect for Category Bar animation
  useEffect(() => {
      if (categoryAnimationTimeoutRef.current) clearTimeout(categoryAnimationTimeoutRef.current);

      // Create the target state object (category -> target width 0-50)
      const targetWidths: Record<string, number> = {};
      Object.entries(targetCategoryBarData).forEach(([category, data]) => {
          targetWidths[category] = data.targetBarWidthPercent;
      });

      // Set a timeout to update the animated widths state after a brief delay
      categoryAnimationTimeoutRef.current = setTimeout(() => {
          setCurrentCategoryWidths(targetWidths);
      }, 50);

      // Cleanup function
      return () => {
          if (categoryAnimationTimeoutRef.current) {
              clearTimeout(categoryAnimationTimeoutRef.current);
          }
      };
  }, [targetCategoryBarData]); // Re-run when target data changes

  // --- Action Handlers ---
  // Determine if Credit Apply button should be disabled
  const creditButtonDisabled = useMemo(() => {
       return !impactAnalysis || available <= 0 || isApplyingCredit || effective <= 0;
   }, [impactAnalysis, available, isApplyingCredit, effective]);

  // Determine if Debt Offset button should be disabled
  const offsetButtonDisabled = useMemo(() => {
        return !impactAnalysis || effective <= 0;
  }, [impactAnalysis, effective]);

  // Handler to apply available credit
  const handleApplyCredit = useCallback(async () => {
     if (!user || creditButtonDisabled || !impactAnalysis || available <= 0) return;
     try {
       const amountToApply = available;
       const success = await applyCredit(amountToApply, user.uid); // Call store action
       // Show feedback to user
       setFeedbackMessage(success ? `Applied ${formatCurrency(amountToApply)} credit.` : "Failed to apply credit.");
       setShowFeedback(true);
       setTimeout(() => setShowFeedback(false), 3000);
     } catch (error) {
        console.error("Error applying credit:", error);
        setFeedbackMessage("An error occurred while applying credit.");
        setShowFeedback(true);
        setTimeout(() => setShowFeedback(false), 3000);
     }
   }, [applyCredit, user, impactAnalysis, available, creditButtonDisabled, isApplyingCredit]); // Include all dependencies

  // Handler to open the donation modal for offsetting debt
  const handleOpenOffsetModal = useCallback(() => {
    if (effective > 0) {
        // Pass the remaining debt amount to the modal
        openDonationModal("All Societal Debt", effective);
    }
  }, [openDonationModal, effective]);


  // --- Render Logic ---
  return (
    <div className="w-full lg:col-span-1">
      {/* Card container */}
      <div className="card mb-6">

         {/* Section 1: Tier Display */}
         <div className={`${topCardBackgroundClass} transition-colors duration-500 p-4 sm:p-6 rounded-t-xl`}>
              <div className="text-center">
                 <div className="mb-2">
                    <h2 className={`text-4xl sm:text-5xl font-bold tracking-tight text-white drop-shadow-md`}>{tierInfo.name}</h2>
                    <p className="text-sm font-medium text-white opacity-90 mt-1">{tierInfo.description}</p>
                    {tierInfo.ratio !== undefined && isFinite(tierInfo.ratio) && tierInfo.ratio >= 0 && (
                        <p className="text-xs text-white opacity-70">({(tierInfo.ratio * 100).toFixed(0)}% Offset)</p>
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
             <div className={`w-full ${progressBarTrackColor} rounded-full h-3 overflow-hidden relative transition-colors duration-500`}>
                <div
                    className="bg-[var(--success)] h-3 rounded-l-full absolute top-0 left-0 transition-all duration-500 ease-out"
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
            {/* Row for Remaining Debt & Offset Button */}
             <div className="flex items-center justify-between">
                 <div><span className="text-[var(--muted-foreground)] text-sm sm:text-base">Remaining Debt</span></div>
                 <div className="flex items-center gap-2">
                    <span className={`font-bold text-sm sm:text-base ${effective > 0 ? 'text-[var(--destructive)]' : 'text-[var(--success)]'}`}>{formatCurrency(effective)}</span>
                    <button onClick={handleOpenOffsetModal} disabled={offsetButtonDisabled} className={`px-3 py-1 rounded-full text-xs font-medium text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--card-background)] focus:ring-[var(--primary)] ${ offsetButtonDisabled ? "bg-gray-400 dark:bg-gray-500 cursor-not-allowed opacity-50" : "bg-[var(--primary)] hover:opacity-80" }`} title={effective <= 0 ? "No remaining debt to offset" : `Offset ${formatCurrency(effective)} remaining debt` }>Offset</button>
                 </div>
            </div>
           {/* Row for Available Credit & Apply Button */}
           <div className="flex items-center justify-between">
             <div><span className="text-[var(--muted-foreground)] text-sm sm:text-base">Available Credit</span></div>
             <div className="flex items-center gap-2">
                <AnimatedCounter value={available} prefix="$" className="font-bold text-[var(--success)] text-sm sm:text-base" />
                <button onClick={handleApplyCredit} disabled={creditButtonDisabled} className={`px-3 py-1 rounded-full text-xs font-medium text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--card-background)] focus:ring-[var(--success)] ${ creditButtonDisabled ? "bg-gray-400 dark:bg-gray-500 cursor-not-allowed opacity-50" : "bg-[var(--success)] hover:opacity-80" }`} title={ available <= 0 ? "No credit available" : effective <= 0 ? "No debt to offset" : `Apply ${formatCurrency(available)} credit` }>{isApplyingCredit ? "Applying..." : "Apply"}</button>
             </div>
           </div>
           {/* Feedback Message Area */}
           {showFeedback && ( <div className="mt-2 text-xs text-center text-[var(--success)] animate-pulse"> {feedbackMessage} </div> )}
        </div>
        {/* Section 3: Category Values Breakdown (Single Diverging Animated Bar) */}
        <div className="p-4 sm:p-6 border-b border-[var(--border-color)]">
            <h3 className="text-base sm:text-lg font-semibold text-[var(--card-foreground)] mb-4 text-center">Values Breakdown</h3>
            {Object.keys(targetCategoryBarData).length === 0 && (
               <p className="text-sm text-center text-[var(--muted-foreground)] py-4">{impactAnalysis ? "No category data available." : "Calculating..."}</p>
            )}
            <div className="space-y-3">
                {Object.entries(targetCategoryBarData)
                   .sort(([catA], [catB]) => catA.localeCompare(catB))
                   .map(([category, { score, tooltip }]) => { // Get score & tooltip from target data
                       // Get animated width from state (default to 0)
                       const animatedBarWidth = currentCategoryWidths[category] || 0;
                       // Get colors based on score
                       const { textColor, bgColor } = getScoreColorClasses(score);
                       const showPlusSign = score > 0.5;

                       return (
                           <div key={category} className="flex items-center justify-between gap-2 sm:gap-4">
                               {/* Category Name + Icon */}
                               <span className="flex-shrink-0 w-[110px] sm:w-[130px] inline-flex items-center text-[var(--card-foreground)] text-xs sm:text-sm truncate" title={category}>
                                   <span className="mr-1.5 sm:mr-2">{categoryIcons[category] || "❓"}</span>
                                   <span className="truncate">{category}</span>
                               </span>

                               {/* Single Diverging Bar Container */}
                               <div className="flex-grow h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full relative overflow-hidden" title={tooltip} >
                                   {/* Center Line */}
                                   <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-400 dark:bg-gray-500 transform -translate-x-1/2 z-10"></div>
                                   {/* Conditional Bar - Renders red OR green OR grey dot */}
                                   {score < -0.5 && (
                                       <div
                                           className={`absolute right-1/2 top-0 bottom-0 ${bgColor} rounded-l-full transition-all duration-500 ease-out`} // CSS transition
                                           style={{ width: `${animatedBarWidth}%` }} // Animated width
                                       ></div>
                                   )}
                                   {score > 0.5 && (
                                        <div
                                            className={`absolute left-1/2 top-0 bottom-0 ${bgColor} rounded-r-full transition-all duration-500 ease-out`} // CSS transition
                                            style={{ width: `${animatedBarWidth}%` }} // Animated width
                                        ></div>
                                   )}
                                   {score >= -0.5 && score <= 0.5 && animatedBarWidth < 1 && (
                                       <div className={`absolute left-1/2 top-1/2 w-1 h-1 ${bgColor} rounded-full transform -translate-x-1/2 -translate-y-1/2`} ></div>
                                   )}
                               </div>

                               {/* Animated Percentage Score Text */}
                               <div className={`flex-shrink-0 w-[45px] sm:w-[50px] text-right font-semibold text-xs sm:text-sm ${textColor} flex items-center justify-end`}>
                                    {showPlusSign && <span className="opacity-80">+</span>} {/* Conditional '+' */}
                                    <AnimatedCounter
                                        value={score} // The net score
                                        suffix="%"
                                        prefix="" // NO dollar sign
                                        decimalPlaces={0} // Rounded
                                        className="value-text-score" // Apply additional styling if needed
                                    />
                               </div>
                           </div>
                       );
                   })}
             </div>
          </div>

        


      </div> {/* End of card */}

      {/* Donation Modal */}
      {modalState.isOpen && ( <DonationModal isOpen={modalState.isOpen} practice={modalState.practice || ''} amount={modalState.amount || 0} onClose={closeDonationModal} /> )}
    </div> // End of sidebar container
  );
}