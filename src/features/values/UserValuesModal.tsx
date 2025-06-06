// src/features/values/UserValuesModal.jsx
"use client";

import React, { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { UserValuesEditor } from "./UserValuesEditor";
import { useTransactionStore } from "@/store/transactionStore";
import { TOTAL_VALUE_POINTS } from "@/config/valuesConfig";
import { useAuth } from "@/hooks/useAuth";

// Debounce hook
const useDebounce = <T,>(value: T, delay: number) => {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);
    return debouncedValue;
};

interface UserValuesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCommit: () => Promise<boolean>;
}

export function UserValuesModal({ isOpen, onClose, onCommit }: UserValuesModalProps) {
  const { user } = useAuth();
  const userValueSettings = useTransactionStore((state) => state.userValueSettings);
  const valuesCommittedUntil = useTransactionStore((state) => state.valuesCommittedUntil);
  
  const [stats, setStats] = useState<{ matchingUsers: number; rank?: number, totalInRank?: number } | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [isRevealingRank, setIsRevealingRank] = useState(false);
  const [showLoadingIndicator, setShowLoadingIndicator] = useState(false);
  const loadingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const debouncedSettings = useDebounce(userValueSettings, 500);

  const { currentTotal, isTotalValid } = useMemo(() => {
    const total = Object.values(userValueSettings.levels || {}).reduce((sum, level) => sum + level, 0);
    return { currentTotal: total, isTotalValid: total === TOTAL_VALUE_POINTS };
  }, [userValueSettings.levels]);

  const isCommitted = useMemo(() => {
      return valuesCommittedUntil ? Boolean(valuesCommittedUntil.toDate() > new Date()) : false;
  }, [valuesCommittedUntil]);

  const fetchValueStats = useCallback(async (settingsToFetch: typeof userValueSettings, calculateRank = false) => {
    if (!user || !settingsToFetch || !settingsToFetch.levels) {
        return; 
    }

    if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
    loadingTimerRef.current = setTimeout(() => {
        setShowLoadingIndicator(true);
    }, 700);

    setIsLoadingStats(true);
    try {
        const token = await user.getIdToken(); 
        
        const response = await fetch('/api/values/stats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ ...settingsToFetch, calculateRank })
        });

        if (!response.ok) {
            console.error('Failed to fetch value stats, response not OK');
            setStats(null);
            return;
        }
        
        const data = await response.json();
        setStats(prevStats => ({...prevStats, ...data}));
    } catch (error) {
        console.error("Error fetching value stats:", error);
        setStats(null);
    } finally {
        if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
        setShowLoadingIndicator(false);
        setIsLoadingStats(false);
    }
  }, [user]);

  useEffect(() => {
    if (isOpen && !isCommitted) {
      fetchValueStats(debouncedSettings, false);
    }
  }, [isOpen, isCommitted, debouncedSettings, fetchValueStats]);

   useEffect(() => {
    if (isOpen && isCommitted) {
      fetchValueStats(userValueSettings, true);
    }
  }, [isOpen, isCommitted, userValueSettings, fetchValueStats]);

  const handleCommit = async () => {
    if (!isTotalValid) return;
    setIsRevealingRank(true);
    const success = await onCommit();
    if (success) {
        await fetchValueStats(useTransactionStore.getState().userValueSettings, true);
    }
    setIsRevealingRank(false);
  };

  const renderStats = () => {
      const showLiveCount = !isCommitted && stats && stats.matchingUsers > 0;
      const showRank = isCommitted && stats && stats.rank && stats.totalInRank;

      const getLoadingMessage = () => {
          if (isRevealingRank) return "Calculating your rank...";
          return "Finding your tribe...";
      };

      // --- THIS IS THE FIX ---
      // The logic inside the container is reordered to prevent the flicker.
      return (
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-center min-h-[50px] flex items-center justify-center transition-all duration-300">
              { showLoadingIndicator || isRevealingRank ? (
                  <p className="text-xs text-gray-500 animate-pulse">{getLoadingMessage()}</p>
              ) : showRank ? (
                  <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">
                      You rank <span className="text-lg">#{stats.rank}</span> out of <span className="text-lg">{stats.totalInRank}</span> in your value tribe!
                  </p>
              ) : showLiveCount ? (
                   <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">
                      <span className="text-lg">{stats.matchingUsers}</span> people currently share these values. Lock them in to see your rank!
                   </p>
              // If we are loading but not yet showing the indicator, or have no data, show the default message.
              ) : isLoadingStats ? (
                  <div /> // Render an empty div during the brief pre-loading phase to prevent flicker
              ) : (
                  <p className="text-xs text-gray-500">Adjust your values to find your tribe.</p>
              )}
          </div>
      )
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-xl w-full max-h-[90vh] overflow-y-auto flex flex-col border border-gray-300 dark:border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 sm:p-5 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Customize Your Values
          </h2>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 text-2xl leading-none p-1" aria-label="Close">
            &times;
          </button>
        </div>

        <div className="p-4 sm:p-6 flex-grow space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            You have a Value Budget of <strong>{TOTAL_VALUE_POINTS} points</strong> to allocate across categories. Drag to set priority, and click the squares to set value.
          </p>
          <UserValuesEditor />
          {renderStats()}
        </div>

        <div className="flex items-center justify-between p-3 sm:p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="font-mono text-sm">
            <span className={isTotalValid ? "text-green-600 font-bold" : "text-orange-500 font-bold"}>
              {currentTotal}
            </span>
            <span className="text-gray-500 dark:text-gray-400"> / {TOTAL_VALUE_POINTS} Points Allocated</span>
          </div>

          <button
            onClick={handleCommit}
            disabled={!isTotalValid || isCommitted}
            className="px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-md hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            title={isCommitted ? 'Values are locked for this month' : !isTotalValid ? `You must allocate exactly ${TOTAL_VALUE_POINTS} points.` : "Lock in your values for this month"}
          >
            {isCommitted ? 'Values Locked' : 'Commit Values'}
          </button>
        </div>
      </div>
    </div>
  );
}