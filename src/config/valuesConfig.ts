// src/config/valuesConfig.ts
export interface ValueCategoryDefinition {
  id: string; // e.g., 'animalWelfare'
  name: string;
  emoji: string;
  defaultLevel: number;
}

export const VALUE_CATEGORIES: ValueCategoryDefinition[] = [
  { id: 'animalWelfare', name: 'Animal Welfare', emoji: '🐮', defaultLevel: 3 },
  { id: 'communitySupport', name: 'Community Support', emoji: '🤝', defaultLevel: 3 },
  { id: 'environment', name: 'Environment', emoji: '🌱', defaultLevel: 3 },
  { id: 'laborEthics', name: 'Labor Ethics', emoji: '⚖️', defaultLevel: 3 },
  { id: 'digitalRights', name: 'Digital Rights', emoji: '🛜', defaultLevel: 3 },
];

export const NEUTRAL_LEVEL = 3;
export const MIN_LEVEL = 0; // <-- UPDATED
export const MAX_LEVEL = 5;

export const TOTAL_VALUE_POINTS = VALUE_CATEGORIES.length * NEUTRAL_LEVEL; 

export const NEGATIVE_PRACTICE_MULTIPLIERS: { [level: number]: number } = {
  0: 0.0,    // NEW: Explicitly no impact
  1: 0.1,    // UPDATED: Was 0.0, now a slight impact
  2: 0.25,   
  3: 0.50,   
  4: 0.75,
  5: 1.0,
};