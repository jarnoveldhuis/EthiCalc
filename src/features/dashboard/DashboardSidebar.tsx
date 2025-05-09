// src/features/dashboard/DashboardSidebar.tsx
import React, {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { UserValuesEditor } from "@/features/values/UserValuesEditor";
import { useTransactionStore } from "@/store/transactionStore";
import { AnimatedCounter } from "@/shared/ui/AnimatedCounter";
import { useCountUp } from "@/hooks/useCountUp";
import { DonationModal } from "@/features/charity/DonationModal";
import { useDonationModal } from "@/hooks/useDonationModal";
import { useAuth } from "@/hooks/useAuth";
import { ShareImpactButton } from "./ShareImpactButton";

// // --- Helper: Format Currency (Now rounds by default due to AnimatedCounter change) ---
// const formatCurrency = (value: number | null | undefined): string => {
//   // Use toFixed(0) for non-animated contexts if needed, or rely on AnimatedCounter default
//   return `$${Math.round(value ?? 0)}`;
// };

// --- Helper: Tier Calculation (Updated Colors) ---
const getTierInfo = (
  scoreRatio: number | null,
  totalPositiveImpact: number,
  totalNegativeImpact: number
): {
  name: string;
  description: string;
  colorClass: string;
  displayRatio?: number;
} => {
  // Use Tailwind classes matching the updated CSS variables
  const textColor = "text-gray-700 dark:text-gray-300";

  if (totalNegativeImpact <= 0) {
    if (totalPositiveImpact > 0)
      return {
        name: "S",
        description: "Beacon of Virtue",
        colorClass: "text-emerald-600 dark:text-emerald-400",
        displayRatio: undefined,
      };
    return {
      name: " ",
      description: "Neutral / No Impact",
      colorClass: textColor,
      displayRatio: undefined,
    };
  }
  const ratio = scoreRatio ?? 0;
  // Updated color classes to match new palette potentially
  if (ratio >= 1.0)
    return {
      name: "S",
      description: "Beacon of Virtue",
      displayRatio: ratio,
      colorClass: "text-emerald-600 dark:text-emerald-400",
    };
  if (ratio >= 0.75)
    return {
      name: "A",
      description: "Conscious Contributor",
      displayRatio: ratio,
      colorClass: "text-lime-600 dark:text-lime-400",
    }; // Keep lime for variety?
  if (ratio >= 0.5)
    return {
      name: "B",
      description: "Neutral Navigator",
      displayRatio: ratio,
      colorClass: "text-yellow-500 dark:text-yellow-400",
    }; // Adjusted yellow
  if (ratio >= 0.35)
    return {
      name: "C",
      description: "Passive Liability",
      displayRatio: ratio,
      colorClass: "text-amber-500 dark:text-amber-400",
    }; // Adjusted amber
  if (ratio >= 0.2)
    return {
      name: "D",
      description: "Dead Weight",
      displayRatio: ratio,
      colorClass: "text-orange-500 dark:text-orange-400",
    }; // Adjusted orange
  return {
    name: "F",
    description: "Societal Parasite",
    displayRatio: ratio,
    colorClass: "text-rose-600 dark:text-rose-400",
  }; // Use rose
};

// --- Sidebar Component ---
export function DashboardSidebar() {
  const { user } = useAuth();
  const isBankConnected = useTransactionStore(
    (state) => state.connectionStatus.isConnected
  );
  const impactAnalysis = useTransactionStore((state) => state.impactAnalysis);
  const appStatus = useTransactionStore((state) => state.appStatus);
  const applyCreditAction = useTransactionStore((state) => state.applyCredit);
  const { modalState, openDonationModal, closeDonationModal } =
    useDonationModal();
  const [isOverallAnimationReady, setIsOverallAnimationReady] = useState(false);
  const [currentAppliedPercentage, setCurrentAppliedPercentage] = useState(0);
  const overallAnimationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // --- Calculations (Mostly Unchanged, rely on AnimatedCounter default for rounding) ---
  const applied = useMemo(
    () => (isBankConnected ? impactAnalysis?.appliedCredit ?? 0 : 0),
    [impactAnalysis, isBankConnected]
  );
  const effective = useMemo(
    () => (isBankConnected ? impactAnalysis?.effectiveDebt ?? 0 : 0),
    [impactAnalysis, isBankConnected]
  );
  const available = useMemo(
    () => (isBankConnected ? impactAnalysis?.availableCredit ?? 0 : 0),
    [impactAnalysis, isBankConnected]
  );
  const totalPositiveImpact = useMemo(
    () => (isBankConnected ? impactAnalysis?.positiveImpact ?? 0 : 0),
    [impactAnalysis, isBankConnected]
  );
  const totalNegativeImpact = useMemo(
    () => (isBankConnected ? impactAnalysis?.negativeImpact ?? 0 : 0),
    [impactAnalysis, isBankConnected]
  );

  const targetScoreRatio = useMemo(() => {
    if (!isBankConnected || !impactAnalysis || totalNegativeImpact <= 0)
      return null;
    const totalPotentialOffset = applied + available;
    return Math.min(
      1,
      totalNegativeImpact === 0 ? 1 : totalPotentialOffset / totalNegativeImpact
    );
  }, [
    impactAnalysis,
    applied,
    available,
    totalNegativeImpact,
    isBankConnected,
  ]);

  const actualAppliedRatio = useMemo(() => {
    if (!isBankConnected || !impactAnalysis || totalNegativeImpact <= 0)
      return null;
    return totalNegativeImpact === 0 ? null : applied / totalNegativeImpact;
  }, [impactAnalysis, applied, totalNegativeImpact, isBankConnected]);

  // Note: animatedAppliedRatioPercentString still needs decimal places for the percentage display
  const animatedAppliedRatioPercentString = useCountUp(
    isBankConnected && actualAppliedRatio !== null
      ? Math.max(0, actualAppliedRatio * 100)
      : 0,
    { duration: 2000, decimalPlaces: 1, easing: "easeOut" }
  );

  const currentTierInfo = useMemo(() => {
    if (!isBankConnected) return getTierInfo(null, 0, 0);
    return getTierInfo(
      targetScoreRatio,
      totalPositiveImpact,
      totalNegativeImpact
    );
  }, [
    targetScoreRatio,
    totalPositiveImpact,
    totalNegativeImpact,
    isBankConnected,
  ]);

  // Tier background colors (consider using less saturated versions or removing altogether)
  const topCardBackgroundClass = useMemo(() => {
    if (!isBankConnected || !impactAnalysis)
      return "bg-gray-400 dark:bg-gray-600";
    if (totalNegativeImpact <= 0) {
      return totalPositiveImpact > 0
        ? "bg-sky-500 dark:bg-sky-700"
        : "bg-gray-400 dark:bg-gray-600";
    }
    const ratio = targetScoreRatio ?? 0;
    // Example: Using slightly less saturated versions or alternatives
    if (ratio >= 1.0) return "bg-emerald-500 dark:bg-emerald-700"; // S
    if (ratio >= 0.75) return "bg-lime-500 dark:bg-lime-700"; // A
    if (ratio >= 0.5) return "bg-yellow-400 dark:bg-yellow-600"; // B
    if (ratio >= 0.35) return "bg-amber-400 dark:bg-amber-600"; // C
    if (ratio >= 0.2) return "bg-orange-500 dark:bg-orange-700"; // D
    return "bg-rose-600 dark:bg-rose-800"; // F (Using rose)
  }, [
    impactAnalysis,
    totalNegativeImpact,
    totalPositiveImpact,
    targetScoreRatio,
    isBankConnected,
  ]);

  const targetAppliedPercentage = useMemo(() => {
    if (!isBankConnected || totalNegativeImpact <= 0)
      return effective <= 0 ? 100 : 0;
    return Math.min(100, Math.max(0, (applied / totalNegativeImpact) * 100));
  }, [applied, totalNegativeImpact, effective, isBankConnected]);

  // Use updated CSS vars for progress bar track
  const progressBarTrackColor =
    effective > 0
      ? "bg-rose-200 dark:bg-rose-900/[.5]"
      : "bg-emerald-200 dark:bg-emerald-900/[.5]";

  // --- Effects (Unchanged) ---
  useEffect(() => {
    if (!isBankConnected) {
      setIsOverallAnimationReady(false);
      setCurrentAppliedPercentage(0);
      return;
    }
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
    return () => {
      if (overallAnimationTimeoutRef.current)
        clearTimeout(overallAnimationTimeoutRef.current);
    };
  }, [targetAppliedPercentage, impactAnalysis, isBankConnected]);

  // --- Action Handlers (Unchanged) ---
  const handleApplyCredit = useCallback(async () => {
    if (
      !user ||
      appStatus === "applying_credit" ||
      impactAnalysis === null ||
      available <= 0 ||
      effective <= 0
    )
      return;
    try {
      const amountToApply = Math.min(available, effective);
      if (amountToApply > 0) {
        await applyCreditAction(amountToApply);
      } else {
        console.log("Apply Credit: No amount to apply.");
      }
    } catch (error) {
      console.error("Error applying credit:", error);
    }
  }, [
    applyCreditAction,
    user,
    impactAnalysis,
    available,
    effective,
    appStatus,
  ]);

  const handleOpenOffsetModal = useCallback(() => {
    const amountToPotentiallyOffset = Math.max(0, effective);
    openDonationModal("All Societal Debt", amountToPotentiallyOffset);
  }, [openDonationModal, effective]);

  // --- Conditional Button Logic (Updated Button Text) ---
  const getActionButton = () => {
    const isBusy = appStatus !== "idle" && appStatus !== "error";
    const isApplying = appStatus === "applying_credit";
    if (!isBankConnected) {
      return (
        <button
          disabled
          className="w-full px-4 py-2 rounded-lg text-sm font-semibold bg-gray-400 dark:bg-gray-500 text-white opacity-50 cursor-not-allowed"
        >
          {" "}
          Connect Bank{" "}
        </button>
      );
    }
    if (impactAnalysis === null || (isBusy && !isApplying)) {
      return (
        <button
          disabled
          className="w-full px-4 py-2 rounded-lg text-sm font-semibold bg-gray-400 dark:bg-gray-500 text-white opacity-50 cursor-not-allowed"
        >
          {" "}
          {appStatus === "initializing"
            ? "Initializing..."
            : "Processing..."}{" "}
        </button>
      );
    }

    // Apply Credit Button (Text unchanged, includes amount)
    if (available > 0 && effective > 0) {
      return (
        <button
          onClick={handleApplyCredit}
          disabled={isApplying}
          className={`w-full px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--card-background)] focus:ring-emerald-500 ${
            isApplying
              ? "bg-gray-400 dark:bg-gray-500 cursor-not-allowed"
              : "bg-emerald-600 hover:bg-emerald-700"
          }`}
          title={`Apply $${available.toFixed(2)} credit`}
        >
          {" "}
          {isApplying
            ? "Applying..."
            : `Apply Credit ($${available.toFixed(0)})`}{" "}
        </button>
      );
    } // Rounded amount in button text

    // Offset Remaining Debt Button (Text Simplified)
    if (available <= 0 && effective > 0) {
      return (
        <button
          onClick={handleOpenOffsetModal}
          disabled={isBusy}
          className={`w-full px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--card-background)] focus:ring-emerald-500 ${
            isBusy
              ? "bg-gray-400 dark:bg-gray-500 cursor-not-allowed"
              : "bg-emerald-600 hover:bg-emerald-700"
          }`}
          title={`Offset $${effective.toFixed(2)} remaining debt`}
        >
          {" "}
          Offset{" "}
        </button>
      );
    } // << TEXT UPDATED

    // Donate Button (Text Simplified)
    if (effective <= 0) {
      return (
        <button
          onClick={handleOpenOffsetModal}
          disabled={isBusy}
          className={`w-full px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--card-background)] focus:ring-blue-500 ${
            isBusy
              ? "bg-gray-400 dark:bg-gray-500 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700"
          }`}
          title="Make an additional donation"
        >
          {" "}
          Donate{" "}
        </button>
      );
    } // << TEXT UPDATED

    return (
      <button
        disabled
        className="w-full px-4 py-2 rounded-lg text-sm font-semibold bg-gray-400 dark:bg-gray-500 text-white opacity-50 cursor-not-allowed"
      >
        {" "}
        Calculating...{" "}
      </button>
    );
  };

  // --- Render Logic ---
  return (
    <div className="w-full lg:col-span-1 min-h-[100px] lg:min-h-0">
      <div className="card mb-6 h-full flex flex-col">
        {" "}
        {/* Main card container */}
        {/* Section 1: Top Card - Debt Amount & Action Button */}
        <div
          className={`${topCardBackgroundClass} transition-colors duration-2000 p-4 sm:p-6 rounded-t-lg`}
        >
          {" "}
          {/* Adjusted rounding */}
          <div className="text-center mb-4">
            <div className="mb-1">
              {/* Using decimalPlaces={0} explicitly */}
              <AnimatedCounter
                value={effective}
                prefix="$"
                className="font-bold text-4xl sm:text-5xl text-white drop-shadow-md"
                decimalPlaces={0}
              />
            </div>
            <p className="text-sm font-medium text-white opacity-80">
              Remaining Ethical Debt
            </p>
          </div>
          <div className="mt-4">{getActionButton()}</div>
        </div>
        {/* Conditionally Rendered Content Wrapper */}
        {isBankConnected && (
          <div className={`flex-grow flex flex-col`}>

            {/* START: Moved Tier Info Section */}
            <div className="p-4 text-center border-b border-slate-200 dark:border-slate-700">
              {impactAnalysis !== null && appStatus !== "error" && (
                <div className="mb-3"> {/* Original Tier Info inner div, mb-3 might be adjusted if only element */}
                  <p
                    className={`text-sm font-medium ${currentTierInfo.colorClass}`}
                  >
                    <span className="font-semibold mr-1.5">
                      {currentTierInfo.name
                        ? `${currentTierInfo.name} Tier:`
                        : ""}
                    </span>
                    {currentTierInfo.description}
                  </p>
                  {actualAppliedRatio !== null && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      (
                      <span className="font-semibold">
                        {animatedAppliedRatioPercentString}
                      </span>
                      % Offset Applied)
                    </p>
                  )}
                </div>
              )}
              {!impactAnalysis && appStatus !== "error" && isBankConnected && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Tier information unavailable.
                </p>
              )}
            </div>
            {/* END: Moved Tier Info Section */}

            {/* Section 2: Overall Progress Bar - Border removed */}
            {impactAnalysis !== null && appStatus !== "error" ? (
              <div className="p-4 space-y-2"> {/* Removed border-b border-slate-200 dark:border-slate-700 */}
                <div className="flex justify-between text-xs sm:text-sm mb-1">
                  <span className="font-medium text-[var(--muted-foreground)]">
                    Applied Credit
                  </span>
                  <span className="font-medium text-[var(--muted-foreground)]">
                    {" "}
                    {effective > 0
                      ? "Remaining Debt"
                      : totalNegativeImpact > 0
                      ? "Debt Offset"
                      : "Net Positive"}{" "}
                  </span>
                </div>
                <div
                  className={`w-full ${progressBarTrackColor} rounded-full h-3 overflow-hidden relative transition-colors duration-2000`}
                >
                  <div
                    className="bg-[var(--success)] h-3 rounded-l-full absolute top-0 left-0 transition-all duration-2000 ease-out"
                    style={{
                      width: isOverallAnimationReady
                        ? `${currentAppliedPercentage}%`
                        : "0%",
                    }}
                    title={`Applied: $${applied.toFixed(2)}`}
                  />{" "}
                  {/* Show precise on hover */}
                </div>
                <div className="flex justify-between text-xs sm:text-sm">
                  {/* Applied Amount - Rounded Display */}
                  <AnimatedCounter
                    value={applied}
                    prefix="$"
                    className="font-semibold text-[var(--success)]"
                    decimalPlaces={0}
                  />
                  {/* Effective Debt Amount - Rounded Display */}
                  <AnimatedCounter
                    value={effective}
                    prefix="$"
                    className={`font-semibold ${
                      effective > 0
                        ? "text-[var(--destructive)]"
                        : "text-[var(--success)]"
                    }`}
                    decimalPlaces={0}
                    title={
                      effective > 0
                        ? `Remaining Debt: $${effective.toFixed(2)}`
                        : totalNegativeImpact > 0
                        ? "All Debt Offset"
                        : `Net Positive Impact: $${Math.abs(effective).toFixed(
                            2
                          )}`
                    } // Precise on hover
                  />
                  
                </div>
              </div>
            ) : (
              <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400"> {/* Removed border-b border-slate-200 dark:border-slate-700 */}
                {appStatus === "error"
                  ? "Error loading data"
                  : "Calculating progress..."}
              </div>
            )}

            {/* Section 3: Now primarily Share Button - Tier Info and its fallback are moved out */}

            
            {isBankConnected && user && (
               <div className=""> 
                   <UserValuesEditor />
               </div>
            )}
            <div className="p-4 mt-auto text-center">
              {impactAnalysis !== null && appStatus !== "error" && (
                <>
                  {/* Share Button */}
                  <div>
                    <ShareImpactButton
                      overallRatio={actualAppliedRatio}
                      totalPositiveImpact={totalPositiveImpact}
                    />
                  </div>
                </>
              )}
              {/* "Tier information unavailable" message was here, MOVED UP */}
            </div>
          </div>
        )}
        {!isBankConnected && (
          <div className="p-6 text-center text-gray-500 dark:text-gray-400 text-sm">
            {" "}
            Connect your bank account to see your impact analysis.{" "}
          </div>
        )}
      </div>

      {/* Donation Modal (Unchanged) */}
      {modalState.isOpen && (
        <DonationModal
          isOpen={modalState.isOpen}
          practice={modalState.practice || ""}
          amount={modalState.amount || 0}
          onClose={closeDonationModal}
        />
      )}
    </div>
  );
}
