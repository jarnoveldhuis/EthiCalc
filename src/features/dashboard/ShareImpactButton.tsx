// src/features/dashboard/ShareImpactButton.tsx
"use client";

import React, { useState, useCallback } from 'react';
import { useTransactionStore /* UserValueSettings */ } from '@/store/transactionStore'; // Removed unused import
import { VALUE_CATEGORIES, NEUTRAL_LEVEL } from '@/config/valuesConfig';
import { generateValueDisplayEmojiSquares } from '@/shared/utils/emojiUtils';

interface ShareImpactButtonProps {
  overallRatio: number | null;
  totalPositiveImpact: number;
  className?: string;
}

export function ShareImpactButton({
    overallRatio,
    totalPositiveImpact,
    className = ""
}: ShareImpactButtonProps) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const userValueSettings = useTransactionStore((state) => state.userValueSettings);

  const generateShareText = useCallback(() => {
    let overallImpactText: string;
    if (overallRatio === null) {
        overallImpactText = totalPositiveImpact > 0 ? "Overall Impact: Positive ✅" : "Overall Impact: Neutral ⚫";
    } else {
        const percentage = Math.max(0, Math.round(overallRatio * 100));
        overallImpactText = `⭐ My Value-Weighted Score: ${percentage}% Balanced`;
    }

    let valuesText = "My Values:\n";
    // Sort categories by the order defined in VALUE_CATEGORIES for consistent output
    VALUE_CATEGORIES.forEach(categoryDef => {
      const userLevel = userValueSettings[categoryDef.id] || NEUTRAL_LEVEL;
      const squares = generateValueDisplayEmojiSquares(userLevel, 5);
      valuesText += `${categoryDef.emoji} ${squares} ${categoryDef.name}\n`;
    });

    const valueParams = VALUE_CATEGORIES.map(cat => `${cat.id}:${userValueSettings[cat.id] || NEUTRAL_LEVEL}`).join(',');

    const shareLink = `https://mordebt.vercel.app/dashboard?sharedValues=${encodeURIComponent(valueParams)}`; 

    return `${overallImpactText}\n\n${valuesText}\nCheck out Virtue Balance & set your values!\n${shareLink}`;
  }, [userValueSettings, overallRatio, totalPositiveImpact]); // Dependencies are correct

  const handleShare = useCallback(async () => {
    const shareText = generateShareText();
    const successFeedback = 'Copied Impact & Values to Clipboard!';
    const errorFeedback = 'Copying failed.';
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try { 
        await navigator.clipboard.writeText(shareText); 
        setFeedback(successFeedback); 
      }
      catch (error) { 
        console.error('Clipboard write failed:', error); 
        setFeedback(errorFeedback); 
      }
    } else {
      try {
        const textArea = document.createElement("textarea"); 
        textArea.value = shareText; 
        textArea.style.position = "fixed"; 
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

  if (!userValueSettings || Object.keys(userValueSettings).length < VALUE_CATEGORIES.length) {
     return null;
  }

  return (
    <div className={`inline-block ${className}`}>
        <button
          onClick={handleShare}
          className="text-xs px-3 py-1 border border-blue-500 text-blue-600 dark:text-blue-400 dark:border-blue-400 rounded hover:bg-blue-50 dark:hover:bg-blue-900/[0.3] whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
        Share Impact
      </button>
      <p 
        className={`text-xs text-center text-gray-600 dark:text-gray-400 mt-2 transition-opacity duration-300 ease-in-out ${
          feedback ? 'opacity-100 animate-pulse' : 'opacity-0'
        }`}
      >
        {feedback || '\u00A0'}
      </p>
    </div>
  );
}
