/**
 * Shared Search Pipeline - Pure Functions
 * 
 * A reusable search utility supporting:
 * - Multi-token AND-ish behavior
 * - Last-token partial typing (prefix matching)
 * - Phrase/substring boost
 * - Typo tolerance
 * 
 * This pipeline is used by USDA search and workouts search.
 */

import { normalizeSearchTerm } from './normalize';

/**
 * Token info including position and prefix detection
 */
export interface Token {
  text: string;
  isLastToken: boolean;
}

/**
 * Query state with normalized tokens
 */
export interface QueryState {
  originalQuery: string;
  normalizedQuery: string;
  tokens: Token[];
  tokenCount: number;
}

/**
 * Match metadata for debugging/scoring analysis
 */
export interface MatchMetadata {
  exactPhraseMatch: boolean;
  tokenCoverage: number; // 0-1, ratio of tokens matched
  prefixMatches: number; // count of word-prefix matches
  substringMatches: number; // count of substring matches (not prefix)
  hasAllTokens: boolean;
  onlyFirstTokenMatched: boolean;
}

/**
 * Scored result with original item and match details
 */
export interface ScoredResult<T> {
  item: T;
  score: number; // 0-1, higher is better
  metadata: MatchMetadata;
}

/**
 * Normalize text using shared normalization
 * Reuses normalizeSearchTerm from normalize.ts
 */
export function normalizeText(text: string): string {
  return normalizeSearchTerm(text);
}

/**
 * Tokenize query into tokens
 * - Normalizes each token
 * - Removes short tokens (< 2 chars)
 * - Marks last token for special handling
 */
export function tokenize(query: string): Token[] {
  const normalized = normalizeText(query);
  const rawTokens = normalized.split(/\s+/).filter(t => t.length >= 2);
  
  return rawTokens.map((text, index) => ({
    text,
    isLastToken: index === rawTokens.length - 1
  }));
}

/**
 * Build query state from raw search input
 */
export function buildQueryState(query: string): QueryState {
  const tokens = tokenize(query);
  
  return {
    originalQuery: query,
    normalizedQuery: normalizeText(query),
    tokens,
    tokenCount: tokens.length
  };
}

/**
 * Check if a token matches as a word prefix in text
 * Matches if any word in text starts with the token
 */
function hasWordPrefixMatch(text: string, token: string): boolean {
  const words = text.split(/\s+/);
  return words.some(word => word.startsWith(token));
}

/**
 * Check if token appears as substring (not necessarily prefix)
 * For tokens >= 4 chars, substring match is acceptable
 */
function hasSubstringMatch(text: string, token: string): boolean {
  return text.includes(token);
}

/**
 * Score a single candidate against query state
 * 
 * Scoring rules:
 * +0.5 - Exact phrase match (entire query appears as substring)
 * +0.3 - All tokens matched (AND-ish behavior)
 * +0.2 - Token covered by word-prefix match (each)
 * +0.1 - Token covered by substring match (each, >= 4 chars)
 * -0.2 - Only first token matched (penalty for poor relevance)
 */
export function scoreCandidate<T>(
  item: T,
  queryState: QueryState,
  getTextFields: (item: T) => string[]
): { score: number; metadata: MatchMetadata } {
  // Combine all text fields for matching
  const combinedText = getTextFields(item)
    .map(normalizeText)
    .join(' ');
  
  const { tokens, normalizedQuery, tokenCount } = queryState;
  
  // Initialize metadata
  const metadata: MatchMetadata = {
    exactPhraseMatch: false,
    tokenCoverage: 0,
    prefixMatches: 0,
    substringMatches: 0,
    hasAllTokens: false,
    onlyFirstTokenMatched: false
  };
  
  // Empty query: perfect score
  if (tokenCount === 0) {
    return { score: 1, metadata: { ...metadata, hasAllTokens: true } };
  }
  
  // Base score
  let score = 0;
  
  // Check for exact phrase match
  if (combinedText.includes(normalizedQuery)) {
    metadata.exactPhraseMatch = true;
    score += 0.5;
  }
  
  // Token matching
  let matchedTokens = 0;
  const firstTokenMatched = hasWordPrefixMatch(combinedText, tokens[0].text) ||
                         (tokens[0].text.length >= 4 && hasSubstringMatch(combinedText, tokens[0].text));
  
  for (const token of tokens) {
    // Last token: prefer prefix match, accept substring if >= 4 chars
    if (token.isLastToken) {
      if (hasWordPrefixMatch(combinedText, token.text)) {
        matchedTokens++;
        metadata.prefixMatches++;
        score += 0.2;
      } else if (token.text.length >= 4 && hasSubstringMatch(combinedText, token.text)) {
        matchedTokens++;
        metadata.substringMatches++;
        score += 0.1;
      }
    } else {
      // Non-last tokens: must appear as substring or prefix
      if (hasWordPrefixMatch(combinedText, token.text) || hasSubstringMatch(combinedText, token.text)) {
        matchedTokens++;
        score += 0.15;
      }
    }
  }
  
  // Update metadata
  metadata.tokenCoverage = matchedTokens / tokenCount;
  metadata.hasAllTokens = matchedTokens === tokenCount;
  
  // Bonus for all tokens matched (AND-ish behavior)
  if (metadata.hasAllTokens) {
    score += 0.3;
  }
  
  // Penalty for only first token matched (low relevance signal)
  if (firstTokenMatched && matchedTokens === 1) {
    metadata.onlyFirstTokenMatched = true;
    score -= 0.2;
  }
  
  // Clamp score to [0, 1]
  score = Math.max(0, Math.min(1, score));
  
  return { score, metadata };
}

/**
 * Rerank items by relevance to query
 * 
 * Returns stable sorted list with match metadata
 * - All-items: stable sort by score descending
 * - Partial query: last token gets prefix-only treatment
 */
export function rerank<T>(
  items: T[],
  getHaystackFields: (item: T) => string[],
  query: string
): ScoredResult<T>[] {
  // Build query state
  const queryState = buildQueryState(query);
  
  // Score all items
  const scored = items.map(item => {
    const { score, metadata } = scoreCandidate(item, queryState, getHaystackFields);
    return { item, score, metadata };
  });
  
  // Stable sort by score descending
  scored.sort((a, b) => {
    // Primary: score descending
    const scoreDiff = b.score - a.score;
    if (Math.abs(scoreDiff) > 0.001) {
      return scoreDiff;
    }
    
    // Secondary: exact phrase match first
    if (a.metadata.exactPhraseMatch !== b.metadata.exactPhraseMatch) {
      return a.metadata.exactPhraseMatch ? -1 : 1;
    }
    
    // Tertiary: all tokens matched first
    if (a.metadata.hasAllTokens !== b.metadata.hasAllTokens) {
      return a.metadata.hasAllTokens ? -1 : 1;
    }
    
    // Preserve original order (stable)
    return 0;
  });
  
  return scored;
}

/**
 * Convenience function to get just the reranked items (no metadata)
 */
export function rerankItems<T>(
  items: T[],
  getHaystackFields: (item: T) => string[],
  query: string
): T[] {
  const scored = rerank(items, getHaystackFields, query);
  return scored.map(s => s.item);
}
