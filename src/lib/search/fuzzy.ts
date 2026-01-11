/**
 * Fuzzy search utilities using Fuse.js and MiniSearch
 * Provides consistent fuzzy search scoring across the app
 * Hybrid approach: MiniSearch for prefix matches, Fuse.js for fuzzy/typo tolerance
 */
import Fuse from 'fuse.js';
import MiniSearch from 'minisearch';
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
 * Aligned with USDFoodSearchResult from usda-service
 */
export interface USDFoodSearchItem {
  fdcId: number;
  description: string;
  brandOwner?: string;
  foodCategory?: string;
  additionalDescriptions?: string;
  dataType: string;
  publishedDate: string; // Required in USDFoodSearchResult
}

// Type for items that can be cached with relaxation info
export type CachedSearchResult<T> = {
  results: T[]; 
  queryUsed: string;
  wasRelaxed: boolean;
};

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
 * Generate relaxed/fallback queries for better typeahead matching
 * Progressively shortens the last token or takes a root token
 * 
 * Examples:
 *   'cheeseca' -> ['cheesec', 'cheese']
 *   'chick' -> ['chic', 'chi']
 *   'greek yogurt' -> ['gree', 'gre']
 * 
 * @param query - Original search query
 * @param maxAttempts - Maximum number of fallback queries to generate (default: 3)
 * @returns Array of fallback queries (ordered from closest to furthest from original)
 */
export function generateRelaxedQueries(query: string, maxAttempts: number = 3): string[] {
  const trimmed = query.trim();
  const fallbacks: string[] = [];
  
  if (trimmed.length < 4) {
    // Too short to generate meaningful fallbacks
    return fallbacks;
  }
  
  // Split into tokens
  const tokens = trimmed.split(/\s+/);
  const lastToken = tokens[tokens.length - 1];
  
  // Strategy 1: Progressively shorten the last token
  let shortened = lastToken;
  for (let i = 0; i < Math.min(maxAttempts - 1, lastToken.length - 2); i++) {
    shortened = shortened.slice(0, -1); // Remove last char
    const newQuery = tokens.slice(0, -1).concat(shortened).join(' ');
    if (newQuery !== trimmed) {
      fallbacks.push(newQuery);
    }
  }
  
  // Strategy 2: If still empty, try root word of last token (e.g., 'cheesecake' -> 'cheese')
  if (fallbacks.length < maxAttempts) {
    // Check for common suffixes to strip
    const suffixesToRemove = ['cake', 'berry', 'fruit', 'bread', 'roll', 'pie', 'bar'];
    for (const suffix of suffixesToRemove) {
      if (lastToken.toLowerCase().endsWith(suffix) && lastToken.length > suffix.length + 2) {
        const rootWithoutSuffix = lastToken.slice(0, -suffix.length);
        const rootQuery = tokens.slice(0, -1).concat(rootWithoutSuffix).join(' ');
        if (rootQuery !== trimmed && !fallbacks.includes(rootQuery)) {
          fallbacks.push(rootQuery);
          break;
        }
      }
    }
  }
  
  // Strategy 3: If still empty and multiple tokens, drop the last token
  if (fallbacks.length === 0 && tokens.length > 1) {
    const withoutLast = tokens.slice(0, -1).join(' ');
    fallbacks.push(withoutLast);
  }
  
  // Remove duplicates and return limited results
  return Array.from(new Set(fallbacks)).slice(0, maxAttempts);
}

/**
 * Simple in-memory cache for search results
 * Helps avoid refetching when backspacing or retyping
 */
export class SearchCache<T> {
  private cache: Map<string, { results: T; timestamp: number }> = new Map();
  private maxAge: number; // Cache entries expire after this many ms
  
  constructor(maxAge: number = 5000) {
    this.maxAge = maxAge;
  }
  
  /**
   * Get cached results if available and fresh
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    const age = Date.now() - entry.timestamp;
    if (age > this.maxAge) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.results;
  }
  
  /**
   * Store results in cache
   */
  set(key: string, results: T): void {
    this.cache.set(key, { results, timestamp: Date.now() });
  }
  
  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }
  
  /**
   * Remove expired entries
   */
  prune(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.maxAge) {
        this.cache.delete(key);
      }
    }
  }
}

/**
 * Global USDA search result cache instance
 */
const globalUSDACache = new SearchCache<any>(5000); // 5 second cache

/**
 * Perform USDA search with query relaxation
 * 
 * @param searchFn - Function to call USDA API
 * @param originalQuery - User's exact input
 * @param options - Configuration options
 * @returns Search results with metadata about which query was used
 */
export async function searchWithRelaxation<T>(
  searchFn: (query: string) => Promise<{ results: T[] }>,
  originalQuery: string,
  options: {
    maxAttempts?: number;
    minQueryLength?: number;
    cache?: SearchCache<any>;
  } = {}
): Promise<{ 
  results: T[];
  queryUsed: string;
  wasRelaxed: boolean;
}> {
  const { 
    maxAttempts = 3, 
    minQueryLength = 4,
    cache = globalUSDACache
  } = options;
  
  const trimmedQuery = originalQuery.trim();
  
  // Check cache first
  const cached = cache?.get(trimmedQuery);
  if (cached) {
    console.log('[Search] Cache hit for:', trimmedQuery, 'used query:', cached.queryUsed);
    return cached;
  }
  
  // Try exact query first
  try {
    const exactResult = await searchFn(trimmedQuery);
    
    if (exactResult.results.length > 0) {
      const result = {
        results: exactResult.results,
        queryUsed: trimmedQuery,
        wasRelaxed: false
      };
      cache?.set(trimmedQuery, result);
      return result;
    }
    
    // No results from exact query, try relaxation if query is long enough
    if (trimmedQuery.length >= minQueryLength) {
      const fallbacks = generateRelaxedQueries(trimmedQuery, maxAttempts);
      
      console.log('[Search] Exact query returned 0 results. Trying fallbacks:', fallbacks);
      
      for (const fallbackQuery of fallbacks) {
        try {
          const fallbackResult = await searchFn(fallbackQuery);
          
          if (fallbackResult.results.length > 0) {
            const result = {
              results: fallbackResult.results,
              queryUsed: fallbackQuery,
              wasRelaxed: true
            };
            cache?.set(trimmedQuery, result);
            console.log('[Search] Found results using relaxed query:', fallbackQuery);
            return result;
          }
        } catch (error) {
          console.warn('[Search] Failed to search with fallback query:', fallbackQuery, error);
          // Continue to next fallback
        }
      }
    }
    
    // Nothing found
    const result = {
      results: [],
      queryUsed: trimmedQuery,
      wasRelaxed: false
    };
    cache?.set(trimmedQuery, result);
    return result;
    
  } catch (error) {
    console.error('[Search] Search failed:', error);
    throw error;
  }
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

// ==================== Hybrid MiniSearch + Fuse.js Functions ====================

/**
 * MiniSearch options optimized for food name prefixes
 * Combines prefix-based field matching with fuzzy search
 */
const MINISEARCH_OPTIONS = {
  fields: ['description', 'brandOwner', 'foodCategory'],
  idField: 'fdcId',
  storeFields: ['description', 'brandOwner', 'foodCategory', 'dataType', 'publishedDate'],
  searchOptions: {
    boost: { description: 3, brandOwner: 2, foodCategory: 1 }, // Weight food name highest
    fuzzy: (term: string) => term.length > 3 ? 0.2 : false, // Light fuzzy for longer terms
    prefix: true, // Enable prefix matching
    combineWith: 'AND', // Require all tokens to match
  },
} as const;

/**
 * MiniSearch index for USDA foods
 * Reusable across search calls for performance
 */
let usdaMiniSearchIndex: MiniSearch<USDFoodSearchItem> | null = null;

/**
 * Create or get the shared MiniSearch index
 */
function getUSDAMiniSearchIndex(results: USDFoodSearchItem[]): MiniSearch<USDFoodSearchItem> {
  if (!usdaMiniSearchIndex || usdaMiniSearchIndex.documentCount === 0) {
    usdaMiniSearchIndex = new MiniSearch(MINISEARCH_OPTIONS as any);
  }
  
  // Add documents to index if not already present
  for (const doc of results) {
    if (!usdaMiniSearchIndex.has(doc.fdcId.toString())) {
      usdaMiniSearchIndex.add(doc);
    }
  }
  
  return usdaMiniSearchIndex;
}

/**
 * Check if an item has a strong prefix match with the query
 * Returns true if:
 * - Item description starts with the query, OR
 * - Item description contains the query as a substring (for longer queries)
 */
function hasStrongPrefixMatch(item: USDFoodSearchItem, query: string): boolean {
  const normalizedDescription = item.description.toLowerCase().trim();
  const normalizedQuery = query.toLowerCase().trim();
  
  // Exact prefix match (most valuable)
  if (normalizedDescription.startsWith(normalizedQuery)) {
    return true;
  }
  
  // Substring match for queries >= 5 characters (still strong signal)
  if (query.length >= 5 && normalizedDescription.includes(normalizedQuery)) {
    return true;
  }
  
  return false;
}

/**
 * Hybrid ranking using MiniSearch (prefix-heavy) + Fuse.js (fuzzy/typo tolerant)
 * Scores are weighted: 70% MiniSearch (prefix) + 30% Fuse.js (fuzzy)
 * This ensures exact/prefix matches rank higher than fuzzy noise
 * 
 * For queries >= 5 chars with strong prefix matches, only those matches are shown
 */
export function hybridRankUSDAFoods(
  apiResults: USDFoodSearchItem[],
  searchTerm: string,
  limit?: number
): USDFoodSearchItem[] {
  if (!searchTerm || searchTerm.trim() === '') {
    return apiResults;
  }
  
  try {
    const normalizedQuery = searchTerm.toLowerCase().trim();
    
    // Phase A: Strong prefix detection for queries >= 5 characters
    // This ensures 'cheeseca' strongly prefers 'cheesecake' over generic 'cheese'
    let candidates = apiResults;
    
    if (normalizedQuery.length >= 5) {
      const strongPrefixMatches = apiResults.filter(
        item => hasStrongPrefixMatch(item, normalizedQuery)
      );
      
      if (strongPrefixMatches.length > 0) {
        console.log(
          `[HybridRank] Strong prefix matches found: ${strongPrefixMatches.length}/${apiResults.length} for query "${searchTerm}"`
        );
        // Only rank prefix-matching items - this narrows results significantly
        candidates = strongPrefixMatches;
      }
    }
    
    // Step 1: MiniSearch prefix-based scoring (high precision)
    const miniSearch = getUSDAMiniSearchIndex(apiResults); // Always index all results
    const miniResults = miniSearch.search(searchTerm);
    
    // Create a score map from MiniSearch results
    const miniScoreMap = new Map<string, number>();
    for (const result of miniResults) {
      const id = result.id.toString(); // MiniSearch uses the idField
      miniScoreMap.set(id, result.score);
    }
    
    // Step 2: Fuse.js fuzzy scoring (tolerant to typos)
    const fuse = new Fuse(apiResults, USDA_FUSE_CONFIG);
    const fuseResults = fuse.search(searchTerm);
    
    // Create a score map from Fuse.js results
    const fuseScoreMap = new Map<string, number>();
    for (const result of fuseResults) {
      const id = result.item.fdcId.toString();
      const fuseScore = 1 - (result.score || 0); // Invert: lower score = better match
      fuseScoreMap.set(id, fuseScore);
    }
    
    // Step 3: Combine scores (70% MiniSearch, 30% Fuse.js) - only score candidates
    const scoredItems = candidates.map(item => {
      const id = item.fdcId.toString();
      const miniScore = miniScoreMap.get(id) || 0; // 0 means didn't match in MiniSearch
      const fuseScore = fuseScoreMap.get(id) || 0; // 0 means didn't match in Fuse.js
      
      // Bonus score for candidates that passed strong prefix filter (even if not in MiniSearch)
      const prefixBonus = hasStrongPrefixMatch(item, normalizedQuery) ? 0.2 : 0;
      
      // Hybrid score: prioritize prefix matches (MiniSearch) but consider fuzzy (Fuse.js)
      const hybridScore = miniScore * 0.7 + fuseScore * 0.3 + prefixBonus;
      
      return { item, score: hybridScore };
    });
    
    // Step 4: Sort by hybrid score (descending)
    scoredItems.sort((a, b) => b.score - a.score);
    
    const results = scoredItems.map(s => s.item);
    return limit ? results.slice(0, limit) : results;
  } catch (error) {
    console.error('[HybridRank] Error hybrid ranking, falling back to original results:', error);
    return apiResults;
  }
}

/**
 * Rerank USDA API results with hybrid MiniSearch + Fuse.js
 * Uses the hybrid ranking that prioritizes prefix matches over fuzzy noise
 */
export function rerankUSDAFoodsHybrid(
  apiResults: USDFoodSearchItem[],
  searchTerm: string,
  limit?: number
): USDFoodSearchItem[] {
  return hybridRankUSDAFoods(apiResults, searchTerm, limit);
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
