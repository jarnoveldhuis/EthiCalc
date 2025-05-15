"use client";

import React, { useState, useCallback } from "react";
import { useTransactionStore } from "@/store/transactionStore";
import { VALUE_CATEGORIES, NEGATIVE_PRACTICE_MULTIPLIERS } from "@/config/valuesConfig";

interface ShareValuesButtonProps {
  className?: string;
}

export function ShareValuesButton({ className = "" }: ShareValuesButtonProps) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const userValueSettings = useTransactionStore((state) => state.userValueSettings);

  const generateShareText = useCallback((): string => {
    let shareText = "My Ethical Value Offsets:\n";
    VALUE_CATEGORIES.forEach(category => {
      const level = userValueSettings[category.id] || category.defaultLevel;
      const multiplier = NEGATIVE_PRACTICE_MULTIPLIERS[level] !== undefined 
                         ? NEGATIVE_PRACTICE_MULTIPLIERS[level] 
                         : NEGATIVE_PRACTICE_MULTIPLIERS[category.defaultLevel];
      const percentage = (multiplier * 100).toFixed(0);
      shareText += `- ${category.name}: ${percentage}% Offset\n`;
    });
    shareText += "\nAdjust your own values at ValueBalance!";
    return shareText;
  }, [userValueSettings]);

  const handleShare = useCallback(async () => {
    const shareText = generateShareText();
    const successFeedback = 'Copied Values to Clipboard!';
    const errorFeedback = 'Copying failed.';

    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(shareText);
        setFeedback(successFeedback);
      } catch (error) {
        console.error('Clipboard write failed:', error);
        setFeedback(errorFeedback);
      }
    } else {
      // Fallback for browsers that don't support navigator.clipboard
      try {
        const textArea = document.createElement("textarea");
        textArea.value = shareText;
        textArea.style.position = "fixed"; // Prevent scrolling to bottom of page in MS Edge.
        textArea.style.left = "-9999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        setFeedback(successFeedback);
      } catch (error) {
        console.error('Fallback copy failed:', error);
        alert("Copying not supported. Please copy the text manually:\n\n" + shareText);
        setFeedback('Manual copy needed.');
      }
    }
    setTimeout(() => setFeedback(null), 3500);
  }, [generateShareText]);

  if (!userValueSettings || Object.keys(userValueSettings).length === 0) {
    return null; // Don't render if no settings
  }

  return (
    <div className={`inline-block ${className}`}>
      <button
        onClick={handleShare}
        className="px-4 py-2 text-sm font-medium rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors"
      >
        Share Values
      </button>
      <p
        className={`text-xs text-center text-gray-600 dark:text-gray-400 mt-2 transition-opacity duration-300 ease-in-out ${
          feedback ? 'opacity-100 animate-pulse' : 'opacity-0'
        }`}
      >
        {feedback || '\u00A0'} {/* Non-breaking space for layout consistency */}
      </p>
    </div>
  );
} 