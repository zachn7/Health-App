import { settingsRepository } from '@/db/repositories/settings.repository';
import { db } from '@/db';
import { FoodItem, FoodLogItem } from '@/types';
import { rerankUSDAFoods } from '@/lib/search/fuzzy';

/**
 * Atwater general factors for estimating missing macros
 * Protein: 4 kcal/g, Carbs: 4 kcal/g, Fat: 9 kcal/g
 */
export const ATWATER_FACTORS = {
  protein: 4,
  carbs: 4,
  fat: 9
};

/**
 * Validation result for USDA nutrient data
 */
export interface NutrientValidationResult {
  isValid: boolean;
  hasCalories: boolean;
  hasProtein: boolean;
  hasCarbs: boolean;
  hasFat: boolean;
  canEstimate: boolean; // Can we estimate the missing macro?
  missingMacros: string[]; // Names of missing macros
  recommendedAction: 'import' | 'manual' | 'estimate' | 'skip';
}

/**
 * Validate that essential macros are present
 * A nutrient is 'missing' ONLY if it is undefined/null
 * A value of 0 is VALID and must NOT be treated as missing
 */
export function validateMacros(macros: Partial<{
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}>): NutrientValidationResult {
  // Check for presence (not missing) - undefined/null only
  const hasCalories = macros.calories != null;
  const hasProtein = macros.proteinG != null;
  const hasCarbs = macros.carbsG != null;
  const hasFat = macros.fatG != null;
  
  const missingMacros: string[] = [];
  if (!hasCalories) missingMacros.push('calories');
  if (!hasProtein) missingMacros.push('protein');
  if (!hasCarbs) missingMacros.push('carbs');
  if (!hasFat) missingMacros.push('fat');
  
  // Count present macros
  const presentMacrosCount = [hasProtein, hasCarbs, hasFat].filter(Boolean).length;
  const totalPresentCount = presentMacrosCount + (hasCalories ? 1 : 0);
  
  // Can we estimate the missing macro?
  // Case A: If calories missing and P/C/F all present => CAN estimate calories
  const canEstimateCalories = !hasCalories && presentMacrosCount === 3;
  
  // Case B: If one macro missing but calories and other macros present => CAN estimate macro
  const canEstimateMacro = hasCalories && presentMacrosCount === 2;
  
  const canEstimate = canEstimateCalories || canEstimateMacro;
  
  // Determine recommended action
  let recommendedAction: 'import' | 'manual' | 'estimate' | 'skip' = 'import';
  
  if (totalPresentCount === 0) {
    // No data at all
    recommendedAction = 'skip';
  } else if (totalPresentCount >= 4) {
    // All 4 fields present - can import directly
    recommendedAction = 'import';
  } else if (totalPresentCount >= 2 && canEstimate) {
    // Exactly one field missing and can estimate
    recommendedAction = 'estimate';
  } else {
    // Too many missing or can't estimate
    recommendedAction = 'manual';
  }
  
  const isValid = recommendedAction === 'import' || recommendedAction === 'estimate';
  
  return {
    isValid,
    hasCalories,
    hasProtein,
    hasCarbs,
    hasFat,
    canEstimate,
    missingMacros,
    recommendedAction
  };
}

/**
 * Estimate missing macro or calories using Atwater factors
 * Should only be called when exactly ONE field is missing
 * Rule A: If calories missing & P/C/F all present -> calories = 4*P + 4*C + 9*F
 * Rule B: If one macro missing & calories + other macros present -> macro = (cal - 4*x - 9*y) / factor
 */
export function estimateMissingMacro(
  macros: {
    calories?: number;
    proteinG?: number;
    carbsG?: number;
    fatG?: number;
  }
): { calories?: number; proteinG?: number; carbsG?: number; fatG?: number } {
  const { calories, proteinG, carbsG, fatG } = macros;
  
  // Case A: Missing calories, but all P/C/F present
  if (calories === undefined && proteinG !== undefined && carbsG !== undefined && fatG !== undefined) {
    const estimatedCalories = Math.round(
      (proteinG * ATWATER_FACTORS.protein) +
      (carbsG * ATWATER_FACTORS.carbs) +
      (fatG * ATWATER_FACTORS.fat)
    );
    return { calories: estimatedCalories, proteinG, carbsG, fatG };
  }
  
  // Case B: Missing one macro, but calories and other macros present
  if (calories !== undefined) {
    // Calculate known calories from present macros
    let knownCalories = 0;
    if (proteinG !== undefined) knownCalories += proteinG * ATWATER_FACTORS.protein;
    if (carbsG !== undefined) knownCalories += carbsG * ATWATER_FACTORS.carbs;
    if (fatG !== undefined) knownCalories += fatG * ATWATER_FACTORS.fat;
    
    const remainingCalories = calories - knownCalories;
    
    // Determine which macro is missing and estimate it
    if (proteinG === undefined && carbsG !== undefined && fatG !== undefined) {
      // Missing protein
      return {
        calories,
        proteinG: Math.max(0, Math.round((remainingCalories / ATWATER_FACTORS.protein) * 10) / 10),
        carbsG,
        fatG
      };
    } else if (carbsG === undefined && proteinG !== undefined && fatG !== undefined) {
      // Missing carbs
      return {
        calories,
        proteinG,
        carbsG: Math.max(0, Math.round((remainingCalories / ATWATER_FACTORS.carbs) * 10) / 10),
        fatG
      };
    } else if (fatG === undefined && proteinG !== undefined && carbsG !== undefined) {
      // Missing fat
      return {
        calories,
        proteinG,
        carbsG,
        fatG: Math.max(0, Math.round((remainingCalories / ATWATER_FACTORS.fat) * 10) / 10)
      };
    }
  }
  
  // Can't estimate - return as-is
  return { calories, proteinG, carbsG, fatG };
}

/**
 * Normalized nutrition data with metadata
 */
export interface NormalizedNutrition {
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;
  sugarG: number | null;
  sodiumMg: number | null;
  completeness: 'complete' | 'incomplete' | 'empty';
  usedInference: boolean;
  basis: 'per_serving' | 'per_100g';
  estimatedFields: string[];
}

/**
 * Unified function to normalize nutrition data from USDA food details
 * Handles both labelNutrients and foodNutrients with robust matching
 * Returns null for missing values (never 0 as default)
 */
export function normalizeFdcNutrition(foodDetail: USDAFoodDetail): NormalizedNutrition {
  // Initialize with all null values (missing, not zero)
  let calories: number | null = null;
  let proteinG: number | null = null;
  let carbsG: number | null = null;
  let fatG: number | null = null;
  let fiberG: number | null = null;
  let sugarG: number | null = null;
  let sodiumMg: number | null = null;
  let basis: 'per_serving' | 'per_100g' = 'per_serving';
  
  // Try labelNutrients first (Branded foods - per serving)
  if (foodDetail.labelNutrients) {
    const ln = foodDetail.labelNutrients;
    
    if (ln.calories?.value !== undefined) {
      calories = Math.round(ln.calories.value);
    }
    if (ln.protein?.value !== undefined) {
      proteinG = Math.round(ln.protein.value * 10) / 10;
    }
    if (ln.carbohydrates?.value !== undefined) {
      carbsG = Math.round(ln.carbohydrates.value * 10) / 10;
    }
    if (ln.fat?.value !== undefined) {
      fatG = Math.round(ln.fat.value * 10) / 10;
    }
    if (ln.fiber?.value !== undefined) {
      fiberG = Math.round(ln.fiber.value * 10) / 10;
    }
    if (ln.sugars?.value !== undefined) {
      sugarG = Math.round(ln.sugars.value * 10) / 10;
    }
    if (ln.sodium?.value !== undefined) {
      sodiumMg = Math.round(ln.sodium.value);
    }
    
    basis = 'per_serving';
  } else if (foodDetail.foodNutrients && foodDetail.foodNutrients.length > 0) {
    // Fallback to foodNutrients (Foundation/SR foods - typically per 100g)
    // Match by both nutrientNumber AND nutrient name for robustness
    const getNutrientValue = (
      nutrientNumber: number, 
      nutrientName: string
    ): number | null => {
      // Try exact number match first
      let nutrient = foodDetail.foodNutrients!.find(n => 
        (n as any).nutrientNumber === nutrientNumber || n.nutrientId === nutrientNumber
      );
      
      // Fallback to name match
      if (!nutrient) {
        nutrient = foodDetail.foodNutrients!.find(n => {
          const name = n.nutrientName?.toLowerCase() || '';
          return name.includes(nutrientName) || name === nutrientName;
        });
      }
      
      return nutrient?.value !== undefined ? nutrient.value : null;
    };
    
    // Energy (1008 or 208)
    calories = getNutrientValue(1008, 'energy');
    if (calories === null) {
      calories = getNutrientValue(208, 'energy');
    }
    
    // Protein (1003 or 203)
    proteinG = getNutrientValue(1003, 'protein');
    if (proteinG === null) {
      proteinG = getNutrientValue(203, 'protein');
    }
    
    // Total Lipid / Fat (1004 or 204)
    fatG = getNutrientValue(1004, 'total lipid');
    if (fatG === null) {
      fatG = getNutrientValue(204, 'total fat');
      if (fatG === null) {
        fatG = getNutrientValue(204, 'fat');
      }
    }
    
    // Carbohydrate (1005 or 205)
    carbsG = getNutrientValue(1005, 'carbohydrate');
    if (carbsG === null) {
      carbsG = getNutrientValue(205, 'carbohydrate');
    }
    
    // Fiber (1079)
    fiberG = getNutrientValue(1079, 'fiber');
    
    // Sugars (2000)
    sugarG = getNutrientValue(2000, 'sugars');
    
    // Sodium (1093 or 307)
    sodiumMg = getNutrientValue(1093, 'sodium');
    if (sodiumMg === null) {
      sodiumMg = getNutrientValue(307, 'sodium');
    }
    
    // Round values
    if (calories !== null) calories = Math.round(calories);
    if (proteinG !== null) proteinG = Math.round(proteinG * 10) / 10;
    if (carbsG !== null) carbsG = Math.round(carbsG * 10) / 10;
    if (fatG !== null) fatG = Math.round(fatG * 10) / 10;
    if (fiberG !== null) fiberG = Math.round(fiberG * 10) / 10;
    if (sugarG !== null) sugarG = Math.round(sugarG * 10) / 10;
    if (sodiumMg !== null) sodiumMg = Math.round(sodiumMg);
    
    basis = 'per_100g';
  }
  
  // Determine completeness
  const hasCalories = calories !== null;
  const hasProtein = proteinG !== null;
  const hasCarbs = carbsG !== null;
  const hasFat = fatG !== null;
  
  const hasAnyData = hasCalories || hasProtein || hasCarbs || hasFat;
  
  let completeness: 'complete' | 'incomplete' | 'empty';
  if (!hasAnyData) {
    completeness = 'empty';
  } else if (hasCalories && hasProtein && hasCarbs && hasFat) {
    completeness = 'complete';
  } else {
    completeness = 'incomplete';
  }
  
  return {
    calories,
    proteinG,
    carbsG,
    fatG,
    fiberG,
    sugarG,
    sodiumMg,
    completeness,
    usedInference: false,
    basis,
    estimatedFields: []
  };
}

/**
 * Validate and attempt to infer missing macros
 * Returns normalized nutrition with inference applied, or null if validation fails
 */
export function validateAndInferMacros(nutrition: NormalizedNutrition): NormalizedNutrition | null {
  // Convert to format expected by validateMacros
  const macros = {
    calories: nutrition.calories ?? undefined,
    proteinG: nutrition.proteinG ?? undefined,
    carbsG: nutrition.carbsG ?? undefined,
    fatG: nutrition.fatG ?? undefined
  };
  
  // Validate
  const validation = validateMacros(macros);
  
  // If completely empty or too incomplete, reject
  if (validation.recommendedAction === 'skip' || nutrition.completeness === 'empty') {
    console.warn('[USDA] Skipping food with insufficient nutrition data');
    return null;
  } else if (validation.recommendedAction === 'import') {
    // All complete, return as-is
    return nutrition;
  }
  
  // Try to estimate missing values
  let result = { ...nutrition };
  const estimatedFields: string[] = [];
  
  if (validation.recommendedAction === 'estimate') {
    const estimated = estimateMissingMacro(macros);
    
    // Apply estimates, tracking which fields were estimated
    if (estimated.calories !== undefined && macros.calories === undefined) {
      result.calories = estimated.calories;
      estimatedFields.push('calories');
    }
    if (estimated.proteinG !== undefined && macros.proteinG === undefined) {
      result.proteinG = estimated.proteinG;
      estimatedFields.push('protein');
    }
    if (estimated.carbsG !== undefined && macros.carbsG === undefined) {
      result.carbsG = estimated.carbsG;
      estimatedFields.push('carbs');
    }
    if (estimated.fatG !== undefined && macros.fatG === undefined) {
      result.fatG = estimated.fatG;
      estimatedFields.push('fat');
    }
    
    result.usedInference = true;
    result.estimatedFields = estimatedFields;
    result.completeness = 'complete';
  } else {
    // Too incomplete to estimate
    console.warn('[USDA] Skipping food - too incomplete to estimate');
    return null;
  }
  
  // Validation: re-compute calories from final macros and check tolerance
  if (result.calories !== null && result.proteinG !== null && result.carbsG !== null && result.fatG !== null) {
    const recomputedCalories = Math.round(
      (result.proteinG * ATWATER_FACTORS.protein) +
      (result.carbsG * ATWATER_FACTORS.carbs) +
      (result.fatG * ATWATER_FACTORS.fat)
    );
    
    const diff = Math.abs(recomputedCalories - result.calories);
    const tolerance = Math.max(20, Math.round(result.calories * 0.10)); // max(20 kcal, 10%)
    
    if (diff > tolerance) {
      console.warn(
        `[USDA] Calories validation failed: computed=${recomputedCalories}, provided=${result.calories}, ` +
        `diff=${diff}, tolerance=${tolerance}. Rejecting food.`
      );
      return null; // Validation failed - block this food
    }
  }
  
  return result;
}

export interface SearchDiagnostics {
  query: string;
  url: string;
  timestamp: string;
  status: number | null;
  errorMessage: string | null;
  resultCount: number;
}

export interface USDFoodSearchResult {
  fdcId: number;
  description: string;
  dataType: string;
  gtinUpc?: string;
  publishedDate: string;
  brandOwner?: string;
  ingredients?: string;
  foodCategory?: string;
  allHighlightFields?: string;
  score?: number;
  foodNutrients?: any[];
  labelNutrients?: any;
  servingSize?: number;
  servingSizeUnit?: string;
  householdServingFullText?: string;
  foodPortions?: {
    amount: number;
    description: string;
    gramWeight: number;
    modifier: string;
  }[];
}

export interface USDAFoodDetail {
  fdcId: number;
  description: string;
  dataType: string;
  gtinUpc?: string;
  publishedDate: string;
  brandOwner?: string;
  ingredients?: string;
  foodCategory?: string;
  foodNutrients?: {
    nutrientId: number;
    nutrientName: string;
    unitName: string;
    value: number;
    derivationCode?: string;
    derivationDescription?: string;
  }[];
  labelNutrients?: {
    calories?: { value: number };
    protein?: { value: number };
    fat?: { value: number };
    carbohydrates?: { value: number };
    fiber?: { value: number };
    sugars?: { value: number };
    sodium?: { value: number };
  };
  servingSize?: number;
  servingSizeUnit?: string;
  householdServingFullText?: string;
  foodPortions?: {
    amount: number;
    description: string;
    gramWeight: number;
    modifier: string;
  }[];
}

export interface MacroNutrients {
  calories: number | undefined;
  proteinG: number | undefined;
  carbsG: number | undefined;
  fatG: number | undefined;
  fiberG?: number;
  sugarG?: number;
  sodiumMg?: number;
  basis: 'per_serving' | 'per_100g';
}

/**
 * Extract macros from search result (may be partial/missing)
 */
export function extractMacrosFromSearchResult(food: USDFoodSearchResult): MacroNutrients | null {
  if (food.labelNutrients) {
    // Branded food with label nutrients (per serving)
    const ln = food.labelNutrients;
    // Preserve undefined for missing values - 0 is a VALID value!
    const hasData = ln.calories?.value !== undefined || 
                    ln.protein?.value !== undefined || 
                    ln.fat?.value !== undefined || 
                    ln.carbohydrates?.value !== undefined;
    
    if (!hasData) return null;
    
    return {
      calories: ln.calories?.value !== undefined ? Math.round(ln.calories.value) : undefined,
      proteinG: ln.protein?.value !== undefined ? Math.round(ln.protein.value * 10) / 10 : undefined,
      carbsG: ln.carbohydrates?.value !== undefined ? Math.round(ln.carbohydrates.value * 10) / 10 : undefined,
      fatG: ln.fat?.value !== undefined ? Math.round(ln.fat.value * 10) / 10 : undefined,
      fiberG: ln.fiber?.value !== undefined ? Math.round(ln.fiber.value * 10) / 10 : undefined,
      sugarG: ln.sugars?.value !== undefined ? Math.round(ln.sugars.value * 10) / 10 : undefined,
      sodiumMg: ln.sodium?.value !== undefined ? Math.round(ln.sodium.value) : undefined,
      basis: 'per_serving' as const
    };
  }
  
  if (food.foodNutrients && food.foodNutrients.length > 0) {
    // Foundation/SR food with foodNutrients (typically per 100g)
    const getNutrientValue = (nutrientNumber: number): number | undefined => {
      const nutrient = food.foodNutrients!.find(n => 
        (n as any).nutrientNumber === nutrientNumber || n.nutrientId === nutrientNumber
      );
      return nutrient?.value;
    };

    const calories = getNutrientValue(1008);
    const proteinG = getNutrientValue(1003);
    const fatG = getNutrientValue(1004);
    const carbsG = getNutrientValue(1005);

    if (calories !== undefined || proteinG !== undefined || fatG !== undefined || carbsG !== undefined) {
      return {
        calories: calories !== undefined ? Math.round(calories) : undefined,
        proteinG: proteinG !== undefined ? Math.round(proteinG * 10) / 10 : undefined,
        carbsG: carbsG !== undefined ? Math.round(carbsG * 10) / 10 : undefined,
        fatG: fatG !== undefined ? Math.round(fatG * 10) / 10 : undefined,
        basis: 'per_100g' as const
      };
    }
  }
  
  return null;
}

/**
 * Batch fetch food details for multiple fdcIds
 * Returns a map of fdcId -> foodDetail
 */
export async function batchFetchFoodDetails(
  fdcIds: number[]
): Promise<Map<number, USDAFoodDetail>> {
  const results = new Map<number, USDAFoodDetail>();
  const apiKey = await getApiKeyStatic();
  
  if (!apiKey) {
    return results;
  }
  
  // Process in batches of 20 to avoid overwhelming the API
  const batchSize = 20;
  
  for (let i = 0; i < fdcIds.length; i += batchSize) {
    const batch = fdcIds.slice(i, i + batchSize);
    const detailPromises = batch.map(async (fdcId) => {
      try {
        const url = new URL(`${BASE_URL}/food/${fdcId}`);
        url.searchParams.set('api_key', apiKey);
        
        const response = await fetch(url.toString());
        if (!response.ok) {
          console.warn(`Failed to fetch details for fdcId ${fdcId}: ${response.statusText}`);
          return null;
        }
        
        const foodDetail: USDAFoodDetail = await response.json();
        return foodDetail;
      } catch (error) {
        console.error(`Error fetching details for fdcId ${fdcId}:`, error);
        return null;
      }
    });
    
    const batchResults = await Promise.all(detailPromises);
    
    for (let j = 0; j < batch.length; j++) {
      if (batchResults[j]) {
        results.set(batch[j], batchResults[j]!);
      }
    }
  }
  
  return results;
}

/**
 * Get the default serving grams from food details
 * Returns null if no serving information is available
 */
export function getDefaultServingGrams(foodDetail: USDAFoodDetail): number | null {
  // Check for labeled serving size (Branded foods)
  if (foodDetail.servingSize && foodDetail.servingSizeUnit) {
    const unit = foodDetail.servingSizeUnit.toLowerCase();
    
    // If the unit is grams, use it directly
    if (unit.includes('g') || unit === 'grams' || unit === 'gram') {
      return foodDetail.servingSize;
    }
    
    // Check foodPortions for gramWeight of the first portion
    if (foodDetail.foodPortions && foodDetail.foodPortions.length > 0) {
      // Prefer portion with amount=1
      const portion = foodDetail.foodPortions.find(p => p.amount === 1) || foodDetail.foodPortions[0];
      if (portion.gramWeight) {
        return portion.gramWeight;
      }
    }
  }
  
  // Check foodPortions directly
  if (foodDetail.foodPortions && foodDetail.foodPortions.length > 0) {
    // Prefer portion with amount=1
    const portion = foodDetail.foodPortions.find(p => p.amount === 1) || foodDetail.foodPortions[0];
    if (portion.gramWeight) {
      return portion.gramWeight;
    }
  }
  
  // No serving info available
  return null;
}

/**
 * Compute per-serving macros from detailed food data
 * If servingGrams is provided, converts from per-100g to per-serving
 */
export function computePerServingMacros(
  foodDetail: USDAFoodDetail
): { macros: MacroNutrients; servingGrams: number | null; displaySize: string } {
  const macros = extractMacrosFromSearchResult(foodDetail as any);
  
  if (!macros) {
    return {
      macros: {
        calories: undefined,
        proteinG: undefined,
        carbsG: undefined,
        fatG: undefined,
        fiberG: undefined,
        sugarG: undefined,
        sodiumMg: undefined,
        basis: 'per_100g'
      },
      servingGrams: null,
      displaySize: 'per 100 g'
    };
  }
  
  // Check if this is a Foundation food with per-100g macros
  const isFoundation = foodDetail.dataType === 'Foundation' || foodDetail.dataType === 'SR Legacy';
  
  // Foundation foods with per-100g macros have no real serving - show "per 100 g"
  if (isFoundation && macros.basis === 'per_100g') {
    return {
      macros,
      servingGrams: 100,
      displaySize: 'per 100 g'
    };
  }
  
  const servingGrams = getDefaultServingGrams(foodDetail);
  
  if (servingGrams && macros.basis === 'per_100g') {
    // Foundation foods have per-100g macros but no real serving - show "per 100 g"
    // Branded foods with per-100g might need conversion if they have a different serving
    if (isFoundation) {
      // Foundation food - show as per 100g
      return {
        macros,
        servingGrams,
        displaySize: 'per 100 g'
      };
    }
    
    // Branded food with per-100g macros but different serving size - convert
    const scaleFactor = servingGrams / 100;
    
    return {
      macros: {
        calories: macros.calories !== undefined ? Math.round(macros.calories * scaleFactor) : undefined,
        proteinG: macros.proteinG !== undefined ? Math.round(macros.proteinG * scaleFactor * 10) / 10 : undefined,
        carbsG: macros.carbsG !== undefined ? Math.round(macros.carbsG * scaleFactor * 10) / 10 : undefined,
        fatG: macros.fatG !== undefined ? Math.round(macros.fatG * scaleFactor * 10) / 10 : undefined,
        fiberG: macros.fiberG !== undefined ? Math.round(macros.fiberG * scaleFactor * 10) / 10 : undefined,
        sugarG: macros.sugarG !== undefined ? Math.round(macros.sugarG * scaleFactor * 10) / 10 : undefined,
        sodiumMg: macros.sodiumMg !== undefined ? Math.round(macros.sodiumMg * scaleFactor) : undefined,
        basis: 'per_serving'
      },
      servingGrams,
      displaySize: `1 serving (${servingGrams}g)`
    };
  }
  
  // Either no serving info or already per-serving
  if (servingGrams) {
    return {
      macros,
      servingGrams,
      displaySize: `1 serving (${servingGrams}g)`
    };
  }
  
  // No serving info available - show as per 100g
  return {
    macros,
    servingGrams: null,
    displaySize: 'per 100 g'
  };
}

// Helper function to get API key without needing a class instance
async function getApiKeyStatic(): Promise<string | null> {
  try {
    return await settingsRepository.getFdcApiKey() || null;
  } catch (error) {
    console.error('Error getting API key:', error);
    return null;
  }
}

const BASE_URL = 'https://api.nal.usda.gov/fdc/v1';

class USDAService {
  
  static async getApiKey(): Promise<string | null> {
    try {
      return await settingsRepository.getFdcApiKey() || null;
    } catch (error) {
      console.error('Failed to get USDA API key:', error);
      return null;
    }
  }
  
  static async isUSDALookupsEnabled(): Promise<boolean> {
    try {
      return await settingsRepository.isUSDALookupsEnabled();
    } catch (error) {
      console.error('Failed to check USDA lookup status:', error);
      return false;
    }
  }
  
  static async searchFoods(
    query: string, 
    pageSize: number = 100
  ): Promise<{ results: USDFoodSearchResult[]; diagnostics: SearchDiagnostics }> {
    const apiKey = await this.getApiKey();
    if (!apiKey) {
      throw new Error('USDA API key not configured');
    }
    
    const enabled = await this.isUSDALookupsEnabled();
    if (!enabled) {
      throw new Error('USDA lookups are disabled in settings');
    }
    
    // Request specific nutrients to get macro data in search results
    const nutrientNumbers = ['1008', '1003', '1004', '1005', '1079', '2000', '1093'].join(',');
    
    const searchParams = new URLSearchParams({
      query: query,
      pageSize: pageSize.toString(),
      pageNumber: '1',
      sortBy: 'score',
      sortOrder: 'desc',
      api_key: apiKey,
      nutrients: nutrientNumbers,
      dataType: 'Foundation,SR Legacy,Branded'
    });
    
    const url = `${BASE_URL}/foods/search?${searchParams.toString()}`;
    const diagnostics: SearchDiagnostics = {
      query,
      url,
      timestamp: new Date().toISOString(),
      status: null,
      errorMessage: null,
      resultCount: 0
    };
    
    try {
      const response = await fetch(url);
      diagnostics.status = response.status;
      
      if (!response.ok) {
        let errorMessage = `USDA API error: ${response.statusText}`;
        if (response.status === 401) {
          errorMessage = 'Invalid USDA API key';
        } else if (response.status === 429) {
          errorMessage = 'USDA API rate limit exceeded';
        }
        diagnostics.errorMessage = errorMessage;
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      let foods = data.foods || [];
      diagnostics.resultCount = foods.length;
      
      // Filter out ignored foods
      foods = this.filterIgnoredFoods(foods);
      
      // Client-side reranking with fuzzy search for better partial matches
      if (query && query.trim() && foods.length > 0) {
        console.log('[USDA] Reranking', foods.length, 'results for query:', query);
        foods = rerankUSDAFoods(foods, query);
        console.log('[USDA] Reranked to', foods.length, 'results');
      }
      
      return { results: foods, diagnostics };
    } catch (error) {
      if (error instanceof Error) {
        diagnostics.errorMessage = error.message;
      } else {
        diagnostics.errorMessage = String(error);
      }
      
      console.error('Failed to search USDA foods:', error);
      throw new Error(diagnostics.errorMessage || 'Failed to search USDA foods');
    }
  }
  
  static async getFoodDetails(fdcId: number): Promise<USDAFoodDetail> {
    const apiKey = await this.getApiKey();
    if (!apiKey) {
      throw new Error('USDA API key not configured');
    }
    
    try {
      const searchParams = new URLSearchParams({
        api_key: apiKey
      });
      
      const response = await fetch(
        `${BASE_URL}/food/${fdcId}?${searchParams.toString()}`
      );
      
      if (!response.ok) {
        throw new Error(`USDA API error: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Failed to get USDA food details:', error);
      throw new Error('Failed to get food details');
    }
  }
  
  /**
   * Extract macronutrients from USDA food data, supporting both foodNutrients and labelNutrients
   * Returns macros with basis indicating whether values are per serving or per 100g
   * ** IMPORTANT ** - This is now just a wrapper around normalizeFdcNutrition for backward compatibility
   */
  private static extractMacros(foodDetail: USDAFoodDetail): MacroNutrients {
    // Use the unified normalization function
    const normalized = normalizeFdcNutrition(foodDetail);
    
    // Convert to MacroNutrients format (null -> undefined for missing values)
    return {
      calories: normalized.calories ?? undefined,
      proteinG: normalized.proteinG ?? undefined,
      carbsG: normalized.carbsG ?? undefined,
      fatG: normalized.fatG ?? undefined,
      fiberG: normalized.fiberG ?? undefined,
      sugarG: normalized.sugarG ?? undefined,
      sodiumMg: normalized.sodiumMg ?? undefined,
      basis: normalized.basis
    };
  }

  private static parseServingInfo(foodDetail: USDAFoodDetail): {
    displaySize: string;
    gramsPerServing: number;
    baseUnit: 'serving' | 'grams';
    macroBasis: 'per_serving' | 'per_100g';
  } {
    // Get macro basis to determine if nutrients are per serving or per 100g
    const macros = this.extractMacros(foodDetail);
    const macroBasis = macros.basis;
    
    // Default to 100g if no serving info
    let gramsPerServing = 100;
    let displaySize = '100g';
    let baseUnit: 'serving' | 'grams' = 'grams';
    
    // Check if there's a specific serving size
    if (foodDetail.servingSize && foodDetail.servingSizeUnit) {
      const size = foodDetail.servingSize;
      const unit = foodDetail.servingSizeUnit.toLowerCase();
      
      if (unit.includes('g')) {
        // Serving is in grams
        gramsPerServing = size;
        displaySize = `${size}g`;
        baseUnit = 'grams';
      } else {
        // Serving is in other unit (cups, tbsp, etc.)
        displaySize = `${size} ${foodDetail.servingSizeUnit}`;
        baseUnit = 'serving';
      }
    } else if (foodDetail.householdServingFullText) {
      // Use household serving size
      displaySize = foodDetail.householdServingFullText;
      baseUnit = 'serving';
    }
    
    // Adjust based on macro basis
    if (macroBasis === 'per_100g') {
      // Foundation/SR foods are per 100g
      gramsPerServing = 100;
      if (!displaySize.includes('g')) {
        displaySize = '100g';
        baseUnit = 'grams';
      }
    } else {
      // Branded foods are per serving (from labelNutrients)
      if (foodDetail.servingSize && foodDetail.servingSizeUnit?.toLowerCase().includes('g')) {
        gramsPerServing = foodDetail.servingSize;
      }
    }
    
    return {
      displaySize,
      gramsPerServing,
      baseUnit,
      macroBasis
    };
  }

  static async importFoodItem(fdcId: number): Promise<FoodItem> {
    const foodDetail = await this.getFoodDetails(fdcId);
    
    // Use unified normalization + validation + inference
    const nutrition = normalizeFdcNutrition(foodDetail);
    const validated = validateAndInferMacros(nutrition);
    
    // If validation failed, block the food
    if (!validated) {
      const missingFields: string[] = [];
      if (nutrition.calories === null) missingFields.push('calories');
      if (nutrition.proteinG === null) missingFields.push('protein');
      if (nutrition.carbsG === null) missingFields.push('carbs');
      if (nutrition.fatG === null) missingFields.push('fat');
      
      throw new Error(
        'This USDA food item has incomplete nutrition data and cannot be imported. ' +
        'Missing: ' + (missingFields.length > 0 ? missingFields.join(', ') : 'required macro data') + '. ' +
        'Please try another food.'
      );
    }
    
    
    // Extract serving size information
    const servingInfo = this.parseServingInfo(foodDetail);
    
    // After validation/estimation, all required values should be non-null
    const foodItem: FoodItem = {
      id: `usda-${fdcId}`,
      name: foodDetail.description,
      servingSize: servingInfo.displaySize,
      calories: validated.calories!,
      proteinG: validated.proteinG!,
      carbsG: validated.carbsG!,
      fatG: validated.fatG!,
      fiberG: validated.fiberG ?? undefined,
      sugarG: validated.sugarG ?? undefined,
      sodiumMg: validated.sodiumMg ?? undefined,
      source: 'bundled',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Save to IndexedDB for offline use
    await db.foodItems.put(foodItem);
    
    return foodItem;
  }

  /**
   * Create a FoodLogItem from USDA data with proper macro normalization
   * Default behavior: always defaults to 1 serving (not grams)
   */
  static async createFoodLogItem(fdcId: number, customQuantity: number = 1, customUnit: string = 'serving'): Promise<FoodLogItem> {
    const foodDetail = await this.getFoodDetails(fdcId);
    
    // Use unified normalization + validation + inference
    const nutrition = normalizeFdcNutrition(foodDetail);
    const validated = validateAndInferMacros(nutrition);
    
    // If validation failed, block the food
    if (!validated) {
      const missingFields: string[] = [];
      if (nutrition.calories === null) missingFields.push('calories');
      if (nutrition.proteinG === null) missingFields.push('protein');
      if (nutrition.carbsG === null) missingFields.push('carbs');
      if (nutrition.fatG === null) missingFields.push('fat');
      
      throw new Error(
        'This USDA food item has incomplete nutrition data. ' +
        'Missing: ' + (missingFields.length > 0 ? missingFields.join(', ') : 'required macro data') + '. ' +
        'Please try another food or add as a manual item.'
      );
    }
    
    const servingInfo = this.parseServingInfo(foodDetail);
    
    //    // Normalize customUnit to 'serving' or 'grams'
    const isGramsUnit = customUnit === 'grams' || customUnit === 'g';
    
    // Default to 'serving' if not specified
    const targetUnit = isGramsUnit ? 'grams' : 'serving';
    
    // Calculate the final macros based on the requested quantity/unit
    let scaleFactor = 1;
    let finalServingSize = servingInfo.displaySize;
    let finalQuantity = customQuantity;
    let finalServingGrams = servingInfo.gramsPerServing;
    let finalBaseUnit: 'serving' | 'grams' = targetUnit as 'serving' | 'grams';
    
    if (isGramsUnit) {
      // User wants specific grams
      if (validated.basis === 'per_100g') {
        // Foundation/SR foods are per 100g
        scaleFactor = customQuantity / 100;
      } else {
        // Branded foods are per serving - need to know how many grams are in a serving
        // Calculate scale factor: (userGrams / gramsPerServing)
        scaleFactor = customQuantity / servingInfo.gramsPerServing;
      }
      finalServingSize = `${customQuantity}g`;
      finalQuantity = 1; // Quantity represents 1 unit of the specified grams
      finalServingGrams = customQuantity;
      finalBaseUnit = 'grams';
    } else {
      // User wants servings (DEFAULT BEHAVIOR)
      scaleFactor = customQuantity;
      finalServingSize = `${customQuantity} serving${customQuantity !== 1 ? 's' : ''}`;
      
      // Set baseUnit to 'serving' by default
      finalBaseUnit = 'serving';
      
      // For Foundation/SR foods (per_100g), treat 1 serving = 100g
      if (validated.basis === 'per_100g') {
        finalServingGrams = 100; // 1 serving = 100g for Foundation foods
      } else {
        // For branded foods (per_serving), use the actual serving grams
        finalServingGrams = servingInfo.gramsPerServing;
      }
    }
    
    // Apply scaling to get the final macro values
    // After validation/estimation, validated should have all required values defined
    const finalMacros = {
      calories: Math.round(validated.calories! * scaleFactor),
      proteinG: Math.round((validated.proteinG! * scaleFactor) * 10) / 10,
      carbsG: Math.round((validated.carbsG! * scaleFactor) * 10) / 10,
      fatG: Math.round((validated.fatG! * scaleFactor) * 10) / 10,
      fiberG: validated.fiberG !== null ? Math.round((validated.fiberG * scaleFactor) * 10) / 10 : undefined,
      sugarG: validated.sugarG !== null ? Math.round((validated.sugarG * scaleFactor) * 10) / 10 : undefined,
      sodiumMg: validated.sodiumMg !== null ? Math.round((validated.sodiumMg * scaleFactor)) : undefined
    };
    
    // Canonical model: totalGrams = quantity * gramsPerUnit
    const computedTotalGrams = finalQuantity * finalServingGrams;
    
    return {
      id: crypto.randomUUID(),
      name: foodDetail.description,
      servingSize: finalServingSize,
      quantidade: finalQuantity,
      ...finalMacros,
      servingGrams: finalServingGrams,
      baseUnit: finalBaseUnit,
      fdcId: fdcId,
      computedTotalGrams,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }
  
  static async searchAndImport(query: string): Promise<FoodItem[]> {
    try {
      const { results: searchResults } = await this.searchFoods(query, 10);
      const importedFoods: FoodItem[] = [];
      
      // Import first 5 results to avoid rate limits
      for (const result of searchResults.slice(0, 5)) {
        try {
          const foodItem = await this.importFoodItem(result.fdcId);
          importedFoods.push(foodItem);
        } catch (error) {
          console.error(`Failed to import food ${result.description}:`, error);
        }
      }
      
      return importedFoods;
    } catch (error) {
      console.error('Failed to search and import foods:', error);
      throw error;
    }
  }
  
  static async getSavedFDAFoods(): Promise<FoodItem[]> {
    try {
      return await db.foodItems
        .where('source')
        .equals('bundled')
        .toArray();
    } catch (error) {
      console.error('Failed to get saved FDA foods:', error);
      return [];
    }
  }
  
  // Ignore list for USDA foods with incomplete data
  private static readonly IGNORED_USDA_FOODS_KEY = 'ignored-usda-foods';
  
  /**
   * Get list of ignored USDA FDC IDs
   */
  static getIgnoredUSDAFoods(): Set<number> {
    try {
      const stored = localStorage.getItem(this.IGNORED_USDA_FOODS_KEY);
      if (!stored) return new Set();
      const ids = JSON.parse(stored) as number[];
      return new Set(ids);
    } catch (error) {
      console.error('Failed to get ignored USDA foods:', error);
      return new Set();
    }
  }
  
  /**
   * Add an USDA food to the ignore list
   */
  static ignoreUSDAFood(fdcId: number): void {
    try {
      const ignored = this.getIgnoredUSDAFoods();
      ignored.add(fdcId);
      localStorage.setItem(this.IGNORED_USDA_FOODS_KEY, JSON.stringify([...ignored]));
      console.log('[USDA] Ignored food:', fdcId);
    } catch (error) {
      console.error('Failed to ignore USDA food:', error);
    }
  }
  
  /**
   * Remove an USDA food from the ignore list
   */
  static unignoreUSDAFood(fdcId: number): void {
    try {
      const ignored = this.getIgnoredUSDAFoods();
      ignored.delete(fdcId);
      localStorage.setItem(this.IGNORED_USDA_FOODS_KEY, JSON.stringify([...ignored]));
    } catch (error) {
      console.error('Failed to unignore USDA food:', error);
    }
  }
  
  /**
   * Check if an USDA food is ignored
   */
  static isUSDAFoodIgnored(fdcId: number): boolean {
    return this.getIgnoredUSDAFoods().has(fdcId);
  }
  
  /**
   * Filter search results to remove ignored foods
   */
  static filterIgnoredFoods(foods: USDFoodSearchResult[]): USDFoodSearchResult[] {
    const ignored = this.getIgnoredUSDAFoods();
    return foods.filter(food => !ignored.has(food.fdcId));
  }
  
  /**
   * Validate USDA food before import (called by UI)
   * Returns validation result without throwing
   */
  static validateUSDAFoodForImport(foodDetail: USDAFoodDetail): {
    validation: NutrientValidationResult;
    macros: MacroNutrients;
  } {
    const macros = this.extractMacros(foodDetail);
    const validation = validateMacros(macros);
    return { validation, macros };
  }
}

export const usdaService = USDAService;
