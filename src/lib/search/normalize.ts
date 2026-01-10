/**
 * Search text normalization utilities
 * Provides consistent text normalization across the app
n */

/**
 * Normalize search term by:
 * - Converting to lowercase
 * - Trimming whitespace
 * - Collapsing multiple spaces
 * - Removing punctuation
 * - Removing diacritics (accents)
 */
export function normalizeSearchTerm(term: string): string {
  if (!term) return '';
  
  // Convert to lowercase
  let normalized = term.toLowerCase();
  
  // Trim whitespace
  normalized = normalized.trim();
  
  // Collapse multiple spaces into single space
  normalized = normalized.replace(/\s+/g, ' ');
  
  // Remove diacritics (accents, etc.)
  normalized = removeDiacritics(normalized);
  
  // Remove punctuation (keep alphanumeric, spaces, and some special chars that appear in food names)
  // Keep: letters, numbers, spaces, hyphens, parens, brackets, commas for compound names like "(cooked)"
  normalized = normalized.replace(/[^a-z0-9\s\-\(\)\[\]/,]/g, '');
  
  return normalized;
}

/**
 * Remove diacritics from text
 * Example: "café" -> "cafe", "naïve" -> "naive"
 */
function removeDiacritics(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Check if normalized terms match (case-insensitive, diacritic-insensitive)
 */
export function termsMatch(term1: string, term2: string): boolean {
  return normalizeSearchTerm(term1) === normalizeSearchTerm(term2);
}

/**
 * Check if search term is contained within target text (partial match)
 */
export function containsTerm(searchTerm: string, target: string): boolean {
  const normalizedSearch = normalizeSearchTerm(searchTerm);
  const normalizedTarget = normalizeSearchTerm(target);
  
  if (!normalizedSearch) return true; // Empty search matches everything
  
  return normalizedTarget.includes(normalizedSearch);
}