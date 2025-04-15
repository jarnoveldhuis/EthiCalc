// src/shared/utils/emojiUtils.ts (New File)

export function generateEmojiSquares(score: number): string {
    const scale = 5; // Changed to 5 squares
    const blackSquare = '⬛️';
    const greenSquare = '🟩';
    const redSquare = '🟥';
  
    // Normalize score to a 0-1 range for positive, 0-(-1) for negative
    const normalizedScore = Math.max(-100, Math.min(100, score)) / 100;
  
    // 5-Square Thresholds (Adjust as needed)
    if (normalizedScore >= 0.80) return greenSquare.repeat(5);                     // 80%+
    if (normalizedScore >= 0.60) return greenSquare.repeat(4) + blackSquare;        // 60-79%
    if (normalizedScore >= 0.40) return greenSquare.repeat(3) + blackSquare.repeat(2); // 40-59%
    if (normalizedScore >= 0.20) return greenSquare.repeat(2) + blackSquare.repeat(3); // 20-39%
    if (normalizedScore > 0)    return greenSquare.repeat(1) + blackSquare.repeat(4); // >0-19%
    if (normalizedScore === 0)   return blackSquare.repeat(scale);                    // 0%
    if (normalizedScore >= -0.20) return redSquare.repeat(1) + blackSquare.repeat(4); // (-20%)-(-1%)
    if (normalizedScore >= -0.40) return redSquare.repeat(2) + blackSquare.repeat(3); // (-40%)-(-21%)
    if (normalizedScore >= -0.60) return redSquare.repeat(3) + blackSquare.repeat(2); // (-60%)-(-41%)
    if (normalizedScore >= -0.80) return redSquare.repeat(4) + blackSquare;        // (-80%)-(-61%)
    return redSquare.repeat(5);                                                     // <= -80%
  }

export function generateOverallGradeSquares(
  ratio: number | null, // Can be null if totalNegativeImpact is 0
  totalNegativeImpact: number,
  totalPositiveImpact: number
): string {
  const scale = 4;
  const blackSquare = "⬛️";
  const greenSquare = "🟩";
  const redSquare = "🟥";

  // Case 1: No negative impact at all
  if (totalNegativeImpact <= 0) {
    return totalPositiveImpact > 0
      ? greenSquare.repeat(scale) // Equivalent to S tier (Impact Positive)
      : blackSquare.repeat(scale); // Neutral / No activity
  }

  // Case 2: Negative impact exists, use the ratio
  const effectiveRatio = ratio ?? 0; // Treat null ratio (no applied credit) as 0

  if (effectiveRatio >= 1.0) return greenSquare.repeat(scale); // S tier (>= 100% offset)
  if (effectiveRatio >= 0.75) return greenSquare.repeat(3) + blackSquare; // A tier (75-99% offset)
  if (effectiveRatio >= 0.5)
    return greenSquare.repeat(2) + blackSquare.repeat(2); // B tier (50-74% offset)
  if (effectiveRatio >= 0.25)
    return greenSquare.repeat(1) + blackSquare.repeat(3); // C tier (25-49% offset)
  if (effectiveRatio > 0) return redSquare.repeat(1) + blackSquare.repeat(3); // D tier (>0-24% offset) - Show some red as debt exists
  // Ratio is 0 (and negative impact exists)
  return redSquare.repeat(2) + blackSquare.repeat(2); // F tier (0% offset) - Show more red
}
