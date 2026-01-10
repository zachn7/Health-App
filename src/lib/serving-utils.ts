import type { FoodLogItem } from '../types';

/**
 * Round grams to integer (whole number)
 */
export function roundToIntGrams(x: number): number {
  return Math.round(x);
}

/**
 * Round servings to nearest tenth (0.1 precision)
 */
export function roundToTenthServings(x: number): number {
  return Math.round(x * 10) / 10;
}

/**
 * Convert servings to grams with rounding
 */
export function servingsToGrams(servings: number, gramWeight: number): number {
  return roundToIntGrams(servings * gramWeight);
}

/**
 * Convert grams to servings with rounding
 */
export function gramsToServings(grams: number, gramWeight: number): number {
  if (gramWeight <= 0) return 1; // Guard against division by zero
  return roundToTenthServings(grams / gramWeight);
}

/**
 * Calculate macros per gram from a food item
 */
export function calculateMacrosPerGram(item: FoodLogItem) {
  const totalGrams = item.computedTotalGrams || (item.quantidade * item.servingGrams);
  if (totalGrams === 0) {
    return {
      caloriesPerGram: 0,
      proteinPerGram: 0,
      carbsPerGram: 0,
      fatPerGram: 0,
      fiberPerGram: 0,
      sugarPerGram: 0,
      sodiumPerGram: 0
    };
  }
  return {
    caloriesPerGram: item.calories / totalGrams,
    proteinPerGram: item.proteinG / totalGrams,
    carbsPerGram: item.carbsG / totalGrams,
    fatPerGram: item.fatG / totalGrams,
    fiberPerGram: item.fiberG ? item.fiberG / totalGrams : undefined,
    sugarPerGram: item.sugarG ? item.sugarG / totalGrams : undefined,
    sodiumPerGram: item.sodiumMg ? item.sodiumMg / totalGrams : undefined
  };
}

/**
 * Format serving size for display
 * Returns human-friendly strings like "1 serving" or "200 g"
 */
export function formatServingSize(item: FoodLogItem | Omit<FoodLogItem, 'id'>): string {
  const base = item.baseUnit || 'serving';
  const qty = item.quantidade;
  
  if (base === 'grams') {
    return `${Math.round(qty)}g`;
  } else {
    return `${qty} serving${qty !== 1 ? 's' : ''}`;
  }
}

/**
 * Calculate total grams from quantity and serving info
 */
export function calculateTotalGrams(item: FoodLogItem): number {
  return item.computedTotalGrams || (item.quantidade * item.servingGrams);
}

/**
 * Compute updated food item when changing serving size/grams
 * This is a single source of truth for both Nutrition and Meals
 */
export interface ServingEditResult {
  newQuantity: number;
  newServingGrams: number;
  newBaseUnit: 'serving' | 'grams';
  newDisplayServingSize: string;
  newTotalGrams: number;
  newCalories: number;
  newProteinG: number;
  newCarbsG: number;
  newFatG: number;
  newFiberG?: number;
  newSugarG?: number;
  newSodiumMg?: number;
}

export function computeServingsChange(params: {
  originalItem: FoodLogItem;
  editedQuantity: number;
  editedUnit: 'serving' | 'grams';
}): ServingEditResult {
  const { originalItem, editedQuantity, editedUnit } = params;
  
  const oldTotalGrams = calculateTotalGrams(originalItem);
  // Preserve the original servingGrams if available, otherwise use current or default
  // This prevents losing the USDA portion gramWeight when toggling modes
  const originalServingGrams = originalItem.servingGrams || 100;
  const isUnitGrams = editedUnit === 'grams';
  
  let newServingGrams: number;
  let newQuantity: number;
  let newBaseUnit: 'serving' | 'grams';
  
  if (isUnitGrams) {
    // Changing to grams mode
    newBaseUnit = 'grams';
    // In grams mode, the quantity represents grams directly
    // servingGrams = 1 (1 "unit" = 1 gram) for calculation purposes
    // But we keep track of the original servingGrams for when we switch back
    newServingGrams = 1;
    newQuantity = editedQuantity;
  } else {
    // Changing to serving mode
    newBaseUnit = 'serving';
    // Always preserve the original servingGrams, don't use the current value (which might be 1 from grams mode)
    newServingGrams = originalServingGrams;
    newQuantity = editedQuantity;
  }
  
  const newTotalGrams = newQuantity * newServingGrams;
  
  // Calculate macros using the ratio of new to old total grams
  const gramRatio = newTotalGrams / oldTotalGrams;
  
  const macrosPerGram = calculateMacrosPerGram(originalItem);
  
  // When switching to grams mode, use macrosPerGram directly to avoid precision issues
  if (isUnitGrams) {
    return {
      newQuantity: Math.round(newQuantity * 100) / 100,
      newServingGrams, // This will be 1 in grams mode
      newBaseUnit,
      newDisplayServingSize: `${Math.round(newQuantity)}g`,
      newTotalGrams,
      newCalories: Math.round(macrosPerGram.caloriesPerGram * newQuantity),
      newProteinG: Math.round((macrosPerGram.proteinPerGram * newQuantity) * 10) / 10,
      newCarbsG: Math.round((macrosPerGram.carbsPerGram * newQuantity) * 10) / 10,
      newFatG: Math.round((macrosPerGram.fatPerGram * newQuantity) * 10) / 10,
      newFiberG: macrosPerGram.fiberPerGram ? Math.round((macrosPerGram.fiberPerGram * newQuantity) * 10) / 10 : undefined,
      newSugarG: macrosPerGram.sugarPerGram ? Math.round((macrosPerGram.sugarPerGram * newQuantity) * 10) / 10 : undefined,
      newSodiumMg: macrosPerGram.sodiumPerGram ? Math.round(macrosPerGram.sodiumPerGram * newQuantity) : undefined
    };
  }
  
  // In serving mode, use ratio for consistency
  return {
    newQuantity: Math.round(newQuantity * 100) / 100,
    newServingGrams, // Always use the original servingGrams
    newBaseUnit,
    newDisplayServingSize: `${newQuantity} serving${newQuantity !== 1 ? 's' : ''}`,
    newTotalGrams,
    newCalories: Math.round(originalItem.calories * gramRatio),
    newProteinG: Math.round((originalItem.proteinG * gramRatio) * 10) / 10,
    newCarbsG: Math.round((originalItem.carbsG * gramRatio) * 10) / 10,
    newFatG: Math.round((originalItem.fatG * gramRatio) * 10) / 10,
    newFiberG: originalItem.fiberG ? Math.round((originalItem.fiberG * gramRatio) * 10) / 10 : undefined,
    newSugarG: originalItem.sugarG ? Math.round((originalItem.sugarG * gramRatio) * 10) / 10 : undefined,
    newSodiumMg: originalItem.sodiumMg ? Math.round(originalItem.sodiumMg * gramRatio) : undefined
  };
}
