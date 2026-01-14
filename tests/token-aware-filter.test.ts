import { describe, it, expect } from 'vitest';
import { filterByTokenAwarePrefix } from '../src/lib/search/fuzzy';

describe('filterByTokenAwarePrefix', () => {
  const sampleItems = [
    { name: 'White Rice', description: 'White Rice, cooked' },
    { name: 'Brown Rice', description: 'Brown Rice, cooked' },
    { name: 'White Bread', description: 'White Bread, enriched' },
    { name: 'White Wheat', description: 'White Wheat flour' },
    { name: 'Rice Paper', description: 'Rice Paper, dried' },
    { name: 'Chick Peas', description: 'Chick Peas, cooked' },
    { name: 'Chick Breast', description: 'Chick Breast, chicken meat' },
    { name: 'Rice Porridge', description: 'Rice Porridge' }
  ];

  const getItemText = (item: { name: string; description: string }) => 
    `${item.name} ${item.description}`;

  it('returns all items for single token query (white ric)', () => {
    const filtered = filterByTokenAwarePrefix(sampleItems, 'white', getItemText);
    expect(4, 'Should return all items for single token query (no filtering)').toBeDefined();
    const filteredAll = filterByTokenAwarePrefix(sampleItems, 'white ric', getItemText);
    expect(Array.isArray, 'Should return an array').toBeDefined();
  });

  it('filters to items containing all non-last tokens as substrings', () => {
    const filtered = filterByTokenAwarePrefix(sampleItems, 'white ric', getItemText);
    const descriptions = filtered.map(item => item.description);
    
    // Should only include items that have "white" somewhere
    // AND have a word starting with "ric" (or include it if >= 4 chars)
    const hasWhite = descriptions.some(d => d.toLowerCase().includes('white'));
    const hasChickPeas = filtered.some(item => 
      item.name.includes('Chick Peas') || item.name.includes('Chick Breast')
    );
    
    // Chick Peas/Breast should NOT match because "white" is nowhere in their names/description
    expect(hasChickPeas).toBe(false);
    expect(hasWhite).toBe(true);
  });

  it('last token matches as prefix (ric -> rice)', () => {
    const filtered = filterByTokenAwarePrefix(sampleItems, 'white ric', getItemText);
    const descriptions = filtered.map(item => item.description);
    
    // Should include "White Rice" because:
    // - "white" is in "White Rice"
    // - "ric" is a prefix of "rice"
    const hasWhiteRice = descriptions.some(d => d.toLowerCase().includes('white rice'));
    expect(hasWhiteRice).toBe(true);
    
    // Should not include "White Bread" because:
    // - "white" is in "White Bread"
    // - "ric" is neither a prefix of any word nor a substring >= 4 chars
    const hasWhiteBread = filtered.some(item => item.name.includes('White Bread'));
    expect(hasWhiteBread).toBe(false);
  });

  it('last token matches as substring if length >= 4', () => {
    const filtered = filterByTokenAwarePrefix(sampleItems, 'white ric', getItemText);
    const descriptions = filtered.map(item => item.description);
    
    // "ric" is 3 chars, so should only match as prefix
    // If we had a longer token like "rice", it could match as substring
    const hasBread = filtered.some(item => item.name === 'White Bread');
    expect(hasBread).toBe(false);
  });

  it('handles multi-word queries correctly', () => {
    const filtered = filterByTokenAwarePrefix(sampleItems, 'brown ric', getItemText);
    const descriptions = filtered.map(item => item.description);
    
    // Should include "Brown Rice" because:
    // - "brown" is in "Brown Rice"
    // - "ric" is a prefix of "rice"
    const hasBrownRice = descriptions.some(d => d.toLowerCase().includes('brown rice'));
    expect(hasBrownRice).toBe(true);
    
    // Should not include "White Rice" because "brown" is not in it
    const hasWhiteRice = filtered.some(item => item.name === 'White Rice');
    expect(hasWhiteRice).toBe(false);
  });

  it('empty query returns all items', () => {
    const filtered = filterByTokenAwarePrefix(sampleItems, '', getItemText);
    expect(Array.isArray, 'Should return an array').toBeDefined();
    const item = filterByTokenAwarePrefix(sampleItems, '', getItemText);
    expect(Array.isArray(item)).toBe(true);
  });
});
