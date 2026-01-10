import { describe, it, expect } from 'vitest';
import { type FoodLogItem } from '../../src/types';
import { 
  calculateMacrosPerGram, 
  calculateTotalGrams,
  computeServingsChange,
  formatServingSize,
  roundToIntGrams,
  roundToTenthServings,
  gramsToServings
} from '../../src/lib/serving-utils';

describe('serving-utils', () => {
  describe('roundToIntGrams', () => {
    it('should round to nearest whole number', () => {
      expect(roundToIntGrams(1.4)).toBe(1);
      expect(roundToIntGrams(1.5)).toBe(2); // Rounds up at .5
      expect(roundToIntGrams(1.6)).toBe(2);
      expect(roundToIntGrams(0.1)).toBe(0);
      expect(roundToIntGrams(0.9)).toBe(1);
    });
  });

  describe('roundToTenthServings', () => {
    it('should round to nearest tenth (0.1 precision)', () => {
      expect(roundToTenthServings(1.45)).toBe(1.5);
      expect(roundToTenthServings(1.44)).toBe(1.4);
      expect(roundToTenthServings(1.55)).toBe(1.6);
      expect(roundToTenthServings(0.15)).toBe(0.2);
      expect(roundToTenthServings(2.0)).toBe(2.0);
    });
  });

  describe('gramsToServings', () => {
    it('should convert grams to servings with 0.1 precision', () => {
      expect(gramsToServings(60, 40)).toBe(1.5);  // 60g / 40g = 1.5
      expect(gramsToServings(40, 40)).toBe(1.0);
      expect(gramsToServings(80, 40)).toBe(2.0);
      expect(gramsToServings(61, 40)).toBe(1.5);  // 61/40 = 1.525 -> rounds to 1.5
      expect(gramsToServings(59, 40)).toBe(1.5);  // 59/40 = 1.475 -> rounds to 1.5
    });

    it('should guard against zero gramWeight', () => {
      expect(gramsToServings(100, 0)).toBe(1); // Returns 1 as fallback
    });
  });

  describe('calculateMacrosPerGram', () => {
    it('should calculate macros per gram correctly', () => {
      const item: FoodLogItem = {
        id: '1',
        name: 'Test Food',
        servingSize: '1 serving',
        quantidade: 2,
        calories: 400, // 200 cal per 100g
        proteinG: 40, // 20g protein per 100g
        carbsG: 50, // 25g carbs per 100g
        fatG: 20, // 10g fat per 100g
        baseUnit: 'serving',
        servingGrams: 100,
        computedTotalGrams: 200
      };
      
      const result = calculateMacrosPerGram(item);
      
      expect(result.caloriesPerGram).toBe(2); // 400 cal / 200g
      expect(result.proteinPerGram).toBe(0.2); // 40g / 200g
      expect(result.carbsPerGram).toBe(0.25); // 50g / 200g
      expect(result.fatPerGram).toBe(0.1); // 20g / 200g
    });
    
    it('should handle zero total grams', () => {
      const item: FoodLogItem = {
        id: '1',
        name: 'Test Food',
        servingSize: '1 serving',
        quantidade: 0,
        calories: 0,
        proteinG: 0,
        carbsG: 0,
        fatG: 0,
        baseUnit: 'serving',
        servingGrams: 100,
        computedTotalGrams: 0
      };
      
      const result = calculateMacrosPerGram(item);
      
      expect(result.caloriesPerGram).toBe(0);
      expect(result.proteinPerGram).toBe(0);
      expect(result.carbsPerGram).toBe(0);
      expect(result.fatPerGram).toBe(0);
    });
  });
  
  describe('calculateTotalGrams', () => {
    it('should calculate total grams for servings mode', () => {
      const item: FoodLogItem = {
        id: '1',
        name: 'Test Food',
        servingSize: '1 serving',
        quantidade: 1.5,
        calories: 0,
        proteinG: 0,
        carbsG: 0,
        fatG: 0,
        baseUnit: 'serving',
        servingGrams: 40, // 40g per serving
        computedTotalGrams: 60
      };
      
      expect(calculateTotalGrams(item)).toBe(60); // 1.5 * 40
    });
    
    it('should calculate total grams for grams mode', () => {
      const item: FoodLogItem = {
        id: '1',
        name: 'Test Food',
        servingSize: '200g',
        quantidade: 200,
        calories: 0,
        proteinG: 0,
        carbsG: 0,
        fatG: 0,
        baseUnit: 'grams',
        servingGrams: 1,
        computedTotalGrams: 200
      };
      
      expect(calculateTotalGrams(item)).toBe(200);
    });
  });
  
  describe('formatServingSize', () => {
    it('should format serving mode correctly', () => {
      const item: FoodLogItem = {
        id: '1',
        name: 'Test Food',
        servingSize: '1 serving',
        quantidade: 1,
        calories: 0,
        proteinG: 0,
        carbsG: 0,
        fatG: 0,
        baseUnit: 'serving',
        servingGrams: 100,
        computedTotalGrams: 100
      };
      
      expect(formatServingSize(item)).toBe('1 serving');
    });
    
    it('should format plural servings correctly', () => {
      const item: FoodLogItem = {
        id: '1',
        name: 'Test Food',
        servingSize: '1 serving',
        quantidade: 2,
        calories: 0,
        proteinG: 0,
        carbsG: 0,
        fatG: 0,
        baseUnit: 'serving',
        servingGrams: 100,
        computedTotalGrams: 200
      };
      
      expect(formatServingSize(item)).toBe('2 servings');
    });
    
    it('should format grams mode correctly', () => {
      const item: FoodLogItem = {
        id: '1',
        name: 'Test Food',
        servingSize: '200g',
        quantidade: 200,
        calories: 0,
        proteinG: 0,
        carbsG: 0,
        fatG: 0,
        baseUnit: 'grams',
        servingGrams: 1,
        computedTotalGrams: 200
      };
      
      expect(formatServingSize(item)).toBe('200g');
    });
  });
  
  describe('computeServingsChange with known portion weight (40g)', () => {
    const mockFoodLogItem: FoodLogItem = {
      id: '1',
      name: 'Test Food',
      servingSize: '1 serving',
      quantidade: 1,
      calories: 80, // 200 calories per 100g, so 40g = 80 cal
      proteinG: 8, // 20g protein per 100g
      carbsG: 10, // 25g carbs per 100g
      fatG: 4, // 10g fat per 100g
      baseUnit: 'serving',
      servingGrams: 40, // 40g per serving
      computedTotalGrams: 40
    };
    
    it('servings 1.0 -> grams 40', () => {
      const result = computeServingsChange({
        originalItem: mockFoodLogItem,
        editedQuantity: 1.0,
        editedUnit: 'serving'
      });
      
      expect(result.newTotalGrams).toBe(40);
      expect(result.newQuantity).toBe(1);
      expect(result.newBaseUnit).toBe('serving');
    });
    
    it('servings 1.5 -> grams 60', () => {
      const result = computeServingsChange({
        originalItem: mockFoodLogItem,
        editedQuantity: 1.5,
        editedUnit: 'serving'
      });
      
      expect(result.newTotalGrams).toBe(60); // 1.5 * 40
      expect(result.newQuantity).toBe(1.5);
      expect(result.newBaseUnit).toBe('serving');
      expect(result.newCalories).toBe(120); // 80 * 1.5
    });
    
    it('whole number grams input (60g)', () => {
      const result = computeServingsChange({
        originalItem: mockFoodLogItem,
        editedQuantity: 60, // Whole number grams
        editedUnit: 'grams'
      });
      
      expect(result.newTotalGrams).toBe(60);
      expect(result.newQuantity).toBe(60); // In grams mode, quantity = grams
      expect(result.newBaseUnit).toBe('grams');
      expect(result.newCalories).toBe(160); // 80 * (60/40) = 120
    });
  });
  
  describe('macro scaling with caloriesPer100g=200', () => {
    const mockFoodLogItem: FoodLogItem = {
      id: '1',
      name: 'Test Food',
      servingSize: '100 g',
      quantidade: 1,
      calories: 200, // 200 cal per 100g
      proteinG: 20, // 20g protein per 100g
      carbsG: 25, // 25g carbs per 100g
      fatG: 10, // 10g fat per 100g
      baseUnit: 'grams',
      servingGrams: 1,
      computedTotalGrams: 100
    };
    
    it('grams 60 -> calories 120', () => {
      const result = computeServingsChange({
        originalItem: mockFoodLogItem,
        editedQuantity: 60,
        editedUnit: 'grams'
      });
      
      expect(result.newTotalGrams).toBe(60);
      expect(result.newCalories).toBe(120); // 200 * 0.6
      expect(result.newProteinG).toBe(12); // 20 * 0.6
      expect(result.newCarbsG).toBe(15); // 25 * 0.6
      expect(result.newFatG).toBe(6); // 10 * 0.6
    });
    
    it('servings 0.5 with 100g per serving -> grams 50', () => {
      const foodWithServings: FoodLogItem = {
        ...mockFoodLogItem,
        baseUnit: 'serving',
        servingGrams: 100,
        servingSize: '1 serving',
        computedTotalGrams: 100
      };
      
      const result = computeServingsChange({
        originalItem: foodWithServings,
        editedQuantity: 0.5,
        editedUnit: 'serving'
      });
      
      expect(result.newTotalGrams).toBe(50); // 0.5 * 100
      expect(result.newCalories).toBe(100); // 200 * 0.5
    });
  });
  
  describe('round-trip mode switching with rounding', () => {
    const mockFoodLogItem: FoodLogItem = {
      id: '1',
      name: 'Test Food',
      servingSize: '1 serving',
      quantidade: 1.5,
      calories: 120,
      proteinG: 12,
      carbsG: 15,
      fatG: 6,
      baseUnit: 'serving',
      servingGrams: 40,
      computedTotalGrams: 60
    };
    
    it('servings (1.5) -> grams (60) keeps integer grams', () => {
      const result = computeServingsChange({
        originalItem: mockFoodLogItem,
        editedQuantity: 60, // Current grams rounded to integer
        editedUnit: 'grams'
      });
      
      expect(result.newTotalGrams).toBe(60); // Integer grams preserved
      expect(result.newBaseUnit).toBe('grams');
      expect(result.newQuantity).toBe(60); // Integer value
      expect(result.newCalories).toBe(120); // Macros preserved
    });
    
    it('grams (60) -> servings (1.5) has 0.1 precision', () => {
      const inGramsMode: FoodLogItem = {
        ...mockFoodLogItem,
        baseUnit: 'grams',
        servingGrams: 1,
        quantidade: 60,
        computedTotalGrams: 60
      };
      
      const result = computeServingsChange({
        originalItem: inGramsMode,
        editedQuantity: 1.5, // Rounded to 0.1
        editedUnit: 'serving'
      });
      
      expect(result.newBaseUnit).toBe('serving');
      expect(result.newServingGrams).toBe(40); // Uses original serving weight
           expect(result.newTotalGrams).toBe(60); // 1.5 * 40
      expect(result.newQuantity).toBe(1.5); // 0.1 precision
      expect(result.newCalories).toBe(120);
    });
  });
});
