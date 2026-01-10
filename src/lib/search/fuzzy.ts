/**
 * Fuzzy search utilities using Fuse.js
 * Provides consistent fuzzy search scoring across the app
 */
import Fuse from 'fuse.js';
import { normalizeSearchTerm } from './normalize';

/**
 * Configuration for fuzzy search - tuned for food/exercise names
 * Threshold: 0.3 means 30% of characters must match (very permissive)
 * Keys: Search in name (weighted 2x) and description (weighted 1x)
 */
export const FUSE_CONFIG = {
  threshold: 0.3, // Permissive for typos and partial matches
  minMatchCharLength: 2, // Minimum characters to start matching
  ignoreLocation: true, // Don't penalize for match position
  includeScore: true,
  keys: [
    { name: 'name', weight: 2 }, // Name matches are 2x more important
    { name: 'description', weight: 1 },
    { name: 'dataType', weight: 0.5 }, // Slight boost for matching food data type
  ],
};

/**
 * USDA-specific fuzzy search configuration
 * Food names can be long (e.g., "CHEESE,CHEDDAR,SHREDDED") so we need
 * good partial matching and handling of comma-separated names
 */
export const USDA_FUSE_CONFIG = {
  threshold: 0.4, // Slightly more permissive for food names
  minMatchCharLength: 2,
  ignoreLocation: true,
  includeScore: true,
  keys: [
    { name: 'description', weight: 3.0 }, // Food name is most important
    { name: 'brandOwner', weight: 1.5 }, // Brand helps distinguish products
    { name: 'foodCategory', weight: 1.0 }, // Category is secondary
    { name: 'additionalDescriptions', weight: 0.5 }, // Extra descriptions as fallback
  ],
};

/**
 * Exercise-specific fuzzy search configuration
 * Exercises have name, bodyPart, equipment, and muscle groups
 */
export const EXERCISE_FUSE_CONFIG = {
  threshold: 0.35, // Moderate tolerance for typos
  minMatchCharLength: 2,
  ignoreLocation: true,
  includeScore: true,
  keys: [
    { name: 'name', weight: 3.0 }, // Exercise name is most important
    { name: 'bodyPart', weight: 2.0 }, // Body part matches are important
    { name: 'targetMuscles', weight: 1.5 }, // Target muscles help with relevance
    { name: 'equipment', weight: 1.0 }, // Equipment is secondary
  ],
};

/**
 * Standard Fuse search result interface
 */
export interface FuzzySearchResult<T> {
  item: T;
  refIndex: number;
  score?: number;
}

/**
 * Create a Fuse instance for fuzzy searching
 */
export function createFuzzySearch<T>(list: T[], config?: Partial<typeof FUSE_CONFIG>): Fuse<T> {
  const finalConfig = { ...FUSE_CONFIG, ...config };
  return new Fuse(list, finalConfig);
}

/**
 * Perform fuzzy search on a list of items
 * @param list - The list to search through
 * @param searchTerm - The search term (will be normalized)
 * @param limit - Maximum number of results to return (default: all)
 * @returns Array of matching items with scores
 */
export function fuzzySearch<T>(
  list: T[],
  searchTerm: string,
  limit?: number
): FuzzySearchResult<T>[] {
  if (!searchTerm || searchTerm.trim() === '') {
    // Return all items if search is empty
    return list.map((item, index) => ({ item, refIndex: index }));
  }
  
  const normalizedTerm = normalizeSearchTerm(searchTerm);
  const fuse = createFuzzySearch(list);
  const results = fuse.search(normalizedTerm);
  
  return limit ? results.slice(0, limit) : results;
}

/**
 * Rerank search results using fuzzy scoring
 * Useful when you have API results that need better local matching
 */
export function rerankResults<T>(
  results: T[],
  searchTerm: string,
  limit?: number
): T[] {
  if (!searchTerm || searchTerm.trim() === '') {
    return results;
  }
  
  const rankedResults = fuzzySearch(results, searchTerm, limit);
  return rankedResults.map(r => r.item);
}

/**
 * Create a debounced search function
 * Prevents rapid API calls while typing
 */
export function debounceSearch<T>(
  searchFn: (term: string) => Promise<T>,
  delay: number = 300
): (term: string) => Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  
  return (term: string): Promise<T> => {
    return new Promise((resolve, reject) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      timeoutId = setTimeout(async () => {
        try {
          const result = await searchFn(term);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }, delay);
    });
  }
}

/**
 * Tokenize a search query into individual terms
 * - Lowercases and normalizes
 * - Removes very short tokens (< 2 chars)
 * - Removes common stop words if needed
 */
export function tokenizeSearchQuery(query: string): string[] {
  const normalized = normalizeSearchTerm(query);
  
  // Split on whitespace and filter out short tokens
  const tokens = normalized
    .split(/\s+/)
    .filter(token => token.length >= 2);
  
  return tokens;
}

/**
 * Score an item based on token matching
 * Returns a score (0-1) where higher is better
 */
export function scoreByTokenMatching<T>(
  item: T,
  tokens: string[],
  getTextFields: (item: T) => string[]
): number {
  if (tokens.length === 0) return 1; // Perfect match for empty query
  
  const fields = getTextFields(item).map(f => normalizeSearchTerm(f)).join(' ');
  
  // Count how many tokens match
  let matchedTokens = 0;
  let exactMatches = 0;
  
  for (const token of tokens) {
    if (fields.includes(token)) {
      matchedTokens++;
      exactMatches++;
    } else if (fields.includes(token)) {
      matchedTokens++;
    }
  }
  
  // Calculate score: prioritize exact token matches
  const tokenMatchRatio = matchedTokens / tokens.length;
  const exactMatchBonus = exactMatches / tokens.length * 0.2;
  
  return Math.min(1, tokenMatchRatio + exactMatchBonus);
}

/**
 * Hybrid ranking: combine Fuse.js fuzzy score with token-based scoring
 */
export function hybridRank<T>(
  fuzzyResults: FuzzySearchResult<T>[],
  tokens: string[],
  getTextFields: (item: T) => string[],
  fuzzyWeight: number = 0.6 // 60% fuzzy, 40% token matching
): T[] {
  // Calculate hybrid score for each result
  const scored = fuzzyResults.map(fuzzyResult => {
    const fuzzyScore = fuzzyResult.score !== undefined ? 1 - fuzzyResult.score : 0.5;
    const tokenScore = scoreByTokenMatching(fuzzyResult.item, tokens, getTextFields);
    
    const hybridScore = fuzzyScore * fuzzyWeight + tokenScore * (1 - fuzzyWeight);
    
    return { item: fuzzyResult.item, score: hybridScore };
  });
  
  // Sort by hybrid score (descending)
  scored.sort((a, b) => b.score - a.score);
  
  return scored.map(s => s.item);
}

// ==================== USDA-Specific Functions ====================

/**
 * Interface for USDA food search results
 */
export interface USDFoodSearchItem {
  fdcId: number;
  description: string;
  brandOwner?: string;
  foodCategory?: string;
  additionalDescriptions?: string;
  dataType: string;
}

/**
 * Search and rank USDA foods with fuzzy matching
 * Combines Fuse.js fuzzy search with token-based ranking
 */
export function searchUSDAFoods(
  foods: USDFoodSearchItem[],
  searchTerm: string,
  limit?: number
): USDFoodSearchItem[] {
  if (!searchTerm || searchTerm.trim() === '') {
    return foods;
  }
  
  // Tokenize the search term
  const tokens = tokenizeSearchQuery(searchTerm);
  
  // Get fuzzy search results
  const fuzzyResults = fuzzySearch(foods, searchTerm, limit);
  
  // Apply hybrid ranking (combine fuzzy + token matching)
  const ranked = hybridRank(
    fuzzyResults,
    tokens,
    (food) => [food.description, food.brandOwner || '', food.foodCategory || ''],
    0.6 // 60% fuzzy, 40% token matching
  );
  
  return limit ? ranked.slice(0, limit) : ranked;
}

/**
 * Rerank USDA API results with local fuzzy search
 * Useful for partial/typo queries where the API returns limited results
 */
export function rerankUSDAFoods(
  apiResults: USDFoodSearchItem[],
  searchTerm: string,
  limit?: number
): USDFoodSearchItem[] {
  return searchUSDAFoods(apiResults, searchTerm, limit);
}

// ==================== Exercise-Specific Functions ====================

/**
 * Interface for exercise search results
 */
export interface ExerciseSearchItem {
  id: string;
  name: string;
  bodyPart: string;
  equipment: string[];
  targetMuscles: string[];
}

/**
 * Search and rank exercises with fuzzy matching
 */
export function searchExercises(
  exercises: ExerciseSearchItem[],
  searchTerm: string,
  limit?: number
): ExerciseSearchItem[] {
  if (!searchTerm || searchTerm.trim() === '') {
    return exercises;
  }
  
  const tokens = tokenizeSearchQuery(searchTerm);
  const fuzzyResults = fuzzySearch(exercises, searchTerm, limit);
  
  const ranked = hybridRank(
    fuzzyResults,
    tokens,
    (exercise) => [
      exercise.name,
      exercise.bodyPart,
      ...exercise.equipment,
      ...exercise.targetMuscles
    ],
    0.6
  );
  
  return limit ? ranked.slice(0, limit) : ranked;
}
