import { describe, it, expect } from 'vitest';
import {
  normalizeText,
  tokenize,
  buildQueryState,
  scoreCandidate,
  rerank,
  rerankItems,
  type ScoredResult
} from '../../src/lib/search/searchPipeline';

describe('searchPipeline', () => {
  describe('normalizeText', () => {
    it('converts to lowercase', () => {
      expect(normalizeText('WHITE Rice')).toBe('white rice');
    });

    it('trims whitespace', () => {
      expect(normalizeText('  white rice  ')).toBe('white rice');
    });

    it('collapses multiple spaces', () => {
      expect(normalizeText('white    rice')).toBe('white rice');
    });

    it('removes diacritics', () => {
      expect(normalizeText('café')).toBe('cafe');
      expect(normalizeText('naïve')).toBe('naive');
    });
  });

  describe('tokenize', () => {
    it('splits query into tokens', () => {
      const tokens = tokenize('white rice');
      expect(tokens).toHaveLength(2);
      expect(tokens[0].text).toBe('white');
      expect(tokens[1].text).toBe('rice');
    });

    it('marks last token', () => {
      const tokens = tokenize('white rice cooked');
      expect(tokens[0].isLastToken).toBe(false);
      expect(tokens[1].isLastToken).toBe(false);
      expect(tokens[2].isLastToken).toBe(true);
    });

    it('removes tokens shorter than 2 chars', () => {
      const tokens = tokenize('white a rice');
      expect(tokens).toHaveLength(2); // 'a' is filtered out
      expect(tokens.map(t => t.text)).toEqual(['white', 'rice']);
    });

    it('normalizes each token', () => {
      const tokens = tokenize('WHITE Rice');
      expect(tokens[0].text).toBe('white');
      expect(tokens[1].text).toBe('rice');
    });
  });

  describe('buildQueryState', () => {
    it('builds complete query state', () => {
      const state = buildQueryState('White Rice');
      expect(state.originalQuery).toBe('White Rice');
      expect(state.normalizedQuery).toBe('white rice');
      expect(state.tokenCount).toBe(2);
      expect(state.tokens).toHaveLength(2);
    });

    it('handles empty query', () => {
      const state = buildQueryState('');
      expect(state.tokenCount).toBe(0);
      expect(state.tokens).toHaveLength(0);
    });
  });

  describe('scoreCandidate', () => {
    interface TestItem {
      name: string;
      description: string;
    }

    const getFields = (item: TestItem) => [item.name, item.description];

    it('returns perfect score for empty query', () => {
      const queryState = buildQueryState('');
      const result = scoreCandidate(
        { name: 'Anything', description: 'Test' },
        queryState,
        getFields
      );
      expect(result.score).toBe(1);
    });

    it('boosts exact phrase match', () => {
      const queryState = buildQueryState('white rice');
      const exactMatch = scoreCandidate(
        { name: 'White Rice', description: 'Cooked white rice' },
        queryState,
        getFields
      );
      const noMatch = scoreCandidate(
        { name: 'Brown Rice', description: 'Brown rice' },
        queryState,
        getFields
      );
      expect(exactMatch.score).toBeGreaterThan(noMatch.score);
      expect(exactMatch.metadata.exactPhraseMatch).toBe(true);
    });

    it('boosts all tokens matched (AND behavior)', () => {
      const queryState = buildQueryState('white rice');
      const allMatch = scoreCandidate(
        { name: 'White Rice', description: 'White rice food' },
        queryState,
        getFields
      );
      const partialMatch = scoreCandidate(
        { name: 'White Bread', description: 'White bread' },
        queryState,
        getFields
      );
      expect(allMatch.score).toBeGreaterThan(partialMatch.score);
      expect(allMatch.metadata.hasAllTokens).toBe(true);
      expect(partialMatch.metadata.hasAllTokens).toBe(false);
    });

    it('handles last token prefix matching', () => {
      const queryState = buildQueryState('white ric');
      const prefixMatch = scoreCandidate(
        { name: 'White Rice', description: 'White rice' },
        queryState,
        getFields
      );
      const noPrefixMatch = scoreCandidate(
        { name: 'White Bread', description: 'White bread' },
        queryState,
        getFields
      );
      expect(prefixMatch.score).toBeGreaterThan(noPrefixMatch.score);
      expect(prefixMatch.metadata.prefixMatches).toBeGreaterThan(0);
    });

    it('penalizes only first token matched', () => {
      const queryState = buildQueryState('white rice');
      const onlyFirst = scoreCandidate(
        { name: 'White Bread', description: 'White bread' }, // has 'white' but not 'rice'
        queryState,
        getFields
      );
      expect(onlyFirst.metadata.onlyFirstTokenMatched).toBe(true);
      expect(onlyFirst.score).toBeLessThanOrEqual(0.8); // Should have penalty
    });

    it('tracks token coverage', () => {
      const queryState = buildQueryState('white rice cooked');
      const twoMatches = scoreCandidate(
        { name: 'White Rice', description: 'White rice food' }, // has 'white' and 'rice', not 'cooked'
        queryState,
        getFields
      );
      expect(twoMatches.metadata.tokenCoverage).toBe(2/3);
    });
  });

  describe('rerank', () => {
    interface TestItem {
      name: string;
      description: string;
    }

    const sampleItems: TestItem[] = [
      { name: 'White Rice', description: 'White rice, cooked' },
      { name: 'Brown Rice', description: 'Brown rice, cooked' },
      { name: 'White Bread', description: 'White bread, enriched' },
      { name: 'Rice Porridge', description: 'Rice porridge' },
      { name: 'White Wheat', description: 'White wheat flour' }
    ];

    it('returns items sorted by score descending', () => {
      const results = rerank(
        sampleItems,
        (item) => [item.name, item.description],
        'white rice'
      );

      // Scores should be sorted descending
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].score).toBeGreaterThanOrEqual(results[i + 1].score);
      }
    });

    it('returns match metadata with each result', () => {
      const results = rerank(
        sampleItems,
        (item) => [item.name, item.description],
        'white rice'
      );

      results.forEach(result => {
        expect(result).toHaveProperty('item');
        expect(result).toHaveProperty('score');
        expect(result).toHaveProperty('metadata');
        expect(result.metadata).toHaveProperty('exactPhraseMatch');
        expect(result.metadata).toHaveProperty('tokenCoverage');
        expect(result.metadata).toHaveProperty('hasAllTokens');
      });
    });

    it('ranks exact matches higher than partial', () => {
      const results = rerank(
        sampleItems,
        (item) => [item.name, item.description],
        'white rice'
      );

      const topResult = results[0];
      expect(topResult.item.name).toBe('White Rice');
      expect(topResult.metadata.hasAllTokens).toBe(true);
    });

    it('handles partial typing (white ric)', () => {
      const results = rerank(
        sampleItems,
        (item) => [item.name, item.description],
        'white ric'
      );

      // Top result should include 'white' and word starting with 'ric'
      const topResult = results[0];
      expect(topResult.item.name).toBe('White Rice');
      expect(topResult.metadata.prefixMatches).toBeGreaterThan(0);
    });

    it('maintains stable sort for equal scores', () => {
      const itemsWithEqualScore = [
        { name: 'Item 1', description: 'Test' },
        { name: 'Item 2', description: 'Test' },
        { name: 'Item 3', description: 'Test' }
      ];

      const results = rerank(
        itemsWithEqualScore,
        (item) => [item.name, item.description],
        'nonexistent query' // won't match anything
      );

      // Should preserve original order for equal scores
      expect(results[0].item.name).toBe('Item 1');
      expect(results[1].item.name).toBe('Item 2');
      expect(results[2].item.name).toBe('Item 3');
    });
  });

  describe('rerankItems', () => {
    interface TestItem {
      name: string;
    }

    it('returns only items without metadata', () => {
      const items: TestItem[] = [
        { name: 'White Rice' },
        { name: 'Brown Rice' }
      ];

      const results = rerankItems(
        items,
        (item) => [item.name],
        'white rice'
      );

      // Should be array of items, not ScoredResult
      expect(results).toHaveLength(2);
      expect(results[0]).toHaveProperty('name');
      expect(results[0]).not.toHaveProperty('score');
      expect(results[0]).not.toHaveProperty('metadata');
    });

    it('returns sorted items', () => {
      const items: TestItem[] = [
        { name: 'Brown Rice' },
        { name: 'White Rice' }
      ];

      const results = rerankItems(
        items,
        (item) => [item.name],
        'white rice'
      );

      // White Rice should come first (better match)
      expect(results[0].name).toBe('White Rice');
      expect(results[1].name).toBe('Brown Rice');
    });
  });
});
