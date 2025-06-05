// src/features/dashboard/DashboardSidebar.jsx
"use client";

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
// import { useAuth } from "@/hooks/useAuth"; // REMOVED
import { ShareImpactButton } from "./ShareImpactButton";
import { ImpactAnalysis } from "@/core/calculations/type";

type TierInfo = {
  name: string;
  description: string;
  colorClass: string;
  displayRatio?: number;
};

const getTierInfo = (
  impactAnalysis: ImpactAnalysis | null
): TierInfo => {
  const textColor = "text-gray-700 dark:text-gray-300";
  if (!impactAnalysis) return { name: " ", description: "Awaiting Data...", colorClass: textColor };

  const { positiveImpact, negativeImpact } = impactAnalysis;

  if (negativeImpact <= 0.005) {
    return positiveImpact > 0.005
      ? { name: "S+", description: "Beacon of Virtue", colorClass: "text-sky-500 dark:text-sky-400" }
      : { name: " ", description: "Neutral / No Impact", colorClass: textColor };
  }
  const scoreRatio = positiveImpact / negativeImpact;

  if (scoreRatio >= 1.0)
    return { name: "S", description: "Ethical Surplus", displayRatio: scoreRatio, colorClass: "text-emerald-600 dark:text-emerald-400" };
  if (scoreRatio >= 0.75)
    return { name: "A", description: "Conscious Contributor", displayRatio: scoreRatio, colorClass: "text-lime-600 dark:text-lime-400" };
  if (scoreRatio >= 0.5)
    return { name: "B", description: "Neutral Navigator", displayRatio: scoreRatio, colorClass: "text-yellow-500 dark:text-yellow-400" };
  if (scoreRatio >= 0.35)
    return { name: "C", description: "Passive Liability", displayRatio: scoreRatio, colorClass: "text-amber-500 dark:text-amber-400" };
  if (scoreRatio >= 0.2)
    return { name: "D", description: "Dead Weight", displayRatio: scoreRatio, colorClass: "text-orange-500 dark:text-orange-400" };
  return { name: "F", description: "Societal Parasite", displayRatio: scoreRatio, colorClass: "text-rose-600 dark:text-rose-400" };
};

export function DashboardSidebar() {
  // const { user } = useAuth(); // REMOVED
  const isBankConnected = useTransactionStore((state) => state.connectionStatus.isConnected);
  const impactAnalysis = useTransactionStore((state) => state.impactAnalysis);
  const appStatus = useTransactionStore((state) => state.appStatus);
  const { modalState, openDonationModal, closeDonationModal } = useDonationModal();

  const targetTierInfo = useMemo(() => {
    if (!isBankConnected || !impactAnalysis) return getTierInfo(null);
    return getTierInfo(impactAnalysis);
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

    if (targetTierInfo.name !== lastScheduledTier.name || 
        (targetTierInfo.displayRatio !== undefined && Math.abs((targetTierInfo.displayRatio ?? 0) - (lastScheduledTier.displayRatio ?? 0)) > 0.01) ) {
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
        tierDisplayTimeoutIdRef.current = null;
        processQueue(); 
      }, MIN_TIER_DISPLAY_TIME);
    };
    processQueue();
    return () => { 
      if (tierDisplayTimeoutIdRef.current) clearTimeout(tierDisplayTimeoutIdRef.current);
    };
  }, [displayedTierInfo, targetTierInfo]);

  const [isOverallAnimationReady, setIsOverallAnimationReady] = useState(false);
  const [currentProgressPercentage, setCurrentProgressPercentage] = useState(0);
  const overallAnimationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const netEthicalBalance = useMemo(
    () => (isBankConnected && impactAnalysis ? impactAnalysis.netEthicalBalance : 0),
    [impactAnalysis, isBankConnected]
  );
  const totalPositiveImpact = useMemo(
    () => (isBankConnected && impactAnalysis ? impactAnalysis.positiveImpact : 0),
    [impactAnalysis, isBankConnected]
  );
  const totalNegativeImpact = useMemo(
    () => (isBankConnected && impactAnalysis ? impactAnalysis.negativeImpact : 0),
    [impactAnalysis, isBankConnected]
  );
  
  // const currentDebtToOffset = useMemo( // REMOVED as unused
  //   () => (netEthicalBalance < 0 ? Math.abs(netEthicalBalance) : 0),
  //   [netEthicalBalance]
  // );

  const animatedNetEthicalBalancePercentString = useCountUp(
    isBankConnected && totalNegativeImpact > 0 && impactAnalysis
      ? Math.max(0, (impactAnalysis.positiveImpact / impactAnalysis.negativeImpact) * 100)
      : (totalPositiveImpact > 0 ? 100 : 0),
    { duration: 3000, decimalPlaces: 1, easing: "easeOut" }
  );

  const topCardBackgroundClass = useMemo(() => {
    if (!isBankConnected || !impactAnalysis) return "bg-gray-400 dark:bg-gray-600";
    if (netEthicalBalance >= 0) return "bg-sky-500 dark:bg-sky-700";
    if (netEthicalBalance > -20) return "bg-lime-500 dark:bg-lime-700";
    if (netEthicalBalance > -50) return "bg-yellow-400 dark:bg-yellow-600";
    if (netEthicalBalance > -100) return "bg-orange-500 dark:bg-orange-700";
    return "bg-rose-600 dark:bg-rose-800";
  }, [isBankConnected, impactAnalysis, netEthicalBalance]);

  const targetProgressPercentage = useMemo(() => {
    if (!isBankConnected || !impactAnalysis) return 0;
    if (totalNegativeImpact <= 0.005) return totalPositiveImpact > 0.005 ? 100 : 0;
    return Math.min(100, Math.max(0, (totalPositiveImpact / totalNegativeImpact) * 100));
  }, [impactAnalysis, totalPositiveImpact, totalNegativeImpact, isBankConnected]);

  const progressBarAnimationDuration = 2000;
  const progressBarTrackColor = netEthicalBalance < 0 ? "bg-rose-200 dark:bg-rose-900/[.5]" : "bg-emerald-200 dark:bg-emerald-900/[.5]";

  useEffect(() => {
    if (!isBankConnected) {
      setIsOverallAnimationReady(false);
      setCurrentProgressPercentage(0);
      return;
    }
    if (overallAnimationTimeoutRef.current) clearTimeout(overallAnimationTimeoutRef.current);
    if (impactAnalysis !== null) {
      overallAnimationTimeoutRef.current = setTimeout(() => {
        setCurrentProgressPercentage(targetProgressPercentage);
        setIsOverallAnimationReady(true);
      }, 50);
    } else {
      setIsOverallAnimationReady(false);
      setCurrentProgressPercentage(0);
    }
    return () => {
      if (overallAnimationTimeoutRef.current) clearTimeout(overallAnimationTimeoutRef.current);
    };
  }, [targetProgressPercentage, impactAnalysis, isBankConnected]);

  const handleOpenOffsetModal = useCallback(() => {
    const amountToPotentiallyOffset = netEthicalBalance < 0 ? Math.abs(netEthicalBalance) : 5;
    const practiceForModal = netEthicalBalance < 0 ? "All Societal Debt" : "General Donation";
    openDonationModal(practiceForModal, amountToPotentiallyOffset);
  }, [openDonationModal, netEthicalBalance]);

  const getActionButton = () => {
    const isBusy = appStatus !== "idle" && appStatus !== "error";
    if (!isBankConnected) {
      return ( <button disabled className="w-full px-4 py-2 rounded-lg text-sm font-semibold bg-gray-400 dark:bg-gray-500 text-white opacity-50 cursor-not-allowed"> Connect Bank </button> );
    }
    if (impactAnalysis === null || isBusy) {
      return ( <button disabled className="w-full px-4 py-2 rounded-lg text-sm font-semibold bg-gray-400 dark:bg-gray-500 text-white opacity-50 cursor-not-allowed"> {appStatus === "initializing" ? "Initializing..." : "Processing..."} </button> );
    }

    if (netEthicalBalance < -0.005) {
      return (
        <button
          onClick={handleOpenOffsetModal}
          disabled={isBusy}
          className={`w-full px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--card-background)] focus:ring-emerald-500 ${
            isBusy ? "bg-gray-400 dark:bg-gray-500 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-700"
          }`}
          title={`Offset remaining debt of $${Math.abs(netEthicalBalance).toFixed(2)}`}
        >
          Offset Debt
        </button>
      );
    }
    return (
      <button
        onClick={handleOpenOffsetModal}
        disabled={isBusy}
        className={`w-full px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--card-background)] focus:ring-blue-500 ${
          isBusy ? "bg-gray-400 dark:bg-gray-500 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
        }`}
        title="Make an additional donation"
      >
        Donate Further
      </button>
    );
  };

  return (
    <div className="w-full lg:col-span-1 min-h-[100px] lg:min-h-0">
      <div className="card mb-6 h-full flex flex-col">
        <div className={`${topCardBackgroundClass} transition-colors duration-2000 p-4 sm:p-6 rounded-t-lg`}>
          <div className="text-center mb-4">
            <div className="mb-1">
              <AnimatedCounter
                value={Math.abs(netEthicalBalance)}
                prefix={netEthicalBalance < -0.005 ? "-$" : (netEthicalBalance > 0.005 ? "+$" : "$")}
                className="font-bold text-4xl sm:text-5xl text-white drop-shadow-md"
                decimalPlaces={0}
                duration={2000} // Adjusted duration for main counter
              />
            </div>
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
                  <p className={`text-sm font-medium ${displayedTierInfo.colorClass}`}>
                    <span className="font-semibold mr-1.5">
                      {displayedTierInfo.name ? `${displayedTierInfo.name} Tier:` : ""}
                    </span>
                    {displayedTierInfo.description}
                  </p>
                  {displayedTierInfo.displayRatio !== undefined && totalNegativeImpact > 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      (<span className="font-semibold">{animatedNetEthicalBalancePercentString}</span>% of Negative Impact Offset by Positive Actions)
                    </p>
                  )}
                   {totalNegativeImpact <= 0 && totalPositiveImpact > 0 && (
                     <p className="text-xs text-gray-500 dark:text-gray-400">(No Negative Impact to Offset!)</p>
                   )}
                </div>
              )}
              {(!impactAnalysis && appStatus !== "error" && isBankConnected) && (
                <p className="text-sm text-gray-500 dark:text-gray-400">Tier information unavailable.</p>
              )}
            </div>

            {impactAnalysis !== null && appStatus !== "error" ? (
              <div className="p-4 space-y-2">
                <div className="flex justify-between text-xs sm:text-sm mb-1">
                  <span className="font-medium text-[var(--muted-foreground)]">
                    Positive Impact
                  </span>
                  <span className="font-medium text-[var(--muted-foreground)]">
                    {netEthicalBalance < -0.005 ? "Net Debt" : "Net Surplus"}
                  </span>
                </div>
                <div className={`w-full ${progressBarTrackColor} rounded-full h-3 overflow-hidden relative transition-colors duration-1000`}>
                  <div
                    className="bg-[var(--success)] h-3 rounded-l-full absolute top-0 left-0 transition-all ease-out"
                    style={{
                      width: isOverallAnimationReady ? `${currentProgressPercentage}%` : "0%",
                      transitionDuration: `${progressBarAnimationDuration}ms`,
                    }}
                    title={`Positive Impact covers ${currentProgressPercentage.toFixed(1)}% of Negative Impact`}
                  />
                </div>
                <div className="flex justify-between text-xs sm:text-sm">
                  <AnimatedCounter
                    value={totalPositiveImpact}
                    prefix="$"
                    className="font-semibold text-[var(--success)]"
                    decimalPlaces={0}
                    duration={2000}
                  />
                  <AnimatedCounter
                    value={Math.abs(netEthicalBalance)}
                    prefix={netEthicalBalance < -0.005 ? "-$" : (netEthicalBalance > 0.005 ? "+$" : "$")}
                    className={`font-semibold ${netEthicalBalance < -0.005 ? "text-[var(--destructive)]" : "text-[var(--success)]"}`}
                    decimalPlaces={0}
                    duration={2000}
                    title={
                      netEthicalBalance < -0.005 ? `Net Debt: $${Math.abs(netEthicalBalance).toFixed(2)}`
                      : `Net Surplus: $${netEthicalBalance.toFixed(2)}`
                    }
                  />
                </div>
              </div>
            ) : (
              <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
                {appStatus === "error" ? "Error loading data" : "Calculating progress..."}
              </div>
            )}

            <div className="p-4 mt-auto text-center">
              {impactAnalysis !== null && appStatus !== "error" && (
                <ShareImpactButton
                  overallRatio={totalNegativeImpact > 0 ? totalPositiveImpact / totalNegativeImpact : (totalPositiveImpact > 0 ? Infinity : null) }
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