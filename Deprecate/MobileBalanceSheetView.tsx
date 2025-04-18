// src/features/dashboard/views/MobileBalanceSheetView.jsx
"use client";

import React, { useState } from 'react';
import { valueEmojis } from '@/config/valueEmojis'; // Assuming path is correct

// Re-define necessary types or import them if shared
interface CombinedImpactDetail {
    vendorName: string;
    practice: string;
    totalImpactAmount: number;
    totalOriginalAmount: number;
    impactWeight: number;
    information?: string;
    citationUrl?: string;
    isPositive: boolean;
    contributingTxCount: number;
}

interface CategoryData {
    name: string;
    icon: string;
    totalPositiveImpact: number;
    totalNegativeImpact: number;
    positiveDetails: CombinedImpactDetail[];
    negativeDetails: CombinedImpactDetail[];
}

interface MobileBalanceSheetViewProps {
    categories: CategoryData[];
    // We don't need onOffset here for simplicity, but could add if needed
}

// Helper function for currency formatting
const formatCurrency = (value: number | undefined | null): string => {
    return `$${(value ?? 0).toFixed(2)}`;
};

// Helper for net impact color
const getNetImpactColor = (netImpact: number): string => {
    if (netImpact > 0.01) return 'text-green-600 dark:text-green-400';
    if (netImpact < -0.01) return 'text-red-600 dark:text-red-400';
    return 'text-gray-500 dark:text-gray-400'; // Neutral
};

export function MobileBalanceSheetView({ categories }: MobileBalanceSheetViewProps) {
    const [expandedMobileCategory, setExpandedMobileCategory] = useState<string | null>(null);

    const toggleMobileExpand = (categoryName: string) => {
        setExpandedMobileCategory(prev => (prev === categoryName ? null : categoryName));
    };

    return (
        <div className="space-y-4">
            {categories.map(category => {
                const netImpact = category.totalPositiveImpact - category.totalNegativeImpact;
                const isExpanded = expandedMobileCategory === category.name;
                const allDetails = [...category.negativeDetails, ...category.positiveDetails]
                                    .sort((a, b) => b.totalImpactAmount - a.totalImpactAmount); // Combine and sort details
                const canExpand = allDetails.length > 0;

                return (
                    <div key={`mobile-cat-${category.name}`} className="card">
                        {/* Mobile Category Header */}
                        <div
                            role={canExpand ? "button" : undefined}
                            tabIndex={canExpand ? 0 : undefined}
                            className={`w-full bg-gray-50 dark:bg-gray-700/[.5] p-3 flex justify-between items-center text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors rounded-t-xl ${canExpand ? 'cursor-pointer' : 'cursor-default'}`}
                            onClick={() => canExpand && toggleMobileExpand(category.name)}
                            onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && canExpand) toggleMobileExpand(category.name); }}
                            aria-expanded={isExpanded}
                        >
                             {/* Left: Icon & Name */}
                            <div className="flex items-center flex-grow min-w-0">
                                <span className="text-lg mr-2 sm:mr-3">{category.icon}</span>
                                <span className="font-semibold text-gray-700 dark:text-gray-200 text-sm truncate mr-3" title={category.name}>
                                    {category.name}
                                </span>
                            </div>
                             {/* Right: Net Impact & Chevron */}
                             <div className="flex items-center flex-shrink-0 gap-2">
                                <span className={`font-bold ${getNetImpactColor(netImpact)} text-sm w-24 text-right`}>
                                    {netImpact >= 0 ? '+' : ''}{formatCurrency(netImpact)} Net
                                </span>
                                {canExpand && (
                                    <svg className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform duration-2000 ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                )}
                             </div>
                        </div>

                        {/* Mobile Expanded Details */}
                        {isExpanded && canExpand && (
                             <div className="p-3 border-t border-[var(--border-color)] space-y-2 max-h-80 overflow-y-auto">
                                {/* Optionally show totals */}
                                <div className="flex justify-between text-xs text-gray-600 dark:text-gray-300 px-1 pb-1 border-b border-dashed">
                                    <span>Negative: <span className="font-medium text-red-600 dark:text-red-400">{formatCurrency(category.totalNegativeImpact)}</span></span>
                                    <span>Positive: <span className="font-medium text-green-600 dark:text-green-400">{formatCurrency(category.totalPositiveImpact)}</span></span>
                                </div>
                                {/* List combined details */}
                                {allDetails.map((detail, index) => (
                                     <div key={`mobile-detail-${category.name}-${index}`} className="text-xs">
                                          <div className="flex justify-between items-center">
                                               <span className="font-medium truncate pr-2">{detail.vendorName} - <span className="text-blue-600 dark:text-blue-400">{detail.practice}</span></span>
                                               <span className={`font-medium flex-shrink-0 ${detail.isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                                  {detail.isPositive ? '+' : '-'}{formatCurrency(detail.totalImpactAmount)}
                                               </span>
                                          </div>
                                          <div className="text-xxs text-gray-500 dark:text-gray-400">
                                                {detail.impactWeight}% impact from {formatCurrency(detail.totalOriginalAmount)}
                                                {detail.contributingTxCount > 1 ? ` (${detail.contributingTxCount} txns)`: ''}
                                          </div>
                                     </div>
                                ))}
                             </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}