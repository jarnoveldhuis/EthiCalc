// src/features/values/UserValuesEditor.jsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTransactionStore } from "@/store/transactionStore";
import { useAuth } from "@/hooks/useAuth";
import {
  VALUE_CATEGORIES,
  NEUTRAL_LEVEL,
  ValueCategoryDefinition,
} from "@/config/valuesConfig";
import { Timestamp } from "firebase/firestore";
import { Reorder } from "framer-motion";

const usePrevious = <T,>(value: T): T | undefined => {
  const ref = useRef<T | undefined>(undefined);
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
};


const ValueSquare = ({
  levelPosition,
  currentLevel,
  onClick,
  disabled = false,
}: {
  levelPosition: number;
  currentLevel: number;
  onClick: () => void;
  disabled?: boolean;
}) => {
  let bgColor = "bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500";
  const isFilled = levelPosition <= currentLevel;
  const isActive = levelPosition === currentLevel;

  if (isFilled) {
    if (currentLevel === 1) bgColor = "bg-red-500 hover:bg-red-600";
    else if (currentLevel === 2) bgColor = "bg-orange-400 hover:bg-orange-500";
    else if (currentLevel === 3) bgColor = "bg-yellow-400 hover:bg-yellow-500";
    else if (currentLevel === 4) bgColor = "bg-lime-500 hover:bg-lime-600";
    else if (currentLevel === 5) bgColor = "bg-green-500 hover:bg-green-600";
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-5 h-5 sm:w-6 sm:h-6 rounded transition-colors duration-150 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800 ${bgColor} ${
        isActive ? "ring-2 ring-black dark:ring-white ring-offset-1" : ""
      } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      aria-label={`Set level to ${levelPosition}`}
      aria-pressed={isActive}
    />
  );
};

interface ValueRowProps {
  category: ValueCategoryDefinition;
  currentLevel: number;
  onUpdate: (categoryId: string, newLevel: number) => void;
  disabled: boolean;
  highlightClass: string;
}

const ValueRow: React.FC<ValueRowProps> = ({ category, currentLevel, onUpdate, disabled, highlightClass }) => {
  const handleSquareClick = (levelClicked: number) => {
    if (disabled) return;
    const newLevel = levelClicked === currentLevel ? 0 : levelClicked;
    onUpdate(category.id, newLevel);
  };
  return (
    <div className={`py-2 sm:py-2 px-2 sm:px-3 rounded-md transition-colors duration-200 ${highlightClass}`}>
      <div className="flex items-center gap-2 sm:gap-3 w-full">
        <button 
          onClick={() => onUpdate(category.id, 0)} // THIS IS THE FIX
          disabled={disabled || currentLevel === 0}
          className="text-gray-400 hover:text-red-500 disabled:text-gray-300 dark:disabled:text-gray-600 disabled:cursor-not-allowed font-mono text-lg p-1"
          title="Set value to zero"
        >
          &times;
        </button>
        <span className="text-xl sm:text-2xl" aria-hidden="true">
          {category.emoji}
        </span>
        <div className="flex items-center space-x-1" role="radiogroup" aria-label={`${category.name} importance level`}>
          {[1, 2, 3, 4, 5].map((levelPos) => (
            <ValueSquare
              key={levelPos}
              levelPosition={levelPos}
              currentLevel={currentLevel}
              onClick={() => handleSquareClick(levelPos)}
              disabled={disabled}
            />
          ))}
        </div>
        <span className="text-sm sm:text-base font-medium text-gray-800 dark:text-gray-200" title={category.name}>
          {category.name}
        </span>
      </div>
    </div>
  );
};


export const UserValuesEditor: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const userValueSettings = useTransactionStore((state) => state.userValueSettings);
  const updateUserValue = useTransactionStore((state) => state.updateUserValue);
  const updateCategoryOrder = useTransactionStore((state) => state.updateCategoryOrder);
  const initializeUserValueSettings = useTransactionStore((state) => state.initializeUserValueSettings);
  const valuesCommittedUntil = useTransactionStore((state) => state.valuesCommittedUntil);
  const appStatus = useTransactionStore((state) => state.appStatus);
  const initRanForUserRef = useRef<string | null>(null);
  
  const [highlightedCategories, setHighlightedCategories] = useState<Record<string, boolean>>({});
  const lastInteractedId = useRef<string | null>(null);
  const prevUserValueSettings = usePrevious(userValueSettings);
  const [orderedCategories, setOrderedCategories] = useState<ValueCategoryDefinition[]>([]);

  const isEditingDisabled = useMemo(() => {
    if (valuesCommittedUntil && valuesCommittedUntil instanceof Timestamp) {
      return valuesCommittedUntil.toDate() > new Date();
    }
    return false;
  }, [valuesCommittedUntil]);

  const committedUntilDateString = useMemo(() => {
    if (isEditingDisabled && valuesCommittedUntil) {
      return valuesCommittedUntil.toDate().toLocaleDateString(undefined, {
        year: 'numeric', month: 'long', day: 'numeric'
      });
    }
    return "";
  }, [isEditingDisabled, valuesCommittedUntil]);

  useEffect(() => {
    const masterOrder = userValueSettings.order || [];
    const newSorted = [...VALUE_CATEGORIES].sort((a, b) => {
      const levelA = userValueSettings.levels[a.id] ?? NEUTRAL_LEVEL;
      const levelB = userValueSettings.levels[b.id] ?? NEUTRAL_LEVEL;
      if (levelB !== levelA) return levelB - levelA;
      return masterOrder.indexOf(a.id) - masterOrder.indexOf(b.id);
    });
    setOrderedCategories(newSorted);
  }, [userValueSettings]);

  useEffect(() => {
    if (prevUserValueSettings && prevUserValueSettings.levels) {
      const changed: Record<string, boolean> = {};
      let hasChanges = false;
      for (const categoryId in userValueSettings.levels) {
        if (userValueSettings.levels[categoryId] !== prevUserValueSettings.levels[categoryId] && categoryId !== lastInteractedId.current) {
          changed[categoryId] = true;
          hasChanges = true;
        }
      }
      if (hasChanges) {
        setHighlightedCategories(changed);
        const timer = setTimeout(() => { setHighlightedCategories({}); }, 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [userValueSettings, prevUserValueSettings]);

  useEffect(() => {
    const currentUserId = user?.uid;
    if (currentUserId && !authLoading && initRanForUserRef.current !== currentUserId) {
      initializeUserValueSettings(currentUserId);
      initRanForUserRef.current = currentUserId;
    } else if (!currentUserId && !authLoading) {
      initRanForUserRef.current = null;
    }
  }, [user, authLoading, initializeUserValueSettings]);

  const handleUpdate = (categoryId: string, newLevel: number) => {
    if (isEditingDisabled || !user) return;
    lastInteractedId.current = categoryId;
    updateUserValue(user.uid, categoryId, newLevel);
  };
  
  // This handler is now robust for reordering within a group
  const handleReorder = (reorderedGroup: ValueCategoryDefinition[]) => {
    if (!user || reorderedGroup.length <= 1) return;

    const masterOrder = [...userValueSettings.order];
    const reorderedIds = reorderedGroup.map(c => c.id);
    const reorderedIdSet = new Set(reorderedIds);

    let groupIdx = 0;
    const finalMasterOrder = masterOrder.map(id => 
      reorderedIdSet.has(id) ? reorderedIds[groupIdx++] : id
    );

    updateCategoryOrder(user.uid, finalMasterOrder);
  };
  
  const isLoading = authLoading || appStatus === "loading_settings" || appStatus === "initializing";




  if (isLoading) { return <div className="p-6 text-center">Loading Values...</div>; }
  if (!user) { return <div className="p-6 text-center">Please sign in to set your values.</div>; }

  return (
    <div className="bg-white dark:bg-gray-800">
      {isEditingDisabled && committedUntilDateString && (
        <div className="p-3 sm:p-4 bg-yellow-100 dark:bg-yellow-700 border-b border-yellow-300 dark:border-yellow-600">
          <p className="text-sm text-yellow-800 dark:text-yellow-100 text-center">
            Your values are committed and locked until <strong>{committedUntilDateString}</strong>.
          </p>
        </div>
      )}
      <Reorder.Group
        axis="y"
        values={orderedCategories}
        onReorder={handleReorder}
        className="px-2"
      >
        {orderedCategories.map((category) => {
          const currentLevel = userValueSettings.levels[category.id] ?? NEUTRAL_LEVEL;
          
          return (
            <React.Fragment key={category.id}>
              {/* {showHeader && <LevelHeader level={currentLevel} />} */}
              <Reorder.Item 
                value={category} 
                className="bg-gray-50 dark:bg-gray-700/50 rounded-lg shadow-sm cursor-grab active:cursor-grabbing"
              >
                <ValueRow
                  category={category}
                  currentLevel={currentLevel}
                  onUpdate={handleUpdate}
                  disabled={isEditingDisabled}
                  highlightClass={highlightedCategories[category.id] ? 'highlight-change' : ''}
                />
              </Reorder.Item>
            </React.Fragment>
          );
        })}
      </Reorder.Group>
    </div>
  );
};
