// src/features/dashboard/ShareImpactButton.tsx
"use client";

import React, { useState, useCallback } from 'react';
import { valueEmojis } from '@/config/valueEmojis'; // Adjust path if needed
import { generateEmojiSquares } from '@/shared/utils/emojiUtils'; // Import ONLY the updated helper

// Define the structure for category data prop
interface CategoryImpactData {
  [categoryName: string]: {
    score: number;
    // Include other fields if needed
  };
}

// --- Updated Props ---
interface ShareImpactButtonProps {
  categoryData: CategoryImpactData;
  // Pass only the ratio and total positive impact
  overallRatio: number | null;
  totalPositiveImpact: number; // Needed to determine "Positive" vs "Neutral" when ratio is null
  className?: string;
}

export function ShareImpactButton({
    categoryData,
    overallRatio,
    totalPositiveImpact, // Receive total positive impact
    className = ""
}: ShareImpactButtonProps) {
  const [feedback, setFeedback] = useState<string | null>(null);

  const generateShareText = useCallback(() => {
    let overallImpactText: string;

    // --- Determine Overall Impact Text ---
    if (overallRatio === null) {
        // Handle cases with no negative impact (ratio is null)
        overallImpactText = totalPositiveImpact > 0
            ? "Overall Impact: Positive ✅" // Or use an emoji
            : "Overall Impact: Neutral ⚫";
    } else {
        // Format the ratio as a percentage
        const percentage = Math.max(0, Math.round(overallRatio * 100)); // Ensure percentage isn't negative
        overallImpactText = `⭐ Overall Score: ${percentage}%`;
    }

    // Start the share text
    let text = `${overallImpactText}:\n`;

    // Add category breakdown (uses the updated 5-square generateEmojiSquares)
    const sortedCategories = Object.keys(categoryData).sort();
    sortedCategories.forEach(categoryName => {
      const emoji = valueEmojis[categoryName] || valueEmojis["Default Category"];
      const score = categoryData[categoryName]?.score ?? 0;
      const squares = generateEmojiSquares(score); // Calls the updated 5-square function
      text += `${emoji} ${squares} ${categoryName}\n`;
    });
    return text.trim();
  }, [categoryData, overallRatio, totalPositiveImpact]); // Add totalPositiveImpact dependency

  const handleShare = useCallback(async () => {
    const shareText = generateShareText();
    const successFeedback = 'Copied Results to Clipboard';
    const errorFeedback = 'Copying failed.';
    setFeedback(null); // Clear previous feedback

    if (navigator.clipboard) {
      try {
        // Use Clipboard API only
        await navigator.clipboard.writeText(shareText);
        setFeedback(successFeedback);
      } catch (error) {
        console.error('Clipboard write failed:', error);
        setFeedback(errorFeedback);
      }
    } else {
      // Basic fallback if clipboard is not available
      alert("Copying not supported. Please copy the text manually:\n\n" + shareText);
      setFeedback('Manual copy needed.');
    }

    // Clear feedback message after a few seconds
    setTimeout(() => setFeedback(null), 3000);

  }, [generateShareText]);

  // Don't render if category data isn't ready
  if (!categoryData || Object.keys(categoryData).length === 0) {
     return null;
  }

  return (
    <div className={`mt-4 text-center ${className}`}>
      <button
        onClick={handleShare}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        Virtue Signal
      </button>
      {feedback && (
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">{feedback}</p>
      )}
    </div>
  );
}