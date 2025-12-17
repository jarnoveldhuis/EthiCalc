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
  { id: 'laborEthics', name: 'Labor', emoji: '⚖️', defaultLevel: 3 },
  { id: 'digitalRights', name: 'Digital Rights', emoji: '🛜', defaultLevel: 3 },
];

// Migration map for old category names to new category names
// This ensures backward compatibility when category names change
export const CATEGORY_NAME_MIGRATIONS: Record<string, string> = {
  'Labor Ethics': 'Labor', // Old name -> New name
  // Add more migrations here as category names change
};

/**
 * Normalizes a category name by checking if it needs to be migrated to a new name.
 * This ensures backward compatibility with transactions that have old category names.
 */
export function normalizeCategoryName(categoryName: string | undefined): string | undefined {
  if (!categoryName) return categoryName;
  return CATEGORY_NAME_MIGRATIONS[categoryName] || categoryName;
}

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