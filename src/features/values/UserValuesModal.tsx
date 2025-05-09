"use client";

import React from "react";
import { UserValuesEditor } from "./UserValuesEditor";
import { ShareImpactButton } from "@/features/dashboard/ShareImpactButton";

interface UserValuesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCommit: () => Promise<void>;
}

export function UserValuesModal({ isOpen, onClose, onCommit }: UserValuesModalProps) {
  if (!isOpen) return null;

  const handleCommit = async () => {
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
        {/* Modal Header */}
        <div className="flex justify-between items-center p-4 sm:p-5 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Customize Your Values
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 text-2xl leading-none p-1"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 flex-grow space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Adjust the sliders to reflect how much each category is negative impact should contribute to your societal debt. Your choices here will directly influence your ethical debt calculation.
          </p>
          <p className="text-sm text-orange-600 dark:text-orange-400 font-semibold">
            Committing your values will lock them until the end of the current month.
          </p>
          <UserValuesEditor />
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between p-3 sm:p-4 border-t border-gray-200 dark:border-gray-700">
          <ShareImpactButton 
            overallRatio={null} 
            totalPositiveImpact={0} 
            className="mt-0"
          />
          <button
            onClick={handleCommit}
            className="px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-md hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors"
          >
            Commit Values
          </button>
        </div>
      </div>
    </div>
  );
} 