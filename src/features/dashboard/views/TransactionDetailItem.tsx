// src/features/dashboard/views/TransactionDetailItem.tsx
"use client";

import React, { useState } from "react";
import { Transaction, Citation } from "@/shared/types/transactions";
import { getColorClass } from "@/shared/utils/colorUtils";
import { useTransactionStore } from "@/store/transactionStore";

interface TransactionDetailItemProps {
  transaction: Transaction;
}

export function TransactionDetailItem({ transaction }: TransactionDetailItemProps) {
  const [expandedPractices, setExpandedPractices] = useState<Set<string>>(new Set());
  const [citationsVisible, setCitationsVisible] = useState<Record<string, boolean>>({});
  const getUserValueMultiplier = useTransactionStore(state => state.getUserValueMultiplier);

  const {
    date,
    name,
    merchant_name,
    amount,
    unethicalPractices = [],
    ethicalPractices = [],
    practiceWeights = {},
    practiceDebts = {},
    practiceCategories = {},
    information = {},
    citations = {},
  } = transaction;

  const displayName = merchant_name || name;
  const hasDetails = 
    (unethicalPractices.length > 0 || ethicalPractices.length > 0) ||
    Object.keys(information).length > 0 ||
    Object.keys(citations).length > 0;

  const togglePractice = (practice: string) => {
    setExpandedPractices(prev => {
      const newSet = new Set(prev);
      if (newSet.has(practice)) {
        newSet.delete(practice);
      } else {
        newSet.add(practice);
      }
      return newSet;
    });
  };

  const toggleCitations = (practice: string) => {
    setCitationsVisible(prev => ({
      ...prev,
      [practice]: !prev[practice]
    }));
  };

  // Calculate practice debt if not available in practiceDebts
  const getPracticeDebt = (practice: string, isUnethical: boolean): number => {
    if (practiceDebts[practice] !== undefined) {
      return practiceDebts[practice];
    }
    const weight = practiceWeights[practice] || 0;
    const baseDebt = amount * (weight / 100);
    if (isUnethical) {
      const categoryName = practiceCategories[practice];
      const multiplier = getUserValueMultiplier(categoryName);
      return baseDebt * multiplier;
    }
    return -baseDebt; // Negative for ethical practices
  };

  const allPractices = [
    ...unethicalPractices.map(practice => ({
      practice,
      weight: practiceWeights[practice] || 0,
      category: practiceCategories[practice] || "Unknown",
      type: "unethical" as const,
      debt: getPracticeDebt(practice, true),
      information: information[practice],
      citations: citations[practice] || [],
    })),
    ...ethicalPractices.map(practice => ({
      practice,
      weight: practiceWeights[practice] || 0,
      category: practiceCategories[practice] || "Unknown",
      type: "ethical" as const,
      debt: getPracticeDebt(practice, false),
      information: information[practice],
      citations: citations[practice] || [],
    }))
  ];

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
      {/* Main Transaction Header */}
      <div className="p-3">
        <div className="flex justify-between items-start gap-4">
          <div className="flex-grow min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                {displayName}
              </h3>
              <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                {new Date(date).toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric',
                  year: 'numeric'
                })}
              </span>
            </div>
          </div>
          <div className="flex-shrink-0 text-right">
            <div className="text-base font-bold text-gray-900 dark:text-gray-100">
              ${amount.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* Practice Cards - Always visible, individually expandable */}
      {hasDetails && allPractices.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 p-3 space-y-2">
          {allPractices.map((practiceInfo, idx) => {
            const isPracticeExpanded = expandedPractices.has(practiceInfo.practice);
            const hasExpandableContent = practiceInfo.information || (practiceInfo.citations && practiceInfo.citations.length > 0);
            
            return (
              <div 
                key={idx}
                className={`p-2 rounded ${
                  practiceInfo.type === "unethical" 
                    ? "bg-black/5 dark:bg-white/5 border-l-2 border-gray-400 dark:border-gray-500"
                    : "bg-black/10 dark:bg-white/10 border-l-2 border-gray-600 dark:border-gray-400"
                }`}
              >
                <div 
                  className={`flex justify-between items-start ${hasExpandableContent ? 'cursor-pointer' : ''}`}
                  onClick={() => hasExpandableContent && togglePractice(practiceInfo.practice)}
                >
                  <div className="flex-grow min-w-0">
                    <div className="font-medium text-sm text-gray-900 dark:text-gray-100">
                      {practiceInfo.practice}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      {practiceInfo.category} • {practiceInfo.weight}% weight
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right ml-4 flex items-center gap-2">
                    <div className={`text-xs font-medium ${getColorClass(practiceInfo.debt)}`}>
                      {practiceInfo.debt >= 0 ? '+' : '-'}${Math.abs(practiceInfo.debt).toFixed(2)}
                    </div>
                    {hasExpandableContent && (
                      <svg
                        className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform ${isPracticeExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    )}
                  </div>
                </div>
                
                {/* Expandable content */}
                {isPracticeExpanded && (
                  <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                    {practiceInfo.information && (
                      <p className="text-xs text-gray-700 dark:text-gray-300 mb-2 italic">
                        {practiceInfo.information}
                      </p>
                    )}

                    {practiceInfo.citations && practiceInfo.citations.length > 0 && (
                      <div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleCitations(practiceInfo.practice);
                          }}
                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
                        >
                          {citationsVisible[practiceInfo.practice] ? 'Hide' : 'Show'} Sources ({practiceInfo.citations.length})
                        </button>
                        {citationsVisible[practiceInfo.practice] && (
                          <ul className="mt-1 ml-4 list-disc space-y-0.5">
                            {practiceInfo.citations.map((citation: Citation, citeIdx: number) => (
                              <li key={citeIdx} className="text-xs">
                                <a
                                  href={citation.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 dark:text-blue-400 hover:underline break-all"
                                >
                                  {citation.title || citation.url}
                                </a>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
