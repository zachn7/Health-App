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
