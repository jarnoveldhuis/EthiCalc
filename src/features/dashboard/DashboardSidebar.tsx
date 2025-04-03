// src/features/dashboard/DashboardSidebar.tsx
import { useState, useCallback, useEffect, useRef } from "react"; // Added useRef
import { useTransactionStore } from "@/store/transactionStore";
import { AnimatedCounter } from "@/shared/ui/AnimatedCounter";
import { DonationModal } from "@/features/charity/DonationModal";
import { useDonationModal } from "@/hooks/useDonationModal";
import { useAuth } from "@/hooks/useAuth";

export function DashboardSidebar() {
  const { user } = useAuth();
  const { impactAnalysis, applyCredit, isApplyingCredit } = useTransactionStore();
  const { modalState, openDonationModal, closeDonationModal } = useDonationModal();

  // --- State for Animation Control ---
  // Start with animation ready state as false
  const [isAnimationReady, setIsAnimationReady] = useState(false);
  // Store the calculated percentage separately to apply after mount
  const [currentAppliedPercentage, setCurrentAppliedPercentage] = useState(0);
  // Ref to prevent running effect multiple times unnecessarily on fast updates
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // --- End State for Animation Control ---


  const [showFeedback, setShowFeedback] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string>("");
  const [topCardBackgroundClass, setTopCardBackgroundClass] = useState<string>("bg-gray-500");

  // --- Calculations ---
  const applied = impactAnalysis?.appliedCredit ?? 0;
  const effective = impactAnalysis?.effectiveDebt ?? 0;
  const available = impactAnalysis?.availableCredit ?? 0;
  const totalProgress = applied + effective;
  // Calculate the target percentage
  const targetAppliedPercentage = totalProgress > 0
      ? Math.min((applied / totalProgress) * 100, 100)
      : (effective <= 0 ? 100 : 0);

  const progressBarTrackColor = effective > 0
    ? 'bg-red-200 dark:bg-red-900'
    : 'bg-green-200 dark:bg-green-900';

  // --- Effects ---
  // Update top card background
  useEffect(() => {
    if (!impactAnalysis) {
      setTopCardBackgroundClass("bg-[var(--secondary)] text-[var(--secondary-foreground)]");
      return;
    }
    const currentEffectiveDebt = impactAnalysis.effectiveDebt ?? 0;
    if (currentEffectiveDebt <= 0) setTopCardBackgroundClass("bg-[var(--success)] text-[var(--success-foreground)]");
    else if (currentEffectiveDebt < 50) setTopCardBackgroundClass("bg-[var(--warning)] text-[var(--warning-foreground)]");
    else setTopCardBackgroundClass("bg-[var(--destructive)] text-[var(--destructive-foreground)]");
  }, [impactAnalysis]);

  // Effect to handle the progress bar animation initialization and updates
  useEffect(() => {
    // Clear any previous timeout to handle rapid updates
    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current);
    }

    // Only proceed if impactAnalysis data is available
    if (impactAnalysis) {
       // Use a minimal timeout (or requestAnimationFrame) to allow the initial render
       // with 0% width before applying the actual percentage and starting the transition.
      animationTimeoutRef.current = setTimeout(() => {
        setCurrentAppliedPercentage(targetAppliedPercentage); // Set the actual percentage
        setIsAnimationReady(true); // Mark that the animation can now run
      }, 50); // 50ms delay - adjust if needed
    } else {
      // Reset if data is not available
      setIsAnimationReady(false);
      setCurrentAppliedPercentage(0);
    }

    // Cleanup timeout on unmount or before next run
    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
    };
  // Depend only on the target percentage value derived from impactAnalysis
  }, [targetAppliedPercentage, impactAnalysis]); // Rerun when target % changes or impactAnalysis loads


  // --- Action Handlers ---
  const creditButtonDisabled: boolean = !impactAnalysis || available <= 0 || isApplyingCredit || effective <= 0;

  const handleApplyCredit = useCallback(async () => {
    // (Keep existing apply credit logic)
    if (!user || creditButtonDisabled || !impactAnalysis || available <= 0) return;
    try {
      const amountToApply = available;
      const success = await applyCredit(amountToApply, user.uid);
      // Reset animation ready state briefly to re-trigger animation on update
      // setIsAnimationReady(false); // Commented out: let the useEffect handle percentage update naturally
      setFeedbackMessage(success ? `Applied ${formatCurrency(amountToApply)} credit.` : "Failed to apply credit.");
      setShowFeedback(true);
      setTimeout(() => setShowFeedback(false), 3000);
    } catch (error) {
      console.error("Error applying credit:", error);
      setFeedbackMessage("Failed to apply credit.");
      setShowFeedback(true);
      setTimeout(() => setShowFeedback(false), 3000);
    }
  }, [applyCredit, user, impactAnalysis, available, creditButtonDisabled]);

  const handleOffsetAll = useCallback(() => {
    if (effective > 0) openDonationModal("All Societal Debt", effective);
  }, [openDonationModal, effective]);

  // Helper to format currency
  const formatCurrency = (value: number): string => `$${value.toFixed(2)}`;

  // --- Render ---
  return (
    <div className="w-full lg:col-span-1">
      <div className="card mb-6">
        <div className={`${topCardBackgroundClass} transition-colors duration-500 p-4 sm:p-6 rounded-t-xl`}>
          {/* Top Card Content... */}
           <div className="text-center">
             <h2 className="text-lg sm:text-xl font-bold mb-1 opacity-90">
               Effective Social Debt
             </h2>
             <AnimatedCounter
               value={effective}
               prefix="$"
               className="text-4xl sm:text-5xl font-black mb-2"
             />
              <div className="text-sm opacity-80">
                Credit applied: {formatCurrency(applied)}
              </div>
             {effective > 0 && (
               <button
                 onClick={handleOffsetAll}
                 className="mt-4 bg-white/80 hover:bg-white text-black px-4 sm:px-6 py-2 rounded-lg font-bold shadow transition-colors text-sm sm:text-base"
               >
                 Offset Debt
               </button>
             )}
           </div>
        </div>

        {/* Progress Bar Section */}
        <div className="p-4 space-y-2 border-b border-[var(--border-color)]">
          <div className="flex justify-between text-xs sm:text-sm mb-1">
            <span className="font-medium text-[var(--muted-foreground)]">Applied Credit</span>
            <span className="font-medium text-[var(--muted-foreground)]">Remaining Debt</span>
          </div>

          {/* Progress Bar Container */}
          <div className={`w-full ${progressBarTrackColor} rounded-full h-3 overflow-hidden relative transition-colors duration-500`}>
            {/* Applied Credit Bar (Foreground) */}
            <div
              className="bg-[var(--success)] h-3 rounded-l-full transition-all duration-500 ease-in-out absolute top-0 left-0"
              // Apply width based on animation readiness
              style={{ width: isAnimationReady ? `${currentAppliedPercentage}%` : '0%' }}
            />
          </div>
          <div className="flex justify-between text-xs sm:text-sm">
            <span className="font-semibold text-[var(--success)]">{formatCurrency(applied)}</span>
            <span className={`font-semibold ${effective > 0 ? 'text-[var(--destructive)]' : 'text-[var(--success)]'}`}>
              {formatCurrency(effective)}
            </span>
          </div>
        </div>

        {/* Credit summary */}
        <div className="p-4">
            {/* Apply Button Section... */}
            <div className="flex flex-col">
             <div className="flex items-center justify-between">
               <div>
                 <span className="text-[var(--muted-foreground)] text-sm sm:text-base">
                   Available Credit
                 </span>
               </div>
               <div className="flex items-center">
                 <span className="font-bold text-[var(--success)] mr-2 text-sm sm:text-base">
                   {formatCurrency(available)}
                 </span>
                 <button
                   onClick={handleApplyCredit}
                   disabled={creditButtonDisabled}
                   className={`px-3 py-1 rounded-full text-xs text-white transition-colors ${
                     creditButtonDisabled
                       ? "bg-gray-400 dark:bg-gray-500 cursor-not-allowed"
                       : "bg-[var(--success)] hover:opacity-80"
                   }`}
                   title={ /* Tooltip logic... */
                     available <= 0 ? "No credit available"
                     : effective <= 0 ? "No debt to offset"
                     : "Apply credit to reduce your social debt"
                   }
                 >
                   {isApplyingCredit ? "Applying..." : "Apply"}
                 </button>
               </div>
             </div>
           </div>
           {showFeedback && (
             <div className="mt-2 text-xs text-[var(--success)] animate-pulse">
               {feedbackMessage}
             </div>
           )}
        </div>
      </div>

      {/* Donation Modal */}
      {modalState.isOpen && (
        <DonationModal
          practice={modalState.practice}
          amount={modalState.amount}
          isOpen={modalState.isOpen}
          onClose={closeDonationModal}
        />
      )}
    </div>
  );
}