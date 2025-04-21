// src/features/dashboard/DashboardSidebar.tsx
import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useTransactionStore } from "@/store/transactionStore"; // Import AppStatus
import { AnimatedCounter } from "@/shared/ui/AnimatedCounter";
import { useCountUp } from '@/hooks/useCountUp';
import { DonationModal } from "@/features/charity/DonationModal";
import { useDonationModal } from "@/hooks/useDonationModal";
import { useAuth } from "@/hooks/useAuth";
import { calculationService } from "@/core/calculations/impactService";
import { ShareImpactButton } from './ShareImpactButton';


// --- Helper: Format Currency (Keep) ---
const formatCurrency = (value: number | null | undefined): string => `$${(value ?? 0).toFixed(2)}`;

// --- Helper: Tier Calculation (Keep) ---
const getTierInfo = (
    scoreRatio: number | null, totalPositiveImpact: number, totalNegativeImpact: number
): { name: string; description: string; colorClass: string; displayRatio?: number } => {
    if (totalNegativeImpact <= 0) {
        if (totalPositiveImpact > 0) return { name: "S", description: "Beacon of Virtue", colorClass: "text-white", displayRatio: undefined };
        return { name: " ", description: "No Impact Data", colorClass: "text-white", displayRatio: undefined };
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

// --- Sidebar Component ---
export function DashboardSidebar() {
  const { user } = useAuth();

  // --- State Selection (Updated) ---
  const isBankConnected = useTransactionStore(state => state.connectionStatus.isConnected);
  const transactions = useTransactionStore(state => state.transactions);
  const impactAnalysis = useTransactionStore(state => state.impactAnalysis);
  const appStatus = useTransactionStore(state => state.appStatus); // <-- Use appStatus
  const applyCreditAction = useTransactionStore(state => state.applyCredit); // <-- Rename action selector

  const { modalState, openDonationModal, closeDonationModal } = useDonationModal();

  // --- Local State ---
  const [isOverallAnimationReady, setIsOverallAnimationReady] = useState(false);
  const [currentAppliedPercentage, setCurrentAppliedPercentage] = useState(0);
  const overallAnimationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // --- Calculations ---
  // These dependencies on impactAnalysis are correct
  const applied = useMemo(() => isBankConnected ? (impactAnalysis?.appliedCredit ?? 0) : 0, [impactAnalysis, isBankConnected]);
  const effective = useMemo(() => isBankConnected ? (impactAnalysis?.effectiveDebt ?? 0) : 0, [impactAnalysis, isBankConnected]);
  const available = useMemo(() => isBankConnected ? (impactAnalysis?.availableCredit ?? 0) : 0, [impactAnalysis, isBankConnected]);
  const totalPositiveImpact = useMemo(() => isBankConnected ? (impactAnalysis?.positiveImpact ?? 0) : 0, [impactAnalysis, isBankConnected]);
  const totalNegativeImpact = useMemo(() => isBankConnected ? (impactAnalysis?.negativeImpact ?? 0) : 0, [impactAnalysis, isBankConnected]);

  const targetScoreRatio = useMemo(() => {
      if (!isBankConnected || !impactAnalysis || totalNegativeImpact <= 0) return null;
      // Score ratio should reflect potential offset (available + already applied)
      const totalPotentialOffset = applied + available;
      return Math.min(1, totalNegativeImpact === 0 ? 1 : totalPotentialOffset / totalNegativeImpact);
  }, [impactAnalysis, applied, available, totalNegativeImpact, isBankConnected]);

  const actualAppliedRatio = useMemo(() => {
        if (!isBankConnected || !impactAnalysis || totalNegativeImpact <= 0) return null;
        // Actual ratio is based only on what's been applied so far
        return totalNegativeImpact === 0 ? null : applied / totalNegativeImpact;
  }, [impactAnalysis, applied, totalNegativeImpact, isBankConnected]);


  const animatedAppliedRatioPercentString = useCountUp(
      isBankConnected && actualAppliedRatio !== null ? Math.max(0, actualAppliedRatio * 100) : 0,
      { duration: 2000, decimalPlaces: 1, easing: 'easeOut' }
  );

  const currentTierInfo = useMemo(() => {
      if (!isBankConnected) return getTierInfo(null, 0, 0);
      return getTierInfo(targetScoreRatio, totalPositiveImpact, totalNegativeImpact);
  }, [targetScoreRatio, totalPositiveImpact, totalNegativeImpact, isBankConnected]);


  const topCardBackgroundClass = useMemo(() => {
       if (!isBankConnected || !impactAnalysis) return "bg-gray-400 dark:bg-gray-600";
       if (totalNegativeImpact <= 0) { return totalPositiveImpact > 0 ? "bg-sky-500 dark:bg-sky-700" : "bg-gray-400 dark:bg-gray-600"; }
       const ratio = targetScoreRatio ?? 0;
       if (ratio >= 1.0) return "bg-green-500 dark:bg-green-700"; // S
       if (ratio >= 0.75) return "bg-lime-500 dark:bg-lime-700"; // A
       if (ratio >= 0.50) return "bg-yellow-400 dark:bg-yellow-600"; // B
       if (ratio >= 0.35) return "bg-amber-400 dark:bg-amber-600"; // C
       if (ratio >= 0.20) return "bg-orange-500 dark:bg-orange-700"; // D
       return "bg-red-600 dark:bg-red-800"; // F
   }, [impactAnalysis, totalNegativeImpact, totalPositiveImpact, targetScoreRatio, isBankConnected]);

  const targetAppliedPercentage = useMemo(() => {
      if (!isBankConnected || totalNegativeImpact <= 0) return (effective <= 0 ? 100 : 0);
      return Math.min(100, Math.max(0,(applied / totalNegativeImpact) * 100));
  }, [applied, totalNegativeImpact, effective, isBankConnected]);

  const progressBarTrackColor = effective > 0 ? 'bg-red-200 dark:bg-red-900' : 'bg-green-200 dark:bg-green-900';


   // --- MODIFIED: Data for Share Button ---
    const categoryDataForSharing = useMemo(() => {
        if (!isBankConnected || !transactions || transactions.length === 0 || !impactAnalysis) return {};

        const catImpacts = calculationService.calculateCategoryImpacts(transactions);
        const sharingData: Record<string, { score: number }> = {};
        const definedCategories = ["Environment", "Labor Ethics", "Animal Welfare", "Political Ethics", "Transparency", "Digital Rights"];

        definedCategories.forEach(category => {
            const values = catImpacts[category] || { positiveImpact: 0, negativeImpact: 0, totalSpent: 0 };
            const { positiveImpact, negativeImpact } = values;
            const score = positiveImpact - negativeImpact;

            if (Math.abs(score) > 0.01) {
                sharingData[category] = { score };
            }
        });
        return sharingData;
    }, [transactions, isBankConnected, impactAnalysis]);

  // --- Effects ---
  useEffect(() => {
     if (!isBankConnected) { setIsOverallAnimationReady(false); setCurrentAppliedPercentage(0); return; }
     const timeoutId = overallAnimationTimeoutRef.current;
     if (timeoutId) clearTimeout(timeoutId);
     if (impactAnalysis !== null) {
       overallAnimationTimeoutRef.current = setTimeout(() => {
         setCurrentAppliedPercentage(targetAppliedPercentage);
         setIsOverallAnimationReady(true);
       }, 50);
     } else {
       setIsOverallAnimationReady(false);
       setCurrentAppliedPercentage(0);
     }
     return () => { if (overallAnimationTimeoutRef.current) clearTimeout(overallAnimationTimeoutRef.current); };
   }, [targetAppliedPercentage, impactAnalysis, isBankConnected]);


  // --- Action Handlers (Updated) ---
   const handleApplyCredit = useCallback(async () => {
     // Check appStatus instead of isApplyingCredit flag
     if (!user || appStatus === 'applying_credit' || impactAnalysis === null || available <= 0 || effective <= 0) return;
     try {
       const amountToApply = Math.min(available, effective);
       if (amountToApply > 0) {
         // Call the action from the store
         await applyCreditAction(amountToApply);
       }
       else { console.log("Apply Credit: No amount to apply."); }
     } catch (error) { console.error("Error applying credit:", error); }
   }, [applyCreditAction, user, impactAnalysis, available, effective, appStatus]); // Depend on appStatus

  const handleOpenOffsetModal = useCallback(() => {
      const amountToPotentiallyOffset = Math.max(0, effective);
      openDonationModal("All Societal Debt", amountToPotentiallyOffset);
  }, [openDonationModal, effective]);


  // --- Conditional Button Logic (Updated) ---
  const getActionButton = () => {
     const isBusy = appStatus !== 'idle' && appStatus !== 'error'; // General busy check
     const isApplying = appStatus === 'applying_credit'; // Specific check for applying

     if (!isBankConnected) { return ( <button disabled className="w-full px-4 py-2 rounded-lg text-sm font-semibold bg-gray-400 dark:bg-gray-500 text-white opacity-50 cursor-not-allowed"> Connect Bank </button> ); }

     // Show generic loading/busy state if analysis isn't ready or app is busy (except applying)
     if (impactAnalysis === null || (isBusy && !isApplying)) { return ( <button disabled className="w-full px-4 py-2 rounded-lg text-sm font-semibold bg-gray-400 dark:bg-gray-500 text-white opacity-50 cursor-not-allowed"> {appStatus === 'initializing' ? 'Initializing...' : 'Processing...'} </button> ); }

     // Apply Credit Button Logic
     if (available > 0 && effective > 0) { return ( <button onClick={handleApplyCredit} disabled={isApplying} className={`w-full px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--card-background)] focus:ring-[var(--success)] ${ isApplying ? "bg-gray-400 dark:bg-gray-500 cursor-not-allowed" : "bg-[var(--success)] hover:opacity-80" }`} title={`Apply ${formatCurrency(available)} credit`}> {isApplying ? "Applying..." : `Apply Credit (${formatCurrency(available)})`} </button> ); }

     // Offset Remaining Debt Button Logic
     if (available <= 0 && effective > 0) { return ( <button onClick={handleOpenOffsetModal} disabled={isBusy} className={`w-full px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--card-background)] focus:ring-green-500 ${isBusy ? "bg-gray-400 dark:bg-gray-500 cursor-not-allowed" : "bg-green-600 hover:bg-green-700"}`} title={`Offset ${formatCurrency(effective)} remaining debt`}> Offset Remaining Debt ({formatCurrency(effective)}) </button> ); }

     // Donate Button Logic (when debt is zero or negative)
     if (effective <= 0) { return ( <button onClick={handleOpenOffsetModal} disabled={isBusy} className={`w-full px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--card-background)] focus:ring-blue-500 ${isBusy ? "bg-gray-400 dark:bg-gray-500 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"}`} title="Make an additional donation"> Donate to Offset Impact </button> ); }

     // Fallback disabled button
     return ( <button disabled className="w-full px-4 py-2 rounded-lg text-sm font-semibold bg-gray-400 dark:bg-gray-500 text-white opacity-50 cursor-not-allowed"> Calculating... </button> );
  };

  // --- Render Logic ---
  return (
    <div className="w-full lg:col-span-1 min-h-[100px] lg:min-h-0">
      <div className="card mb-6 h-full flex flex-col">
        {/* Section 1: Tier Display & Share Button */}
        <div className={`${topCardBackgroundClass} transition-colors duration-2000 p-4 sm:p-6 rounded-t-xl`}>
             <div className="text-center mb-3">
                 <h2 className={`text-4xl sm:text-5xl font-bold tracking-tight drop-shadow-md ${currentTierInfo.colorClass} transition-colors duration-2000 ease-in-out`}> {currentTierInfo.name || "---"} </h2>
                 <p className={`text-sm font-medium ${currentTierInfo.colorClass === 'text-white' ? 'text-white opacity-90' : 'text-gray-200'} mt-1`}> {isBankConnected ? currentTierInfo.description : "Connect Bank"} </p>
                 {isBankConnected && actualAppliedRatio !== null && impactAnalysis !== null && ( <p className={`text-xs ${currentTierInfo.colorClass === 'text-white' ? 'text-white opacity-70' : 'text-gray-300'}`}> (<span className="font-semibold">{animatedAppliedRatioPercentString}</span>% Offset) </p> )}
             </div>
             {/* --- Share Button Rendering (Ensured it uses calculated data) --- */}
             {isBankConnected && impactAnalysis && (
                 <ShareImpactButton
                    categoryData={categoryDataForSharing} // Pass the calculated data
                    overallRatio={actualAppliedRatio} // Use actual applied ratio for sharing score
                    totalPositiveImpact={totalPositiveImpact}
                    className="mt-2"
                 />
              )}
        </div>

        {/* Conditionally Rendered Content Wrapper */}
        {isBankConnected && (
           <div className={`flex-grow flex flex-col`}>
                {/* Section 2: Overall Progress Bar */}
                {/* Show progress bar only if analysis is done and app is not in an error state */}
                {impactAnalysis !== null && appStatus !== 'error' ? (
                    <div className="p-4 space-y-2 border-b border-[var(--border-color)]">
                        <div className="flex justify-between text-xs sm:text-sm mb-1">
                            <span className="font-medium text-[var(--muted-foreground)]">Applied Credit</span>
                            <span className="font-medium text-[var(--muted-foreground)]"> {effective > 0 ? 'Remaining Debt' : (totalNegativeImpact > 0 ? 'Debt Offset' : 'Net Positive')} </span>
                        </div>
                        <div className={`w-full ${progressBarTrackColor} rounded-full h-3 overflow-hidden relative transition-colors duration-2000`}>
                            <div className="bg-[var(--success)] h-3 rounded-l-full absolute top-0 left-0 transition-all duration-2000 ease-out" style={{ width: isOverallAnimationReady ? `${currentAppliedPercentage}%` : '0%' }} title={`Applied: ${formatCurrency(applied)}`} />
                        </div>
                        <div className="flex justify-between text-xs sm:text-sm">
                            <AnimatedCounter value={applied} prefix="$" className="font-semibold text-[var(--success)]" decimalPlaces={2} />
                            <span className={`font-semibold ${effective > 0 ? 'text-[var(--destructive)]' : 'text-[var(--success)]'}`} title={effective > 0 ? `Remaining Debt: ${formatCurrency(effective)}` : (totalNegativeImpact > 0 ? 'All Debt Offset' : `Net Positive Impact: ${formatCurrency(Math.abs(effective))}`)}> {formatCurrency(effective)} </span>
                        </div>
                    </div>
                ) : (
                    // Show placeholder or loading message if analysis not ready or error occurred
                     <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400 border-b border-[var(--border-color)]">
                        {appStatus === 'error' ? 'Error loading data' : 'Calculating progress...'}
                     </div>
                )}

               {/* Section 3: Available Credit & Action Button */}
               <div className="p-4 space-y-3">
                   {/* Show available credit only if analysis is done, no error, and credit > 0 */}
                   {impactAnalysis !== null && appStatus !== 'error' && available > 0 && (
                       <div className="flex items-center justify-between">
                           <span className="text-[var(--muted-foreground)] text-sm sm:text-base">Available Credit</span>
                           <AnimatedCounter value={available} prefix="$" className="font-bold text-[var(--success)] text-sm sm:text-base" decimalPlaces={2}/>
                       </div>
                   )}

                   <div className="pt-2">
                      {getActionButton()}
                   </div>
               </div>

           </div>
        )}
        {!isBankConnected && ( <div className="p-6 text-center text-gray-500 dark:text-gray-400 text-sm"> Connect your bank account to see your impact analysis. </div> )}
      </div>

      {/* Donation Modal */}
      {modalState.isOpen && ( <DonationModal isOpen={modalState.isOpen} practice={modalState.practice || ''} amount={modalState.amount || 0} onClose={closeDonationModal} /> )}
    </div>
  );
}