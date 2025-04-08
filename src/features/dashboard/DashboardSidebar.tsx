// src/tsx/features/dashboard/DashboardSidebar.tsx
import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useTransactionStore } from "@/store/transactionStore";
import { AnimatedCounter } from "@/shared/ui/AnimatedCounter";
import { DonationModal } from "@/features/charity/DonationModal";
import { useDonationModal } from "@/hooks/useDonationModal";
import { useAuth } from "@/hooks/useAuth";

// Helper function to determine the tier based on the score ratio
const getTierInfo = (appliedCredit: number, totalPositiveImpact: number, totalNegativeImpact: number, effectiveDebt: number): { name: string; description: string; colorClass: string; ratio?: number } => {
  if (effectiveDebt <= 0 && (appliedCredit > 0 || totalPositiveImpact > 0)) {
      return { name: "S", description: "The Paradigm Dissolver", colorClass: "text-cyan-400" };
  }
  if (totalNegativeImpact <= 0 && appliedCredit <= 0 && totalPositiveImpact <= 0) {
      return { name: "N", description: "Neutral / No Data", colorClass: "text-gray-500" };
  }
   if (totalNegativeImpact <= 0) {
      return { name: "S", description: "Impact Positive", colorClass: "text-cyan-400" };
   }
  const scoreRatio = appliedCredit / totalNegativeImpact;
  if (scoreRatio >= 1.0) return { name: "A+", description: "Transformative Steward", ratio: scoreRatio, colorClass: "text-green-500" };
  if (scoreRatio >= 0.75) return { name: "A", description: "Conscious Cultivator", ratio: scoreRatio, colorClass: "text-lime-500" };
  if (scoreRatio >= 0.50) return { name: "B", description: "Mindful Participant", ratio: scoreRatio, colorClass: "text-yellow-500" };
  if (scoreRatio >= 0.25) return { name: "C", description: "Awakening Consumer", ratio: scoreRatio, colorClass: "text-amber-500" };
  if (scoreRatio >= 0.10) return { name: "D", description: "Passive Participant", ratio: scoreRatio, colorClass: "text-orange-500" };
  if (scoreRatio >= 0) return { name: "F", description: "Willfully Negligent", ratio: scoreRatio, colorClass: "text-red-500" };
  return { name: "F", description: "Willfully Negligent", ratio: scoreRatio, colorClass: "text-red-500" };
};


export function DashboardSidebar() {
  const { user } = useAuth();
  // Destructure necessary state and actions from the store
  const { impactAnalysis, applyCredit, isApplyingCredit } = useTransactionStore();
  const { modalState, openDonationModal, closeDonationModal } = useDonationModal();

  // Local component state
  const [isAnimationReady, setIsAnimationReady] = useState(false);
  const [currentAppliedPercentage, setCurrentAppliedPercentage] = useState(0);
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [showFeedback, setShowFeedback] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string>("");
  const [topCardBackgroundClass, setTopCardBackgroundClass] = useState<string>("bg-gray-500");

  // --- Calculations ---
  const applied = impactAnalysis?.appliedCredit ?? 0;
  const effective = impactAnalysis?.effectiveDebt ?? 0;
  const available = impactAnalysis?.availableCredit ?? 0;
  const totalPositiveImpact = impactAnalysis?.positiveImpact ?? 0;
  const totalNegativeImpact = impactAnalysis?.negativeImpact ?? 0;

  // Memoize tier calculation
  const tierInfo = useMemo(() => {
    if (!impactAnalysis) {
       return { name: "?", description: "Calculating...", colorClass: "text-gray-500" };
    }
    return getTierInfo(applied, totalPositiveImpact, totalNegativeImpact, effective);
  }, [impactAnalysis, applied, totalPositiveImpact, totalNegativeImpact, effective]);

  // Memoize progress bar calculation
  const targetAppliedPercentage = useMemo(() => {
      const totalProgress = applied + effective;
      return totalProgress > 0
        ? Math.min((applied / totalProgress) * 100, 100)
        : (effective <= 0 ? 100 : 0);
  }, [applied, effective]);


  const progressBarTrackColor = effective > 0
    ? 'bg-red-200 dark:bg-red-900'
    : 'bg-green-200 dark:bg-green-900';

  // --- Effects ---
  // Update top card background based on effective debt
  useEffect(() => {
    if (!impactAnalysis) {
       setTopCardBackgroundClass("bg-[var(--secondary)] text-[var(--secondary-foreground)]");
       return;
    }
    if (effective <= 0) setTopCardBackgroundClass("bg-[var(--success)] text-[var(--success-foreground)]");
    else if (effective < 50) setTopCardBackgroundClass("bg-[var(--warning)] text-[var(--warning-foreground)]");
    else setTopCardBackgroundClass("bg-[var(--destructive)] text-[var(--destructive-foreground)]");
  }, [impactAnalysis, effective]);

  // Effect for progress bar animation timing
  useEffect(() => {
    if (animationTimeoutRef.current) clearTimeout(animationTimeoutRef.current);
    if (impactAnalysis) { // Run when analysis data is available
      // Use timeout to ensure initial 0% renders before transition starts
      animationTimeoutRef.current = setTimeout(() => {
        setCurrentAppliedPercentage(targetAppliedPercentage);
        setIsAnimationReady(true);
      }, 50);
    } else { // Reset if data disappears
      setIsAnimationReady(false);
      setCurrentAppliedPercentage(0);
    }
    // Cleanup timeout
    return () => { if (animationTimeoutRef.current) clearTimeout(animationTimeoutRef.current); };
  // Rerun if the target percentage changes
  }, [targetAppliedPercentage, impactAnalysis]);

  // --- Action Handlers ---
  // Memoize credit button disabled state calculation
   const creditButtonDisabled: boolean = useMemo(() => {
       return !impactAnalysis || available <= 0 || isApplyingCredit || effective <= 0;
   }, [impactAnalysis, available, isApplyingCredit, effective]);

  // --- FULL handleApplyCredit IMPLEMENTATION ---
  const handleApplyCredit = useCallback(async () => {
    // Log entry and state values BEFORE the check
    console.log("handleApplyCredit: Clicked! Attempting to apply...", {
        amountToApplyAttempt: available, // Log the intended amount (full available)
        available: impactAnalysis?.availableCredit,
        effectiveDebt: impactAnalysis?.effectiveDebt,
        isApplying: isApplyingCredit,
        calculatedDisabled: creditButtonDisabled, // Log the calculated disabled state
        userExists: !!user
    });

    // Condition check
    if (!user || creditButtonDisabled || !impactAnalysis || available <= 0) {
        console.warn("handleApplyCredit: Skipping - Check conditions failed", {
            userExists: !!user,
            creditButtonDisabled,
            impactAnalysisExists: !!impactAnalysis,
            available
        });
        return; // Stop execution if checks fail
    }

    // Proceed if checks pass
    try {
      const amountToApply = available; // Apply the full available amount
      console.log(`handleApplyCredit: Proceeding to call store applyCredit action with amount: ${amountToApply}`);
      const success = await applyCredit(amountToApply, user.uid); // Call the store action
      console.log(`handleApplyCredit: Store action returned: ${success}`);

      // Update feedback state based on success
      setFeedbackMessage(success ? `Applied ${formatCurrency(amountToApply)} credit.` : "Failed to apply credit.");
      setShowFeedback(true);
      setTimeout(() => setShowFeedback(false), 3000); // Hide feedback after 3s

    } catch (error) {
      console.error("Error during handleApplyCredit:", error);
      setFeedbackMessage("An error occurred while applying credit.");
      setShowFeedback(true);
      setTimeout(() => setShowFeedback(false), 3000);
    }
  // Ensure ALL dependencies used inside are listed
  }, [applyCredit, user, impactAnalysis, available, creditButtonDisabled, isApplyingCredit]); // Added isApplyingCredit to dependencies

  const handleOffsetAll = useCallback(() => {
    if (effective > 0) openDonationModal("All Societal Debt", effective);
  }, [openDonationModal, effective]);

  const formatCurrency = (value: number): string => `$${value.toFixed(2)}`;

  // --- Render ---
  return (
    <div className="w-full lg:col-span-1">
      <div className="card mb-6">
        {/* Top Color Section */}
        <div className={`${topCardBackgroundClass} transition-colors duration-500 p-4 sm:p-6 rounded-t-xl`}>
          <div className="text-center">
            {/* Tier Display */}
            <div className="mb-2">
              <span className="text-sm font-medium opacity-80 uppercase tracking-wider">Your Rating</span>
              <h2 className={`text-4xl sm:text-5xl font-bold tracking-tight text-white drop-shadow-md`}>
                 {tierInfo.name}
              </h2>
              <p className="text-sm font-medium text-white opacity-90 mt-1">{tierInfo.description}</p>
               {tierInfo.ratio !== undefined && isFinite(tierInfo.ratio) && tierInfo.ratio >= 0 && (
                 <p className="text-xs text-white opacity-70">({(tierInfo.ratio * 100).toFixed(0)}% Offset)</p>
               )}
            </div>
            {/* Offset Button */}
            {effective > 0 && (
              <button
                onClick={handleOffsetAll}
                className="mt-4 bg-white/80 hover:bg-white text-black px-4 sm:px-6 py-2 rounded-lg font-bold shadow transition-colors text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-white"
              >
                Offset Debt ({formatCurrency(effective)})
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar Section */}
        <div className="p-4 space-y-2 border-b border-[var(--border-color)]">
          <div className="flex justify-between text-xs sm:text-sm mb-1">
            <span className="font-medium text-[var(--muted-foreground)]">Applied Credit</span>
            <span className="font-medium text-[var(--muted-foreground)]">Effective Debt</span>
          </div>
          <div className={`w-full ${progressBarTrackColor} rounded-full h-3 overflow-hidden relative transition-colors duration-500`}>
            <div
              className="bg-[var(--success)] h-3 rounded-l-full transition-all duration-500 ease-in-out absolute top-0 left-0"
              style={{ width: isAnimationReady ? `${currentAppliedPercentage}%` : '0%' }}
            />
          </div>
          <div className="flex justify-between text-xs sm:text-sm">
             <AnimatedCounter value={applied} prefix="$" className="font-semibold text-[var(--success)]" />
             <span className={`font-semibold ${effective > 0 ? 'text-[var(--destructive)]' : 'text-[var(--success)]'}`}> {formatCurrency(effective)} </span>
          </div>
        </div>

        {/* Credit summary */}
        <div className="p-4">
           <div className="flex flex-col">
             <div className="flex items-center justify-between">
               <div> <span className="text-[var(--muted-foreground)] text-sm sm:text-base"> Available Credit </span> </div>
               <div className="flex items-center">
                 <AnimatedCounter value={available} prefix="$" className="font-bold text-[var(--success)] mr-2 text-sm sm:text-base" />
                 {/* Apply Button with onClick attached */}
                 <button
                    onClick={handleApplyCredit} // Ensure onClick is correctly assigned
                    disabled={creditButtonDisabled} // Disable based on calculated state
                    className={`px-3 py-1 rounded-full text-xs font-medium text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--card-background)] focus:ring-[var(--success)] ${ creditButtonDisabled ? "bg-gray-400 dark:bg-gray-500 cursor-not-allowed opacity-50" : "bg-[var(--success)] hover:opacity-80" }`} // Added opacity-50 when disabled
                    title={ available <= 0 ? "No credit available" : effective <= 0 ? "No debt to offset" : "Apply credit to reduce your social debt" } >
                   {isApplyingCredit ? "Applying..." : "Apply"}
                 </button>
               </div>
             </div>
           </div>
           {showFeedback && ( <div className="mt-2 text-xs text-[var(--success)] animate-pulse"> {feedbackMessage} </div> )}
        </div>
      </div>

      {/* Donation Modal */}
      {modalState.isOpen && (
        <DonationModal {...modalState} practice={modalState.practice || ''} amount={modalState.amount || 0} onClose={closeDonationModal} />
      )}
    </div>
  );
}