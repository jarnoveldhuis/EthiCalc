// src/features/dashboard/views/TransactionDetailItem.tsx
"use client";

import React, { useState } from "react";
import { Transaction, Citation } from "@/shared/types/transactions";
import { getColorClass } from "@/shared/utils/colorUtils";

interface TransactionDetailItemProps {
  transaction: Transaction;
}

export function TransactionDetailItem({ transaction }: TransactionDetailItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [citationsVisible, setCitationsVisible] = useState<Record<string, boolean>>({});

  const {
    date,
    name,
    merchant_name,
    amount,
    societalDebt = 0,
    unethicalPractices = [],
    ethicalPractices = [],
    practiceWeights = {},
    practiceCategories = {},
    information = {},
    citations = {},
    plaidCategories = [],
  } = transaction;

  const displayName = merchant_name || name;
  const hasDetails = 
    (unethicalPractices.length > 0 || ethicalPractices.length > 0) ||
    Object.keys(information).length > 0 ||
    Object.keys(citations).length > 0 ||
    (plaidCategories && plaidCategories.length > 0);

  const toggleCitations = (practice: string) => {
    setCitationsVisible(prev => ({
      ...prev,
      [practice]: !prev[practice]
    }));
  };

  const allPractices = [
    ...unethicalPractices.map(practice => ({
      practice,
      weight: practiceWeights[practice] || 0,
      category: practiceCategories[practice] || "Unknown",
      type: "unethical" as const,
      information: information[practice],
      citations: citations[practice] || [],
    })),
    ...ethicalPractices.map(practice => ({
      practice,
      weight: practiceWeights[practice] || 0,
      category: practiceCategories[practice] || "Unknown",
      type: "ethical" as const,
      information: information[practice],
      citations: citations[practice] || [],
    }))
  ];

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
      {/* Main Transaction Header */}
      <div 
        className={`p-4 ${hasDetails ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50' : ''} transition-colors`}
        onClick={() => hasDetails && setIsExpanded(!isExpanded)}
      >
        <div className="flex justify-between items-start gap-4">
          <div className="flex-grow min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                {displayName}
              </h3>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
              {new Date(date).toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </p>
            {plaidCategories && plaidCategories.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {plaidCategories.map((cat, idx) => (
                  <span 
                    key={idx}
                    className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded"
                  >
                    {cat}
                  </span>
                ))}
              </div>
            )}
            {allPractices.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {allPractices.slice(0, isExpanded ? allPractices.length : 3).map((practiceInfo, idx) => {
                  const bgColor = practiceInfo.type === "unethical"
                    ? "bg-gray-800 dark:bg-gray-600 text-white"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100";
                  
                  return (
                    <span 
                      key={idx} 
                      className={`${bgColor} px-2 py-1 rounded text-xs font-medium`}
                      title={`${practiceInfo.category}: ${practiceInfo.practice}`}
                    >
                      {practiceInfo.practice} ({practiceInfo.weight}%)
                    </span>
                  );
                })}
                {!isExpanded && allPractices.length > 3 && (
                  <span className="text-xs text-gray-500 dark:text-gray-400 self-center">
                    +{allPractices.length - 3} more
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex-shrink-0 text-right">
            <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
              ${amount.toFixed(2)}
            </div>
            <div className={`text-sm font-medium ${getColorClass(societalDebt)}`}>
              {societalDebt >= 0 ? '+' : ''}${societalDebt.toFixed(2)}
            </div>
            {hasDetails && (
              <button
                className="mt-2 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(!isExpanded);
                }}
              >
                {isExpanded ? 'Less' : 'More'} details
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && hasDetails && (
        <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 p-4 space-y-4">
          {allPractices.map((practiceInfo, idx) => (
            <div 
              key={idx}
              className={`p-3 rounded ${
                practiceInfo.type === "unethical" 
                  ? "bg-black/5 dark:bg-white/5 border-l-2 border-gray-400 dark:border-gray-500"
                  : "bg-black/10 dark:bg-white/10 border-l-2 border-gray-600 dark:border-gray-400"
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="font-medium text-sm text-gray-900 dark:text-gray-100">
                    {practiceInfo.practice}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    {practiceInfo.category} • {practiceInfo.weight}% weight
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded ${
                  practiceInfo.type === "unethical"
                    ? "bg-gray-800 dark:bg-gray-600 text-white"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                }`}>
                  {practiceInfo.type === "unethical" ? "Negative" : "Positive"}
                </span>
              </div>
              
              {practiceInfo.information && (
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-2 italic">
                  {practiceInfo.information}
                </p>
              )}

              {practiceInfo.citations && practiceInfo.citations.length > 0 && (
                <div className="mt-2">
                  <button
                    onClick={() => toggleCitations(practiceInfo.practice)}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
                  >
                    {citationsVisible[practiceInfo.practice] ? 'Hide' : 'Show'} Sources ({practiceInfo.citations.length})
                  </button>
                  {citationsVisible[practiceInfo.practice] && (
                    <ul className="mt-2 ml-4 list-disc space-y-1">
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
          ))}
        </div>
      )}
    </div>
  );
}
