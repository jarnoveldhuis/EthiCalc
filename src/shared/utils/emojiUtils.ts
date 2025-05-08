// src/shared/utils/emojiUtils.ts

// Imports removed as VALUE_CATEGORIES, NEUTRAL_LEVEL, UserValueSettings are not used here anymore
// import { VALUE_CATEGORIES, NEUTRAL_LEVEL } from '@/config/valuesConfig';
// import { UserValueSettings } from '@/store/transactionStore';


// Generates squares based on the 1-5 level for "Share My Values"
export function generateValueDisplayEmojiSquares(level: number, maxSquares: number = 5): string {
  const filledCount = Math.max(1, Math.min(maxSquares, level));
  let squareChar = '🟨'; // Neutral (Level 3) Default

  if (level === 1) squareChar = '🟥';
  else if (level === 2) squareChar = '🟧';
  // Level 3 uses Yellow
  else if (level === 4) squareChar = '🟩'; // Lime Green in UI, using standard green here
  else if (level === 5) squareChar = '🟢'; // Green Circle

  const emptySquare = '⬛️';
  // Ensure we don't exceed maxSquares length
  const filledPart = squareChar.repeat(filledCount);
  const emptyPart = emptySquare.repeat(Math.max(0, maxSquares - filledCount));
  
  return (filledPart + emptyPart);
}

// Generates squares based on a 0-100 score (keep if used elsewhere)
export function generateEmojiSquares(score: number): string {
    // ... (implementation from previous response is correct) ...
    const scale = 5; const blackSquare = '⬛️'; const greenSquare = '🟩'; const redSquare = '🟥';
    const normalizedScore = Math.max(-100, Math.min(100, score)) / 100;
    if (normalizedScore >= 0.80) return greenSquare.repeat(5); if (normalizedScore >= 0.60) return greenSquare.repeat(4) + blackSquare; if (normalizedScore >= 0.40) return greenSquare.repeat(3) + blackSquare.repeat(2); if (normalizedScore >= 0.20) return greenSquare.repeat(2) + blackSquare.repeat(3); if (normalizedScore > 0) return greenSquare.repeat(1) + blackSquare.repeat(4); if (normalizedScore === 0) return blackSquare.repeat(scale); if (normalizedScore >= -0.20) return redSquare.repeat(1) + blackSquare.repeat(4); if (normalizedScore >= -0.40) return redSquare.repeat(2) + blackSquare.repeat(3); if (normalizedScore >= -0.60) return redSquare.repeat(3) + blackSquare.repeat(2); if (normalizedScore >= -0.80) return redSquare.repeat(4) + blackSquare; return redSquare.repeat(5);
}

// Generates overall grade squares (keep if used elsewhere)
export function generateOverallGradeSquares(
  ratio: number | null,
  totalNegativeImpact: number,
  totalPositiveImpact: number
): string {
    // ... (implementation from previous response is correct) ...
    const scale = 4; const blackSquare = "⬛️"; const greenSquare = "🟩"; const redSquare = "🟥";
    if (totalNegativeImpact <= 0) { return totalPositiveImpact > 0 ? greenSquare.repeat(scale) : blackSquare.repeat(scale); }
    const effectiveRatio = ratio ?? 0;
    if (effectiveRatio >= 1.0) return greenSquare.repeat(scale); if (effectiveRatio >= 0.75) return greenSquare.repeat(3) + blackSquare; if (effectiveRatio >= 0.5) return greenSquare.repeat(2) + blackSquare.repeat(2); if (effectiveRatio >= 0.25) return greenSquare.repeat(1) + blackSquare.repeat(3); if (effectiveRatio > 0) return redSquare.repeat(1) + blackSquare.repeat(3); return redSquare.repeat(2) + blackSquare.repeat(2);
}