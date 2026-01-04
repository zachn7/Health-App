import type { FoodLogItem } from '../types';

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
export function formatServingSize(item: FoodLogItem): string {
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
  const oldServingGrams = originalItem.servingGrams || 100;
  const isUnitGrams = editedUnit === 'grams';
  
  let newServingGrams: number;
  let newQuantity: number;
  let newBaseUnit: 'serving' | 'grams';
  
  if (isUnitGrams) {
    // Changing to grams mode
    newBaseUnit = 'grams';
    // In grams mode, the quantity represents grams directly
    // servingGrams = 1 (1 "unit" = 1 gram)
    newServingGrams = 1;
    newQuantity = editedQuantity;
  } else {
    // Changing to serving mode
    newBaseUnit = 'serving';
    // Preserve the serving weight from original item
    newServingGrams = oldServingGrams;
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
      newServingGrams,
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
    newServingGrams,
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