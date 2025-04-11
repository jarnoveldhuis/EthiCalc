// src/features/charity/CharityRating.tsx
import { EnrichedCharityResult } from '@/features/charity/types';

interface CharityRatingProps {
  charity: EnrichedCharityResult;
}

export function CharityRating({ charity }: CharityRatingProps) {
  // console.log("CharityRating Component Received Props:", JSON.stringify(charity, null, 2)); // Keep for debugging if needed

  const rating = charity.cnRating;
  // console.log("Extracted cnRating:", JSON.stringify(rating, null, 2)); // Keep for debugging if needed

  if (!rating) {
    // console.log("No cnRating found, rendering N/A.");
    return (
      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
        <span>Rating N/A</span>
      </div>
    );
  }
  const scoreValue = rating.score ? parseFloat(String(rating.score)) : NaN;
  const starsValue = rating.ratingStars ? parseFloat(String(rating.ratingStars)) : NaN;

  const scoreExists = !isNaN(scoreValue);
  const starsExist = !isNaN(starsValue) && starsValue >= 0;

  const displayScore = scoreExists ? scoreValue.toFixed(0) : '--';
  const displayStars = starsExist ? Math.max(0, Math.floor(starsValue)) : 0;
  const emptyStars = starsExist ? Math.max(0, 4 - displayStars) : 4;

  return (
    <div className="mt-1 flex items-center space-x-2">
      {/* Star Rating - Use parsed and validated values */}
      {starsExist && displayStars > 0 ? (
        <div className="flex" title={`Rating: ${starsValue.toFixed(1)}/4 Stars`}>
          {/* Solid Stars */}
          {Array.from({ length: displayStars }).map((_, i) => (
            <svg key={`star-solid-${i}`} className="w-3.5 h-3.5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z"/></svg>
          ))}
          {/* Outline Stars */}
          {Array.from({ length: emptyStars }).map((_, i) => (
            <svg key={`star-empty-${i}`} className="w-3.5 h-3.5 text-gray-300 dark:text-gray-500" fill="currentColor" viewBox="0 0 20 20"><path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545L10 15zm0-2.34l4.472 2.35-1.054-5.172 3.756-3.654-5.2-.755L10 1.536 7.026 6.08l-5.2.755 3.756 3.654-1.054 5.172L10 12.66z"/></svg>
          ))}
        </div>
      ) : (
         // Only show "No Stars" if score is also missing or invalid
         !scoreExists && <span className="text-xs text-gray-400 italic">No Rating</span>
      )}

      {/* Numerical Score - Use parsed and validated values */}
      {scoreExists && (
          <span className="text-xs font-medium text-gray-600 dark:text-gray-300" title={`Charity Navigator Score: ${displayScore}/100`}>
             ({displayScore}/100)
          </span>
      )}

      {/* Link to CN Profile */}
      {rating.charityNavigatorUrl && (
        <a
          href={rating.charityNavigatorUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          title="View on Charity Navigator"
        >
          CN Rating ↗
        </a>
      )}
    </div>
  );
}