// src/features/dashboard/DashboardSidebar.jsx
import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useTransactionStore } from "@/store/transactionStore";
import { AnimatedCounter } from "@/shared/ui/AnimatedCounter";
import { useCountUp } from '@/hooks/useCountUp';
import { DonationModal } from "@/features/charity/DonationModal";
import { useDonationModal } from "@/hooks/useDonationModal";
import { useAuth } from "@/hooks/useAuth";
import { calculationService } from "@/core/calculations/impactService"; // Needed for calculations
import { ShareImpactButton } from './ShareImpactButton';

// --- Category Icons (Needed for commented out section & potential future use) ---
const categoryIcons: Record<string, string> = {
    Environment: "🌱", "Labor Ethics": "⚖️", "Animal Welfare": "🐮",
    "Political Ethics": "🗳️", Transparency: "🔍", "Default Category": "❓"
};

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

// --- Helper: Score Colors (Needed for commented out section) ---
const getScoreColorClasses = (score: number): { textColor: string; bgColor: string } => {
    const positiveThreshold = 1; const negativeThreshold = -1;
    if (score > positiveThreshold) return { textColor: "text-[var(--success)]", bgColor: "bg-[var(--success)]" };
    if (score < negativeThreshold) return { textColor: "text-[var(--destructive)]", bgColor: "bg-[var(--destructive)]" };
    return { textColor: "text-[var(--muted-foreground)]", bgColor: "bg-gray-400 dark:bg-gray-500" };
};

// --- Sidebar Component ---
export function DashboardSidebar() {
  const { user } = useAuth();

  // --- State Selection (Split Selectors) ---
  const isBankConnected = useTransactionStore(state => state.connectionStatus.isConnected);
  const transactions = useTransactionStore(state => state.transactions);
  const impactAnalysis = useTransactionStore(state => state.impactAnalysis);
  const applyCredit = useTransactionStore(state => state.applyCredit);
  const isApplyingCredit = useTransactionStore(state => state.isApplyingCredit);

  const { modalState, openDonationModal, closeDonationModal } = useDonationModal();

  // --- Local State ---
  const [isOverallAnimationReady, setIsOverallAnimationReady] = useState(false);
  const [currentAppliedPercentage, setCurrentAppliedPercentage] = useState(0);
  const overallAnimationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // --- Calculations ---
  const applied = useMemo(() => isBankConnected ? (impactAnalysis?.appliedCredit ?? 0) : 0, [impactAnalysis, isBankConnected]);
  const effective = useMemo(() => isBankConnected ? (impactAnalysis?.effectiveDebt ?? 0) : 0, [impactAnalysis, isBankConnected]);
  const available = useMemo(() => isBankConnected ? (impactAnalysis?.availableCredit ?? 0) : 0, [impactAnalysis, isBankConnected]);
  const totalPositiveImpact = useMemo(() => isBankConnected ? (impactAnalysis?.positiveImpact ?? 0) : 0, [impactAnalysis, isBankConnected]);
  const totalNegativeImpact = useMemo(() => isBankConnected ? (impactAnalysis?.negativeImpact ?? 0) : 0, [impactAnalysis, isBankConnected]);

  const targetScoreRatio = useMemo(() => {
      if (!isBankConnected || !impactAnalysis || totalNegativeImpact <= 0) return null;
      const totalPotentialOffset = applied + available;
      return Math.min(1, totalNegativeImpact === 0 ? 1 : totalPotentialOffset / totalNegativeImpact);
  }, [impactAnalysis, applied, available, totalNegativeImpact, isBankConnected]);

  const actualAppliedRatio = useMemo(() => {
        if (!isBankConnected || !impactAnalysis || totalNegativeImpact <= 0) return null;
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
       if (ratio >= 1.0) return "bg-green-500 dark:bg-green-700";
       if (ratio >= 0.75) return "bg-lime-500 dark:bg-lime-700";
       if (ratio >= 0.50) return "bg-yellow-400 dark:bg-yellow-600";
       if (ratio >= 0.35) return "bg-amber-400 dark:bg-amber-600";
       if (ratio >= 0.20) return "bg-orange-500 dark:bg-orange-700";
       return "bg-red-600 dark:bg-red-800";
   }, [impactAnalysis, totalNegativeImpact, totalPositiveImpact, targetScoreRatio, isBankConnected]);

  const targetAppliedPercentage = useMemo(() => {
      if (!isBankConnected || totalNegativeImpact <= 0) return (effective <= 0 ? 100 : 0);
      return Math.min(100, Math.max(0,(applied / totalNegativeImpact) * 100));
  }, [applied, totalNegativeImpact, effective, isBankConnected]);

  const progressBarTrackColor = effective > 0 ? 'bg-red-200 dark:bg-red-900' : 'bg-green-200 dark:bg-green-900';

    // --- Calculation for commented out section & Share Button ---
    /*
    const targetCategoryBarData = useMemo(() => { ... }); // Commented out
    */
   // --- MODIFIED: Data for Share Button ---
    const categoryDataForSharing = useMemo(() => {
        if (!isBankConnected || !transactions || transactions.length === 0 || !impactAnalysis) return {};

        // Reuse calculation logic to get category impacts
        const catImpacts = calculationService.calculateCategoryImpacts(transactions);
        const sharingData: Record<string, { score: number }> = {};
        // Use defined categories or keys from catImpacts
        const definedCategories = ["Environment", "Labor Ethics", "Animal Welfare", "Political Ethics", "Transparency"];

        definedCategories.forEach(category => {
            const values = catImpacts[category] || { positiveImpact: 0, negativeImpact: 0, totalSpent: 0 };
            const { positiveImpact, negativeImpact } = values;

            // Calculate a score (e.g., net impact as percentage of total *negative* impact?)
            // Or simply net impact? Let's use net impact for simplicity in sharing.
            // You can adjust the score calculation logic here as needed.
            const score = positiveImpact - negativeImpact;

            // Only include categories with non-zero net impact in the share data
            if (Math.abs(score) > 0.01) {
                sharingData[category] = { score };
            }
        });
        return sharingData;
    }, [transactions, isBankConnected, impactAnalysis]); // Added impactAnalysis dependency

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

    // --- Effect for commented out section ---
    /* ... */


  // --- Action Handlers ---
   const handleApplyCredit = useCallback(async () => {
     if (!user || isApplyingCredit || impactAnalysis === null || available <= 0 || effective <= 0) return;
     try {
       const amountToApply = Math.min(available, effective);
       if (amountToApply > 0) { await applyCredit(amountToApply, user.uid); }
       else { console.log("Apply Credit: No amount to apply."); }
     } catch (error) { console.error("Error applying credit:", error); }
   }, [applyCredit, user, impactAnalysis, available, effective, isApplyingCredit]);

  const handleOpenOffsetModal = useCallback(() => {
      const amountToPotentiallyOffset = Math.max(0, effective);
      openDonationModal("All Societal Debt", amountToPotentiallyOffset);
  }, [openDonationModal, effective]);


  // --- Conditional Button Logic (Unchanged) ---
  const getActionButton = () => {
     if (!isBankConnected) { return ( <button disabled className="w-full px-4 py-2 rounded-lg text-sm font-semibold bg-gray-400 dark:bg-gray-500 text-white opacity-50 cursor-not-allowed"> Connect Bank </button> ); }
     if (impactAnalysis === null) { return ( <button disabled className="w-full px-4 py-2 rounded-lg text-sm font-semibold bg-gray-400 dark:bg-gray-500 text-white opacity-50 cursor-not-allowed"> Analyzing... </button> ); }
     if (available > 0 && effective > 0) { return ( <button onClick={handleApplyCredit} disabled={isApplyingCredit} className={`w-full px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--card-background)] focus:ring-[var(--success)] ${ isApplyingCredit ? "bg-gray-400 dark:bg-gray-500 cursor-not-allowed" : "bg-[var(--success)] hover:opacity-80" }`} title={`Apply ${formatCurrency(available)} credit`}> {isApplyingCredit ? "Applying..." : `Apply Credit (${formatCurrency(available)})`} </button> ); }
     if (available <= 0 && effective > 0) { return ( <button onClick={handleOpenOffsetModal} className="w-full px-4 py-2 rounded-lg text-sm font-semibold text-white bg-green-600 hover:bg-green-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--card-background)] focus:ring-green-500" title={`Offset ${formatCurrency(effective)} remaining debt`}> Offset Remaining Debt ({formatCurrency(effective)}) </button> ); }
     if (effective <= 0) { return ( <button onClick={handleOpenOffsetModal} className="w-full px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--card-background)] focus:ring-blue-500" title="Make an additional donation"> Donate to Offset Impact </button> ); }
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
                    overallRatio={actualAppliedRatio}
                    totalPositiveImpact={totalPositiveImpact}
                    className="mt-2"
                 />
              )}
        </div>

        {/* Conditionally Rendered Content Wrapper */}
        {isBankConnected && (
           <div className={`flex-grow flex flex-col`}>
                {/* Section 2: Overall Progress Bar */}
                {impactAnalysis !== null ? (
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
                    <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400 border-b border-[var(--border-color)]">Calculating progress...</div>
                )}

               {/* Section 3: Available Credit & Action Button */}
               <div className="p-4 space-y-3">
                   {/* --- MODIFIED: Available Credit Line --- */}
                   {/* Only render if analysis is done AND available credit > 0 */}
                   {impactAnalysis !== null && available > 0 && (
                       <div className="flex items-center justify-between">
                           <span className="text-[var(--muted-foreground)] text-sm sm:text-base">Available Credit</span>
                           <AnimatedCounter value={available} prefix="$" className="font-bold text-[var(--success)] text-sm sm:text-base" decimalPlaces={2}/>
                       </div>
                   )}
                   {/* --- End Modification --- */}

                   <div className="pt-2">
                      {getActionButton()}
                   </div>
               </div>

               {/* --- Commented Out: Your Values Section --- */}
               {/* ... */}

           </div>
        )}
        {!isBankConnected && ( <div className="p-6 text-center text-gray-500 dark:text-gray-400 text-sm"> Connect your bank account to see your impact analysis. </div> )}
      </div>

      {/* Donation Modal */}
      {modalState.isOpen && ( <DonationModal isOpen={modalState.isOpen} practice={modalState.practice || ''} amount={modalState.amount || 0} onClose={closeDonationModal} /> )}
    </div>
  );
}