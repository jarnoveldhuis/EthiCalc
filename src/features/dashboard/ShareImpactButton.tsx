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
    // !!! IMPORTANT: Replace 'https://your-app-url.com/dashboard' with your actual URL !!!
    const shareLink = `https://your-app-url.com/dashboard?sharedValues=${encodeURIComponent(valueParams)}`; 

    return `${overallImpactText}\n\n${valuesText}\nCheck out Virtue Balance & set your values!\n${shareLink}`;
  }, [userValueSettings, overallRatio, totalPositiveImpact]); // Dependencies are correct

  const handleShare = useCallback(async () => {
    // ... (clipboard logic remains the same) ...
     const shareText = generateShareText();
     const successFeedback = 'Copied Impact & Values to Clipboard!';
     const errorFeedback = 'Copying failed.';
     setFeedback(null);
     if (navigator.clipboard && navigator.clipboard.writeText) {
       try { await navigator.clipboard.writeText(shareText); setFeedback(successFeedback); }
       catch (error) { console.error('Clipboard write failed:', error); setFeedback(errorFeedback); }
     } else {
       try {
         const textArea = document.createElement("textarea"); textArea.value = shareText; textArea.style.position = "fixed"; textArea.style.left = "-9999px"; document.body.appendChild(textArea); textArea.focus(); textArea.select(); document.execCommand('copy'); document.body.removeChild(textArea); setFeedback(successFeedback);
       } catch (error) { console.error('Fallback copy failed:', error); alert("Copying not supported. Please copy the text manually:\n\n" + shareText); setFeedback('Manual copy needed.'); }
     }
     setTimeout(() => setFeedback(null), 3500);
  }, [generateShareText]);

  if (!userValueSettings || Object.keys(userValueSettings).length < VALUE_CATEGORIES.length) {
     // Don't render if value settings aren't fully loaded
     return null;
  }

  return (
    <div className={`mt-4 text-center ${className}`}>
      <button onClick={handleShare} className="..."> {/* Your button styling */}
        Share My Impact & Values
      </button>
      {feedback && ( <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 animate-pulse">{feedback}</p> )}
    </div>
  );
}