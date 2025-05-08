// src/features/values/UserValuesEditor.tsx
"use client";

import React, { useEffect, useRef } from 'react';
import { useTransactionStore } from '@/store/transactionStore';
import { useAuth } from '@/hooks/useAuth';
import {
  VALUE_CATEGORIES,
  NEUTRAL_LEVEL,
  ValueCategoryDefinition,
} from '@/config/valuesConfig';

// Square visual component - Smaller Size
const ValueSquare = ({
    levelPosition, currentLevel, onClick, disabled = false
}: { levelPosition: number; currentLevel: number; onClick: () => void; disabled?: boolean; }) => {
  let bgColor = 'bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500';
  const isFilled = levelPosition <= currentLevel;
  const isActive = levelPosition === currentLevel;

  if (isFilled) {
    if (currentLevel === 1) bgColor = 'bg-red-500 hover:bg-red-600';
    else if (currentLevel === 2) bgColor = 'bg-orange-400 hover:bg-orange-500';
    else if (currentLevel === 3) bgColor = 'bg-yellow-400 hover:bg-yellow-500';
    else if (currentLevel === 4) bgColor = 'bg-lime-500 hover:bg-lime-600';
    else if (currentLevel === 5) bgColor = 'bg-green-500 hover:bg-green-600';
  }

  // --- STYLE CHANGE: Reduced square size ---
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      // Reduced size classes (e.g., w-5 h-5 base, sm:w-6 sm:h-6 medium)
      className={`w-5 h-5 sm:w-6 sm:h-6 rounded transition-colors duration-150 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800 ${bgColor} ${isActive ? 'ring-2 ring-black dark:ring-white ring-offset-1' : ''} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      aria-label={`Set level to ${levelPosition}`}
      aria-pressed={isActive}
    />
  );
};

// ValueRow component - Reduced Padding
interface ValueRowProps {
  category: ValueCategoryDefinition;
  currentLevel: number;
  onUpdate: (categoryId: string, newLevel: number) => void;
}

const ValueRow: React.FC<ValueRowProps> = ({ category, currentLevel, onUpdate }) => {
  const handleSquareClick = (levelClicked: number) => {
    onUpdate(category.id, levelClicked);
  };

  // --- STYLE CHANGE: Removed border-b class ---
  return (
    <div className="py-1 sm:py-1"> {/* Removed border-b and last:border-b-0 */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center min-w-0 flex-1 pr-1 sm:pr-2">
          <span className="text-sm sm:text-2xl mr-2 sm:mr-3 select-none" aria-hidden="true">{category.emoji}</span>
          <span className="text-sm sm:text-base font-medium text-gray-800 dark:text-gray-200 truncate" title={category.name}>
            {category.name}
          </span>
        </div>
        {/* --- STYLE CHANGE: Adjusted spacing for smaller squares --- */}
        <div className="flex items-center space-x-1 flex-shrink-0" role="radiogroup" aria-label={`${category.name} importance level`}>
          {[1, 2, 3, 4, 5].map((levelPos) => (
            <ValueSquare
              key={levelPos}
              levelPosition={levelPos}
              currentLevel={currentLevel}
              onClick={() => handleSquareClick(levelPos)}
              // Determine disabled state (optional, could prevent clicking current level again)
              // disabled={levelPos === currentLevel} 
            />
          ))}
        </div>
      </div>
    </div>
  );
};

// Main Editor Component
export const UserValuesEditor: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const userValueSettings = useTransactionStore((state) => state.userValueSettings);
  const updateUserValue = useTransactionStore((state) => state.updateUserValue);
  const initializeUserValueSettings = useTransactionStore((state) => state.initializeUserValueSettings);
  const resetUserValuesToDefault = useTransactionStore((state) => state.resetUserValuesToDefault);
  const appStatus = useTransactionStore((state) => state.appStatus);
  const initRanForUserRef = useRef<string | null>(null);

  // Effect to initialize settings (remains the same logic)
  useEffect(() => {
     // ... initialization effect logic ...
      const currentUserId = user?.uid; if (currentUserId && !authLoading && initRanForUserRef.current !== currentUserId) { const settingsAreIncompleteOrPotentiallyDefault = VALUE_CATEGORIES.some( cat => userValueSettings[cat.id] === undefined || userValueSettings[cat.id] === NEUTRAL_LEVEL ); const settingsKeyCount = Object.keys(userValueSettings).length; if (settingsAreIncompleteOrPotentiallyDefault || settingsKeyCount < VALUE_CATEGORIES.length) { console.log(`UserValuesEditor Effect: Triggering initializeUserValueSettings for user ${currentUserId}.`); initializeUserValueSettings(currentUserId); initRanForUserRef.current = currentUserId; } else { console.log(`UserValuesEditor Effect: Settings seem populated for user ${currentUserId}. Marking init as done.`); initRanForUserRef.current = currentUserId; } } else if (!currentUserId && !authLoading) { console.log("UserValuesEditor Effect: User logged out, resetting init ref."); initRanForUserRef.current = null; }
  }, [user, authLoading, initializeUserValueSettings, userValueSettings]);

  const handleUpdate = (categoryId: string, newLevel: number) => {
    // ... (handleUpdate logic remains the same) ...
     if (user) { updateUserValue(user.uid, categoryId, newLevel); } else { console.error("User not authenticated, cannot update values."); }
  };

  const handleReset = () => {
     // ... (handleReset logic remains the same) ...
      if (user && window.confirm("This will reset all your value weightings to neutral (Level 3).\nAre you sure?")) { resetUserValuesToDefault(user.uid); }
  };

  const isLoading = authLoading || appStatus === 'loading_settings' || (appStatus === 'initializing' && initRanForUserRef.current !== user?.uid);

  if (isLoading) { /* ... Loading UI ... */ 
      return ( <div className="card rounded-lg shadow-md animate-pulse"><div className="p-6 text-center"><p>Loading value settings...</p><div className="space-y-3 mt-4"><div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mx-auto"></div><div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-full mx-auto"></div><div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-full mx-auto"></div></div></div></div> ); 
  }
  if (!user) { /* ... No User UI ... */ 
      return ( <div className="card rounded-lg shadow-md"><div className="p-6 text-center"><p>Please sign in to set your values.</p></div></div> ); 
  }
  const settingsReady = VALUE_CATEGORIES.every(cat => userValueSettings[cat.id] !== undefined);
   if (!settingsReady && !isLoading) { /* ... Error UI ... */ 
       return ( <div className="card rounded-lg shadow-md"><div className="p-6 text-center"><p className="text-red-600 dark:text-red-400 font-semibold">Error loading value settings.</p><p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Please try refreshing the page.</p></div></div> ); 
   }

  // Main Render Output
  return (
    <div className="card rounded-lg shadow-md bg-white dark:bg-gray-800">
      {/* Header Section */}
      <div className="p-4 sm:p-5 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center flex-wrap gap-2">
         {/* ... Header content remains the same ... */}
         <div> <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">Weight Your Values</h2> <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1"> Click a square to set the importance level (1-5). </p> </div>
          <button onClick={handleReset} className="text-xs px-3 py-1 border border-blue-500 text-blue-600 dark:text-blue-400 dark:border-blue-400 rounded hover:bg-blue-50 dark:hover:bg-blue-900/[0.3] whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" title="Reset all values to neutral (Level 3)"> Reset to Neutral </button>
      </div>
      {/* --- STYLE CHANGE: Removed divide-y class --- */}
      <div className="px-2 sm:px-3 md:px-4"> {/* Removed divide-y */}
        {VALUE_CATEGORIES.map((category) => {
          const currentLevel = userValueSettings[category.id] ?? category.defaultLevel;
          return (
            <ValueRow
              key={category.id}
              category={category}
              currentLevel={currentLevel}
              onUpdate={handleUpdate}
              // Enablement props not needed for ValueRow anymore
            />
          );
        })}
      </div>
      {/* Footer Explanation Section */}
       <div className="p-4 sm:p-5 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/[.35] rounded-b-lg border-t border-gray-200 dark:border-gray-700">
          {/* ... Footer text remains the same ... */}
          <p className="font-semibold mb-1 text-gray-700 dark:text-gray-200">How This Affects Your Score:</p><ul className="list-disc list-inside space-y-1"><li><strong className="text-green-600 dark:text-green-400">Higher levels (4-5):</strong> Make negative impacts count <strong className="font-medium">more</strong>.</li><li><strong className="text-yellow-600 dark:text-yellow-400">Level 3:</strong> Neutral impact (1x).</li><li><strong className="text-orange-600 dark:text-orange-400">Lower levels (1-2):</strong> Make negative impacts count <strong className="font-medium">less</strong>.</li><li>Positive impacts always count at their full value (1x).</li></ul>
       </div>
    </div>
  );
};