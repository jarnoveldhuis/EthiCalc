// src/features/values/UserValuesModal.tsx
"use client";

import React, { useMemo } from "react";
import { UserValuesEditor } from "./UserValuesEditor";
import { useTransactionStore } from "@/store/transactionStore";
import { TOTAL_VALUE_POINTS } from "@/config/valuesConfig";

interface UserValuesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCommit: () => Promise<void>;
}

export function UserValuesModal({ isOpen, onClose, onCommit }: UserValuesModalProps) {
  // --- FIX: Hooks are now at the top level ---
  const userValueSettings = useTransactionStore((state) => state.userValueSettings);

  const { currentTotal, isTotalValid } = useMemo(() => {
    const total = Object.values(userValueSettings.levels || {}).reduce(
      (sum, level) => sum + level,
      0
    );
    return {
      currentTotal: total,
      isTotalValid: total === TOTAL_VALUE_POINTS,
    };
  }, [userValueSettings]);

  // --- Conditional return is now AFTER all hooks ---
  if (!isOpen) return null;

  const handleCommit = async () => {
    if (!isTotalValid) return;
    await onCommit();
  };

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
          {/* --- FIX: Replaced quotes with single quotes --- */}
          <p className="text-sm text-gray-600 dark:text-gray-300">
            You have a Value Budget of <strong>{TOTAL_VALUE_POINTS} points</strong> to allocate across categories. Drag to set priority, and click the squares to set value.
          </p>
          <UserValuesEditor />
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
            disabled={!isTotalValid}
            className="px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-md hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            title={isTotalValid ? "Lock in your values for this month" : `You must allocate exactly ${TOTAL_VALUE_POINTS} points.`}
          >
            Commit Values
          </button>
        </div>
      </div>
    </div>
  );
}