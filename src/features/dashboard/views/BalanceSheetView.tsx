"use client";

import React, { useState, useMemo } from "react";
import { Transaction } from "@/shared/types/transactions";
import { DonationModal } from "@/features/charity/DonationModal";
import { useDonationModal } from "@/hooks/useDonationModal";

interface BalanceSheetViewProps {
  transactions: Transaction[];
  totalSocietalDebt: number;
}

interface PracticeItem {
  practice: string;
  amount: number;
  isPositive: boolean;
  vendorContributions: {
    vendorName: string;
    amount: number;
    percentage: number;
  }[];
  information: string;
  category: string;
}

interface CategoryData {
  name: string;
  totalImpact: number;
  practices: PracticeItem[];
}

export function BalanceSheetView({
  transactions,
  totalSocietalDebt,
}: BalanceSheetViewProps) {
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const { modalState, openDonationModal, closeDonationModal } = useDonationModal();

  // Process transactions to get positive and negative categories
  const {
    positiveCategories,
    negativeCategories,
    totalPositive,
    totalNegative,
  } = useMemo(() => {
    // Create maps to hold category data
    const positiveCategoryMap = new Map<string, CategoryData>();
    const negativeCategoryMap = new Map<string, CategoryData>();

    // Process each transaction
    transactions.forEach((tx) => {
      // Process ethical practices (positive impact)
      (tx.ethicalPractices || []).forEach((practice) => {
        const category = tx.practiceCategories?.[practice] || "Uncategorized";
        const weight = tx.practiceWeights?.[practice] || 0;
        const impact = -1 * (tx.amount * (weight / 100)); // Negative value = positive impact
        const info = tx.information?.[practice] || "";

        // Get or create the category
        if (!positiveCategoryMap.has(category)) {
          positiveCategoryMap.set(category, {
            name: category,
            totalImpact: 0,
            practices: [],
          });
        }

        const categoryData = positiveCategoryMap.get(category)!;

        // Find existing practice or create new one
        let practiceItem = categoryData.practices.find(
          (p) => p.practice === practice
        );

        if (!practiceItem) {
          practiceItem = {
            practice,
            amount: 0,
            isPositive: true,
            vendorContributions: [],
            information: info,
            category,
          };
          categoryData.practices.push(practiceItem);
        }

        // Update practice amount
        practiceItem.amount += impact;
        categoryData.totalImpact += impact;

        // Add vendor contribution
        const existingVendor = practiceItem.vendorContributions.find(
          (v) => v.vendorName === tx.name
        );
        if (existingVendor) {
          existingVendor.amount += impact;
        } else {
          practiceItem.vendorContributions.push({
            vendorName: tx.name || "Unknown",
            amount: impact,
            percentage: 0, // Will calculate later
          });
        }
      });

      // Process unethical practices (negative impact)
      (tx.unethicalPractices || []).forEach((practice) => {
        const category = tx.practiceCategories?.[practice] || "Uncategorized";
        const weight = tx.practiceWeights?.[practice] || 0;
        const impact = tx.amount * (weight / 100); // Positive value = negative impact
        const info = tx.information?.[practice] || "";

        // Get or create the category
        if (!negativeCategoryMap.has(category)) {
          negativeCategoryMap.set(category, {
            name: category,
            totalImpact: 0,
            practices: [],
          });
        }

        const categoryData = negativeCategoryMap.get(category)!;

        // Find existing practice or create new one
        let practiceItem = categoryData.practices.find(
          (p) => p.practice === practice
        );

        if (!practiceItem) {
          practiceItem = {
            practice,
            amount: 0,
            isPositive: false,
            vendorContributions: [],
            information: info,
            category,
          };
          categoryData.practices.push(practiceItem);
        }

        // Update practice amount
        practiceItem.amount += impact;
        categoryData.totalImpact += impact;

        // Add vendor contribution
        const existingVendor = practiceItem.vendorContributions.find(
          (v) => v.vendorName === tx.name
        );
        if (existingVendor) {
          existingVendor.amount += impact;
        } else {
          practiceItem.vendorContributions.push({
            vendorName: tx.name || "Unknown",
            amount: impact,
            percentage: 0, // Will calculate later
          });
        }
      });
    });

    // Calculate percentages for all vendor contributions
    for (const category of positiveCategoryMap.values()) {
      for (const practice of category.practices) {
        const totalPracticeAmount = Math.abs(practice.amount);
        practice.vendorContributions.forEach((vendor) => {
          vendor.percentage =
            totalPracticeAmount > 0
              ? (Math.abs(vendor.amount) / totalPracticeAmount) * 100
              : 0;
        });

        // Sort vendor contributions by percentage
        practice.vendorContributions.sort(
          (a, b) => b.percentage - a.percentage
        );
      }

      // Sort practices by impact amount
      category.practices.sort(
        (a, b) => Math.abs(b.amount) - Math.abs(a.amount)
      );
    }

    for (const category of negativeCategoryMap.values()) {
      for (const practice of category.practices) {
        const totalPracticeAmount = practice.amount;
        practice.vendorContributions.forEach((vendor) => {
          vendor.percentage =
            totalPracticeAmount > 0
              ? (vendor.amount / totalPracticeAmount) * 100
              : 0;
        });

        // Sort vendor contributions by percentage
        practice.vendorContributions.sort(
          (a, b) => b.percentage - a.percentage
        );
      }

      // Sort practices by impact amount
      category.practices.sort((a, b) => b.amount - a.amount);
    }

    // Calculate totals
    const totalPos = Array.from(positiveCategoryMap.values()).reduce(
      (sum, cat) => sum + Math.abs(cat.totalImpact),
      0
    );

    const totalNeg = Array.from(negativeCategoryMap.values()).reduce(
      (sum, cat) => sum + cat.totalImpact,
      0
    );

    // Convert to arrays sorted by impact
    const positiveCategories = Array.from(positiveCategoryMap.values()).sort(
      (a, b) => Math.abs(b.totalImpact) - Math.abs(a.totalImpact)
    );

    const negativeCategories = Array.from(negativeCategoryMap.values()).sort(
      (a, b) => b.totalImpact - a.totalImpact
    );

    return {
      positiveCategories,
      negativeCategories,
      totalPositive: totalPos,
      totalNegative: totalNeg,
    };
  }, [transactions]);

  // Toggle category expansion
  const toggleCategory = (categoryName: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [categoryName]: !prev[categoryName],
    }));
  };

  // Helper to get category icon
  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      "Climate Change": "🌍",
      "Environmental Impact": "🌳",
      "Social Responsibility": "👥",
      "Labor Practices": "👷‍♂️",
      "Digital Rights": "💻",
      "Animal Welfare": "🐾",
      "Food Insecurity": "🍽️",
      Poverty: "💰",
      Conflict: "⚔️",
      Inequality: "⚖️",
      "Public Health": "🏥",
      Uncategorized: "❓",
    };

    return icons[category] || "❓";
  };

  // Handle practice offset
  const handleOffsetPractice = (practice: string) => {
    // Find the total impact for this practice
    let totalImpact = 0;
    transactions.forEach(tx => {
      if (tx.unethicalPractices?.includes(practice)) {
        totalImpact += tx.practiceDebts?.[practice] || 0;
      }
    });

    openDonationModal(practice, totalImpact);
  };

  // Handle category offset
  const handleOffsetCategory = (category: string) => {
    const categoryData = negativeCategories.find(c => c.name === category);
    if (!categoryData) return;
    
    openDonationModal(category, categoryData.totalImpact);
  };

  // Handle offset all
  const handleOffsetAll = () => {
    openDonationModal("All Societal Debt", totalSocietalDebt);
  };

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">
        Ethical Balance Sheet
      </h2>

      {/* Balance Sheet Header with progress bar */}
      <div className="mb-8">
        <div className="flex justify-between text-sm mb-1">
          <div className="text-green-600 font-medium">
            ${totalPositive.toFixed(2)} Positive Impact
          </div>
          <div className="text-red-600 font-medium">
            ${totalNegative.toFixed(2)} Negative Impact
          </div>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
          {/* Positive impact (green) */}
          <div
            className="bg-green-500 h-full float-left"
            style={{
              width: `${Math.min(
                (totalPositive / (totalPositive + totalNegative || 1)) * 100,
                100
              )}%`,
            }}
          />
          {/* Negative impact (red) */}
          <div
            className="bg-red-500 h-full float-right"
            style={{
              width: `${Math.min(
                (totalNegative / (totalPositive + totalNegative || 1)) * 100,
                100
              )}%`,
            }}
          />
        </div>
      </div>

      {/* Two-column layout for desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Positive Impact Column */}
        <div>
          <div className="bg-green-50 border-green-200 border rounded-lg p-4 mb-4">
            <h3 className="text-xl font-bold text-green-800">
              Positive Impact{" "}
              <span className="text-green-600">
                ${totalPositive.toFixed(2)}
              </span>
            </h3>
          </div>

          {positiveCategories.length === 0 ? (
            <div className="bg-white border rounded-lg p-6 text-center">
              <p className="text-gray-500">
                No positive impact categories found
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {positiveCategories.map((category, index) => (
                <div
                  key={`pos-${index}`}
                  className="bg-white border rounded-lg overflow-hidden shadow-sm"
                >
                  {/* Category Header */}
                  <div
                    className="bg-green-50 border-b border-green-100 p-3 cursor-pointer flex justify-between items-center"
                    onClick={() => toggleCategory(`pos-${category.name}`)}
                  >
                    <div className="flex items-center">
                      <span className="text-xl mr-2">
                        {getCategoryIcon(category.name)}
                      </span>
                      <h4 className="font-bold text-green-800">
                        {category.name}
                      </h4>
                    </div>
                    <div className="flex items-center">
                      <span className="font-bold text-green-600 mr-2">
                        ${Math.abs(category.totalImpact).toFixed(2)}
                      </span>
                      <span className="text-gray-400">
                        {expandedCategories[`pos-${category.name}`] ? "▲" : "▼"}
                      </span>
                    </div>
                  </div>

                  {/* Category Details */}
                  {expandedCategories[`pos-${category.name}`] && (
                    <div className="p-3 divide-y divide-gray-100">
                      {category.practices.map((practice, practiceIndex) => (
                        <div key={practiceIndex} className="py-3">
                          <div className="flex justify-between items-center mb-2">
                            <div className="flex items-center">
                              <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                                {practice.practice}
                              </span>
                            </div>
                            <span className="font-bold text-green-600">
                              ${Math.abs(practice.amount).toFixed(2)}
                            </span>
                          </div>

                          {/* Vendor tags */}
                          <div className="flex flex-wrap gap-2 mt-2">
                            {practice.vendorContributions.map(
                              (vendor, vendorIndex) => (
                                <div
                                  key={vendorIndex}
                                  className={`${
                                    practice.isPositive ? "bg-green-50" : "bg-red-50"
                                  } p-2 rounded-lg border ${
                                    practice.isPositive ? "border-green-200" : "border-red-200"
                                  }`}
                                >
                                  <div className="font-medium text-sm">
                                    {vendor.vendorName}
                                  </div>
                                  <div className={`text-sm ${
                                    practice.isPositive ? "text-green-700" : "text-red-700"
                                  }`}>
                                    ${Math.abs(vendor.amount).toFixed(2)} ({vendor.percentage.toFixed(1)}%)
                                  </div>
                                  {practice.information && (
                                    <div className="text-xs text-gray-600 mt-1">
                                      {practice.information}
                                    </div>
                                  )}
                                </div>
                              )
                            )}
                          </div>

                          {/* Progress bar showing impact distribution */}
                          {practice.vendorContributions.length > 1 && (
                            <div className="mt-2">
                              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                                {practice.vendorContributions.map(
                                  (vendor, i) => {
                                    // Get a color based on vendor index (cycle through hues)
                                    const hue = (120 + i * 30) % 360; // Start with green (120) and rotate
                                    return (
                                      <div
                                        key={i}
                                        className="h-full float-left"
                                        style={{
                                          width: `${vendor.percentage}%`,
                                          backgroundColor: `hsl(${hue}, 70%, 80%)`,
                                        }}
                                        title={`${
                                          vendor.vendorName
                                        }: ${vendor.percentage.toFixed(1)}%`}
                                      />
                                    );
                                  }
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Negative Impact Column */}
        <div>
          <div className="bg-red-50 border-red-200 border rounded-lg p-4 mb-4">
            <h3 className="text-xl font-bold text-red-800 flex justify-between">
              <span>Negative Impact</span>{" "}
              <span className="text-red-600">${totalNegative.toFixed(2)}</span>
            </h3>
          </div>

          {negativeCategories.length === 0 ? (
            <div className="bg-white border rounded-lg p-6 text-center">
              <p className="text-gray-500">
                No negative impact categories found
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {negativeCategories.map((category, index) => (
                <div
                  key={`neg-${index}`}
                  className="bg-white border rounded-lg overflow-hidden shadow-sm"
                >
                  {/* Category Header */}
                  <div
                    className="bg-red-50 border-b border-red-100 p-3 cursor-pointer"
                    onClick={() => toggleCategory(`neg-${category.name}`)}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center">
                        <span className="text-xl mr-2">
                          {getCategoryIcon(category.name)}
                        </span>
                        <h4 className="font-bold text-red-800">
                          {category.name}
                        </h4>
                      </div>
                      <div className="flex items-center">
                        <span className="font-bold text-red-600 mr-2">
                          ${category.totalImpact.toFixed(2)}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOffsetCategory(category.name);
                          }}
                          className="bg-green-500 hover:bg-green-600 text-white text-xs px-2 py-1 rounded mr-2"
                        >
                          Offset
                        </button>
                        <span className="text-gray-400">
                          {expandedCategories[`neg-${category.name}`]
                            ? "▲"
                            : "▼"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Category Details */}
                  {expandedCategories[`neg-${category.name}`] && (
                    <div className="p-3 divide-y divide-gray-100">
                      {category.practices.map((practice, practiceIndex) => (
                        <div key={practiceIndex} className="py-3">
                          <div className="flex justify-between items-center mb-2">
                            <div className="flex items-center">
                              <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-medium">
                                {practice.practice}
                              </span>
                            </div>
                            <div className="flex items-center">
                              <span className="font-bold text-red-600 mr-2">
                                ${practice.amount.toFixed(2)}
                              </span>
                              <button
                                onClick={() =>
                                  handleOffsetPractice(practice.practice)
                                }
                                className="bg-green-500 hover:bg-green-600 text-white text-xs px-2 py-1 rounded"
                              >
                                Offset
                              </button>
                            </div>
                          </div>

                          {/* Vendor tags */}
                          <div className="flex flex-wrap gap-2 mt-2">
                            {practice.vendorContributions.map(
                              (vendor, vendorIndex) => (
                                <div
                                  key={vendorIndex}
                                  className={`${
                                    practice.isPositive ? "bg-green-50" : "bg-red-50"
                                  } p-2 rounded-lg border ${
                                    practice.isPositive ? "border-green-200" : "border-red-200"
                                  }`}
                                >
                                  <div className="font-medium text-sm">
                                    {vendor.vendorName}
                                  </div>
                                  <div className={`text-sm ${
                                    practice.isPositive ? "text-green-700" : "text-red-700"
                                  }`}>
                                    ${Math.abs(vendor.amount).toFixed(2)} ({vendor.percentage.toFixed(1)}%)
                                  </div>
                                  {practice.information && (
                                    <div className="text-xs text-gray-600 mt-1">
                                      {practice.information}
                                    </div>
                                  )}
                                </div>
                              )
                            )}
                          </div>

                          {/* Progress bar showing impact distribution */}
                          {practice.vendorContributions.length > 1 && (
                            <div className="mt-2">
                              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                                {practice.vendorContributions.map(
                                  (vendor, i) => {
                                    // Get a color based on vendor index (cycle through reds)
                                    const hue = 0; // Red
                                    const lightness = 80 - i * 5; // Decrease lightness for each vendor
                                    return (
                                      <div
                                        key={i}
                                        className="h-full float-left"
                                        style={{
                                          width: `${vendor.percentage}%`,
                                          backgroundColor: `hsl(${hue}, 70%, ${lightness}%)`,
                                        }}
                                        title={`${
                                          vendor.vendorName
                                        }: ${vendor.percentage.toFixed(1)}%`}
                                      />
                                    );
                                  }
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Net Impact Summary */}
      <div className="mt-8 pt-4 border-t-2 border-gray-200">
        <div className="flex justify-between items-center">
          <div className="text-xl font-bold">Net Impact:</div>
          <div
            className={`text-xl font-bold ${
              totalSocietalDebt > 0 ? "text-red-600" : "text-green-600"
            }`}
          >
            ${Math.abs(totalSocietalDebt).toFixed(2)}{" "}
            {totalSocietalDebt > 0 ? "Negative" : "Positive"}
          </div>
        </div>

        {totalSocietalDebt > 0 && (
          <div className="mt-4 flex justify-center">
            <button
              onClick={handleOffsetAll}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-bold shadow transition-colors"
            >
              Offset All (${totalSocietalDebt.toFixed(2)})
            </button>
          </div>
        )}
      </div>

      {/* Donation modal */}
      {modalState.isOpen && (
        <DonationModal
          practice={modalState.practice}
          amount={modalState.amount}
          isOpen={modalState.isOpen}
          onClose={closeDonationModal}
        />
      )}
    </div>
  );
}
