// src/config/valuesConfig.ts
export interface ValueCategoryDefinition {
  id: string; // e.g., 'animalWelfare'
  name: string;
  emoji: string;
  defaultLevel: number;
}

// Defines the categories AND their processing order for tie-breaking in auto-transfer
export const VALUE_CATEGORIES: ValueCategoryDefinition[] = [
  { id: 'animalWelfare', name: 'Animal Welfare', emoji: '🐮', defaultLevel: 3 },
  { id: 'communitySupport', name: 'Community Support', emoji: '🤝', defaultLevel: 3 },
  { id: 'environment', name: 'Environment', emoji: '🌱', defaultLevel: 3 },
  { id: 'laborEthics', name: 'Labor Ethics', emoji: '⚖️', defaultLevel: 3 },
  { id: 'digitalRights', name: 'Digital Rights', emoji: '🛜', defaultLevel: 3 },
];

export const NEUTRAL_LEVEL = 3;
export const MIN_LEVEL = 1;
export const MAX_LEVEL = 5;

// The fixed total points (sum of levels) must always equal this
export const TOTAL_VALUE_POINTS = VALUE_CATEGORIES.length * NEUTRAL_LEVEL; 

// Multipliers for NEGATIVE practices. Positive practices always use 1.0x.
export const NEGATIVE_PRACTICE_MULTIPLIERS: { [level: number]: number } = {
  1: 0.5,
  2: 0.75,
  3: 1.0,
  4: 1.25,
  5: 1.5,
};