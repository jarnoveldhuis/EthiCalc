// src/shared/utils/emojiUtils.ts


// This function generates squares based on the 1-5 level
// It's used for the "Share My Values" grid.
export function generateValueDisplayEmojiSquares(level: number, maxSquares: number = 5): string {
  const filledCount = Math.max(1, Math.min(maxSquares, level)); // Ensure at least 1, max 5
  let squareChar = '🟨'; // Default for Neutral (Level 3)

  if (level === 1) squareChar = '🟥';       // Max De-emphasis
  else if (level === 2) squareChar = '🟧';  // Moderate De-emphasis (Using Tailwind Orange 400/500 colors in UI)
  // Level 3 uses Yellow
  else if (level === 4) squareChar = '🟩';  // Moderate Emphasis (Using Tailwind Lime 500 in UI)
  else if (level === 5) squareChar = '🟩';  // Max Emphasis (Using Tailwind Green 500 in UI)
                                         // Using a slightly different green circle for level 5 for distinction

  const emptySquare = '⬛️';
  return (squareChar.repeat(filledCount) + emptySquare.repeat(maxSquares - filledCount));
}


// This function might still be used for displaying category scores elsewhere if needed,
// but for sharing user *values*, generateValueDisplayEmojiSquares is more direct.
export function generateEmojiSquares(score: number): string {
    const scale = 5; 
    const blackSquare = '⬛️';
    const greenSquare = '🟩';
    const redSquare = '🟥';
  
    const normalizedScore = Math.max(-100, Math.min(100, score)) / 100;
  
    if (normalizedScore >= 0.80) return greenSquare.repeat(5);
    if (normalizedScore >= 0.60) return greenSquare.repeat(4) + blackSquare;
    if (normalizedScore >= 0.40) return greenSquare.repeat(3) + blackSquare.repeat(2);
    if (normalizedScore >= 0.20) return greenSquare.repeat(2) + blackSquare.repeat(3);
    if (normalizedScore > 0)    return greenSquare.repeat(1) + blackSquare.repeat(4);
    if (normalizedScore === 0)   return blackSquare.repeat(scale);
    if (normalizedScore >= -0.20) return redSquare.repeat(1) + blackSquare.repeat(4);
    if (normalizedScore >= -0.40) return redSquare.repeat(2) + blackSquare.repeat(3);
    if (normalizedScore >= -0.60) return redSquare.repeat(3) + blackSquare.repeat(2);
    if (normalizedScore >= -0.80) return redSquare.repeat(4) + blackSquare;
    return redSquare.repeat(5);
  }

// generateOverallGradeSquares can remain as is if you still use it for overall score sharing
// ... (generateOverallGradeSquares function from your uploaded file)
export function generateOverallGradeSquares(
  ratio: number | null, 
  totalNegativeImpact: number,
  totalPositiveImpact: number
): string {
  const scale = 4;
  const blackSquare = "⬛️";
  const greenSquare = "🟩";
  const redSquare = "🟥";

  if (totalNegativeImpact <= 0) {
    return totalPositiveImpact > 0
      ? greenSquare.repeat(scale) 
      : blackSquare.repeat(scale); 
  }

  const effectiveRatio = ratio ?? 0; 

  if (effectiveRatio >= 1.0) return greenSquare.repeat(scale); 
  if (effectiveRatio >= 0.75) return greenSquare.repeat(3) + blackSquare; 
  if (effectiveRatio >= 0.5)
    return greenSquare.repeat(2) + blackSquare.repeat(2); 
  if (effectiveRatio >= 0.25)
    return greenSquare.repeat(1) + blackSquare.repeat(3); 
  if (effectiveRatio > 0) return redSquare.repeat(1) + blackSquare.repeat(3); 
  return redSquare.repeat(2) + blackSquare.repeat(2); 
}