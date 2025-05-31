// src/features/dashboard/DashboardSidebar.tsx
import React, {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { useTransactionStore } from "@/store/transactionStore";
import { AnimatedCounter } from "@/shared/ui/AnimatedCounter";
import { useCountUp } from "@/hooks/useCountUp";
import { DonationModal } from "@/features/charity/DonationModal";
import { useDonationModal } from "@/hooks/useDonationModal";
import { useAuth } from "@/hooks/useAuth";
import { ShareImpactButton } from "./ShareImpactButton";

// TierInfo type
type TierInfo = {
  name: string;
  description: string;
  colorClass: string;
  displayRatio?: number;
};

// Helper: Tier Calculation (remains the same)
const getTierInfo = (
  scoreRatio: number | null,
  totalPositiveImpact: number,
  totalNegativeImpact: number
): TierInfo => {
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
  if (ratio >= 1.0)
    return {
      name: "S",
      description: "Ethical Surplus",
      displayRatio: ratio,
      colorClass: "text-emerald-600 dark:text-emerald-400",
    };
  if (ratio >= 0.75)
    return {
      name: "A",
      description: "Conscious Contributor",
      displayRatio: ratio,
      colorClass: "text-lime-600 dark:text-lime-400",
    };
  if (ratio >= 0.5)
    return {
      name: "B",
      description: "Neutral Navigator",
      displayRatio: ratio,
      colorClass: "text-yellow-500 dark:text-yellow-400",
    };
  if (ratio >= 0.35)
    return {
      name: "C",
      description: "Passive Liability",
      displayRatio: ratio,
      colorClass: "text-amber-500 dark:text-amber-400",
    };
  if (ratio >= 0.2)
    return {
      name: "D",
      description: "Dead Weight",
      displayRatio: ratio,
      colorClass: "text-orange-500 dark:text-orange-400",
    };
  return {
    name: "F",
    description: "Societal Parasite",
    displayRatio: ratio,
    colorClass: "text-rose-600 dark:text-rose-400",
  };
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
  const { modalState, openDonationModal, closeDonationModal } = useDonationModal();

  const targetTierInfo = useMemo(() => {
    if (!isBankConnected || !impactAnalysis) return getTierInfo(null, 0, 0);
    const applied = impactAnalysis?.appliedCredit ?? 0;
    const totalNegative = impactAnalysis?.negativeImpact ?? 0;
    const actualAppliedRatio = totalNegative <= 0 ? null : applied / totalNegative;
    return getTierInfo(
      actualAppliedRatio,
      impactAnalysis?.positiveImpact ?? 0,
      totalNegative
    );
  }, [impactAnalysis, isBankConnected]);
  
  const [displayedTierInfo, setDisplayedTierInfo] = useState<TierInfo>(() => targetTierInfo);
  const tierQueueRef = useRef<TierInfo[]>([]);
  const isProcessingTierRef = useRef(false);
  const tierDisplayTimeoutIdRef = useRef<NodeJS.Timeout | null>(null);
  
  const MIN_TIER_DISPLAY_TIME = 2500;

  useEffect(() => {
    const lastScheduledTier = tierQueueRef.current.length > 0
        ? tierQueueRef.current[tierQueueRef.current.length - 1]
        : displayedTierInfo;

    if (targetTierInfo.name !== lastScheduledTier.name) {
        tierQueueRef.current.push(targetTierInfo);
    } else if (targetTierInfo !== lastScheduledTier) { 
        if (tierQueueRef.current.length > 0) {
            tierQueueRef.current[tierQueueRef.current.length - 1] = targetTierInfo;
        } else {
           if (!isProcessingTierRef.current || displayedTierInfo.name === targetTierInfo.name) {
             setDisplayedTierInfo(targetTierInfo);
           }
        }
    }
  }, [targetTierInfo, displayedTierInfo]);

  useEffect(() => {
    const processQueue = () => {
      if (isProcessingTierRef.current || tierQueueRef.current.length === 0) {
        // If queue becomes empty and target is same as displayed (details updated), update displayed.
        if (tierQueueRef.current.length === 0 && targetTierInfo.name === displayedTierInfo.name && targetTierInfo !== displayedTierInfo && !isProcessingTierRef.current) {
             setDisplayedTierInfo(targetTierInfo);
        }
        return;
      }

      isProcessingTierRef.current = true;
      const nextTier = tierQueueRef.current.shift()!;
      setDisplayedTierInfo(nextTier);

      if (tierDisplayTimeoutIdRef.current) clearTimeout(tierDisplayTimeoutIdRef.current);

      tierDisplayTimeoutIdRef.current = setTimeout(() => {
        isProcessingTierRef.current = false;
        tierDisplayTimeoutIdRef.current = null; // Clear the ref after timeout
        processQueue(); 
      }, MIN_TIER_DISPLAY_TIME);
    };

    processQueue();

    return () => { 
      if (tierDisplayTimeoutIdRef.current) {
        clearTimeout(tierDisplayTimeoutIdRef.current);
      }
      // isProcessingTierRef.current = false; // Resetting here might be problematic if effect re-runs quickly
    };
  }, [displayedTierInfo, targetTierInfo]); // Rerun when displayedTierInfo changes or targetTierInfo (to catch minor updates when queue is empty)

  const [isOverallAnimationReady, setIsOverallAnimationReady] = useState(false);
  const [currentAppliedPercentage, setCurrentAppliedPercentage] = useState(0);
  const overallAnimationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  const actualAppliedRatio = useMemo(() => {
    if (!isBankConnected || !impactAnalysis || totalNegativeImpact <= 0) {
      return null;
    }
    return applied / totalNegativeImpact;
  }, [impactAnalysis, applied, totalNegativeImpact, isBankConnected]);

  const animatedAppliedRatioPercentString = useCountUp(
    isBankConnected && actualAppliedRatio !== null && totalNegativeImpact > 0
      ? Math.max(0, actualAppliedRatio * 100)
      : 0,
    { duration: 3000, decimalPlaces: 1, easing: "easeOut" }
  );

  const currentTierInfo = useMemo(() => {
    if (!isBankConnected || !impactAnalysis) return getTierInfo(null, 0, 0);
    return getTierInfo(
      actualAppliedRatio,
      totalPositiveImpact,
      totalNegativeImpact
    );
  }, [
    actualAppliedRatio,
    totalPositiveImpact,
    totalNegativeImpact,
    isBankConnected,
    impactAnalysis,
  ]);

  const topCardBackgroundClass = useMemo(() => {
    if (!isBankConnected || !impactAnalysis) {
      return "bg-gray-400 dark:bg-gray-600";
    }
    const currentEffectiveDebt = effective;
    const currentTotalNegativeImpact = totalNegativeImpact;
    const currentTotalPositiveImpact = totalPositiveImpact;

    if (currentTotalNegativeImpact <= 0) {
      return currentTotalPositiveImpact > 0
        ? "bg-sky-500 dark:bg-sky-700"
        : "bg-gray-400 dark:bg-gray-600";
    }
    if (currentEffectiveDebt <= 0) return "bg-emerald-500 dark:bg-emerald-700";
    if (currentEffectiveDebt < 20) return "bg-lime-500 dark:bg-lime-700";
    if (currentEffectiveDebt < 50) return "bg-yellow-400 dark:bg-yellow-600";
    if (currentEffectiveDebt < 100) return "bg-orange-500 dark:bg-orange-700";
    return "bg-rose-600 dark:bg-rose-800";
  }, [isBankConnected, impactAnalysis, effective, totalNegativeImpact, totalPositiveImpact]);

  const targetAppliedPercentage = useMemo(() => {
    if (!isBankConnected || totalNegativeImpact <= 0)
      return effective <= 0 ? 100 : 0;
    return Math.min(100, Math.max(0, (applied / totalNegativeImpact) * 100));
  }, [applied, totalNegativeImpact, effective, isBankConnected]);

  const progressBarAnimationDuration = 2000;

  const progressBarTrackColor = effective > 0
    ? "bg-rose-200 dark:bg-rose-900/[.5]"
    : "bg-emerald-200 dark:bg-emerald-900/[.5]";

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

  const getActionButton = () => {
    const isBusy = appStatus !== "idle" && appStatus !== "error";
    const isApplying = appStatus === "applying_credit";
    if (!isBankConnected) {
      return (
        <button
          disabled
          className="w-full px-4 py-2 rounded-lg text-sm font-semibold bg-gray-400 dark:bg-gray-500 text-white opacity-50 cursor-not-allowed"
        >
          Connect Bank
        </button>
      );
    }
    if (impactAnalysis === null || (isBusy && !isApplying)) {
      return (
        <button
          disabled
          className="w-full px-4 py-2 rounded-lg text-sm font-semibold bg-gray-400 dark:bg-gray-500 text-white opacity-50 cursor-not-allowed"
        >
          {appStatus === "initializing"
            ? "Initializing..."
            : "Processing..."}
        </button>
      );
    }

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
          {isApplying
            ? "Applying..."
            : `Apply Credit ($${available.toFixed(0)})`}
        </button>
      );
    }

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
          Offset
        </button>
      );
    }

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
          Donate
        </button>
      );
    }

    return (
      <button
        disabled
        className="w-full px-4 py-2 rounded-lg text-sm font-semibold bg-gray-400 dark:bg-gray-500 text-white opacity-50 cursor-not-allowed"
      >
        Calculating...
      </button>
    );
  };

  return (
    <div className="w-full lg:col-span-1 min-h-[100px] lg:min-h-0">
      <div className="card mb-6 h-full flex flex-col">
        <div
          className={`${topCardBackgroundClass} transition-colors duration-2000 p-4 sm:p-6 rounded-t-lg`}
        >
          <div className="text-center mb-4">
            <div className="mb-1">
              <AnimatedCounter
                value={effective} // Value is always non-negative
                // CHANGE: Prefix determined by whether 'effective' (debt) is > 0
                prefix={effective > 0 ? "-$" : "$"}
                className="font-bold text-4xl sm:text-5xl text-white drop-shadow-md"
                decimalPlaces={0}
                duration={3000}
              />
            </div>
            {/* CHANGE: Text changed here */}
            <p className="text-sm font-medium text-white opacity-80">
              Your Social Balance
            </p>
          </div>
          <div className="mt-4">{getActionButton()}</div>
        </div>

        {isBankConnected && (
          <div className={`flex-grow flex flex-col`}>
            <div className="p-4 text-center border-b border-slate-200 dark:border-slate-700">
              {impactAnalysis !== null && appStatus !== "error" && (
                <div className="mb-3">
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
                  {actualAppliedRatio !== null && totalNegativeImpact > 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      (
                      <span className="font-semibold">
                        {animatedAppliedRatioPercentString}
                      </span>
                      % of Negative Impact Offset)
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

            {impactAnalysis !== null && appStatus !== "error" ? (
              <div className="p-4 space-y-2">
                <div className="flex justify-between text-xs sm:text-sm mb-1">
                  <span className="font-medium text-[var(--muted-foreground)]">
                    Applied Credit
                  </span>
                  <span className="font-medium text-[var(--muted-foreground)]">
                    {effective > 0
                      ? "Remaining Debt"
                      : totalNegativeImpact > 0
                      ? "Debt Offset"
                      : "Net Positive"}
                  </span>
                </div>
                <div
                  className={`w-full ${progressBarTrackColor} rounded-full h-3 overflow-hidden relative transition-colors duration-3000`}
                >
                  <div
                    className="bg-[var(--success)] h-3 rounded-l-full absolute top-0 left-0 transition-all ease-out"
                    style={{
                      width: isOverallAnimationReady
                        ? `${currentAppliedPercentage}%`
                        : "0%",
                      transitionDuration: `${progressBarAnimationDuration}ms`,
                    }}
                    title={`Applied: $${applied.toFixed(2)}`}
                  />
                </div>
                <div className="flex justify-between text-xs sm:text-sm">
                  <AnimatedCounter
                    value={applied}
                    prefix="$"
                    className="font-semibold text-[var(--success)]"
                    decimalPlaces={0}
                    duration={3000}
                  />
                  <AnimatedCounter
                    value={effective} // Value is always non-negative
                    // CHANGE: Prefix for this counter too if effective > 0
                    prefix={effective > 0 ? "-$" : "$"}
                    className={`font-semibold ${
                      effective > 0
                        ? "text-[var(--destructive)]"
                        : "text-[var(--success)]"
                    }`}
                    decimalPlaces={0}
                    duration={3000}
                    title={
                      effective > 0
                        ? `Remaining Debt: $${effective.toFixed(2)}`
                        : totalNegativeImpact > 0
                        ? "All Debt Offset"
                        : `Net Positive Impact: $${Math.abs(effective).toFixed(
                            2
                          )}`
                    }
                  />
                </div>
              </div>
            ) : (
              <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
                {appStatus === "error"
                  ? "Error loading data"
                  : "Calculating progress..."}
              </div>
            )}

            <div className="p-4 mt-auto text-center">
              {impactAnalysis !== null && appStatus !== "error" && (
                <ShareImpactButton
                  overallRatio={actualAppliedRatio}
                  totalPositiveImpact={totalPositiveImpact}
                />
              )}
            </div>
          </div>
        )}

        {!isBankConnected && (
          <div className="p-6 text-center text-gray-500 dark:text-gray-400 text-sm">
            Connect your bank account to see your impact analysis.
          </div>
        )}
      </div>

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