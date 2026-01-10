import { settingsRepository } from '@/db/repositories/settings.repository';
import { db } from '@/db';
import { FoodItem, FoodLogItem } from '@/types';
import Fuse from 'fuse.js';
import { normalizeSearchTerm } from '@/lib/search/normalize';

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
}

export interface MacroNutrients {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
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
    return {
      calories: Math.round(ln.calories?.value || 0),
      proteinG: Math.round((ln.protein?.value || 0) * 10) / 10,
      carbsG: Math.round((ln.carbohydrates?.value || 0) * 10) / 10,
      fatG: Math.round((ln.fat?.value || 0) * 10) / 10,
      fiberG: ln.fiber?.value ? Math.round(ln.fiber.value * 10) / 10 : undefined,
      sugarG: ln.sugars?.value ? Math.round(ln.sugars.value * 10) / 10 : undefined,
      sodiumMg: ln.sodium?.value ? Math.round(ln.sodium.value) : undefined,
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
        calories: Math.round(calories || 0),
        proteinG: Math.round((proteinG || 0) * 10) / 10,
        carbsG: Math.round((carbsG || 0) * 10) / 10,
        fatG: Math.round((fatG || 0) * 10) / 10,
        basis: 'per_100g' as const
      };
    }
  }
  
  return null;
}

class USDAService {
  private static readonly BASE_URL = 'https://api.nal.usda.gov/fdc/v1';
  
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
    
    const url = `${this.BASE_URL}/foods/search?${searchParams.toString()}`;
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
        const normalizedQuery = normalizeSearchTerm(query);
        console.log('[USDA] Reranking', foods.length, 'results for query:', normalizedQuery);
        
        const fuseOptions = {
          keys: [
            { name: 'description', weight: 2.0 },  // Food name is most important
            { name: 'brandOwner', weight: 1.0 },   // Brand is secondary
            { name: 'foodCategory', weight: 0.5 }  // Category is tertiary
          ],
          threshold: 0.4,  // Permissive for partial matches
          minMatchCharLength: 2,
          ignoreLocation: true,
          includeScore: true
        };
        
        const fuse = new Fuse(foods, fuseOptions);
        const reranked = fuse.search(normalizedQuery);
        
        console.log('[USDA] Reranked to', reranked.length, 'results');
        foods = reranked.map(r => r.item);
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
        `${this.BASE_URL}/food/${fdcId}?${searchParams.toString()}`
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
   */
  private static extractMacros(foodDetail: USDAFoodDetail): MacroNutrients {
    const emptyResult: MacroNutrients = {
      calories: 0,
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
      fiberG: undefined,
      sugarG: undefined,
      sodiumMg: undefined,
      basis: 'per_serving'
    };

    // Try labelNutrients first (Branded foods - per serving)
    if (foodDetail.labelNutrients) {
      const ln = foodDetail.labelNutrients;
      const hasData = ln.calories?.value || ln.protein?.value || ln.fat?.value || ln.carbohydrates?.value;
      
      if (hasData) {
        return {
          calories: Math.round(ln.calories?.value || 0),
          proteinG: Math.round((ln.protein?.value || 0) * 10) / 10,
          carbsG: Math.round((ln.carbohydrates?.value || 0) * 10) / 10,
          fatG: Math.round((ln.fat?.value || 0) * 10) / 10,
          fiberG: ln.fiber?.value ? Math.round(ln.fiber.value * 10) / 10 : undefined,
          sugarG: ln.sugars?.value ? Math.round(ln.sugars.value * 10) / 10 : undefined,
          sodiumMg: ln.sodium?.value ? Math.round(ln.sodium.value) : undefined,
          basis: 'per_serving'
        };
      }
    }

    // Fallback to foodNutrients (Foundation/SR foods - typically per 100g)
    if (foodDetail.foodNutrients && foodDetail.foodNutrients.length > 0) {
      const getNutrientValue = (nutrientNumber: number): number | undefined => {
        const nutrient = foodDetail.foodNutrients!.find(n => 
          (n as any).nutrientNumber === nutrientNumber || n.nutrientId === nutrientNumber
        );
        return nutrient?.value;
      };

      const calories = getNutrientValue(1008); // Energy
      const proteinG = getNutrientValue(1003); // Protein
      const fatG = getNutrientValue(1004); // Total lipid (fat)
      const carbsG = getNutrientValue(1005); // Carbohydrate
      const fiberG = getNutrientValue(1079); // Fiber, total dietary
      const sugarG = getNutrientValue(2000); // Sugars, total
      const sodiumMg = getNutrientValue(1093); // Sodium

      const hasAnyMacro = calories !== undefined || proteinG !== undefined || 
                          fatG !== undefined || carbsG !== undefined;

      if (hasAnyMacro) {
        return {
          calories: Math.round(calories || 0),
          proteinG: Math.round((proteinG || 0) * 10) / 10,
          carbsG: Math.round((carbsG || 0) * 10) / 10,
          fatG: Math.round((fatG || 0) * 10) / 10,
          fiberG: fiberG !== undefined ? Math.round(fiberG * 10) / 10 : undefined,
          sugarG: sugarG !== undefined ? Math.round(sugarG * 10) / 10 : undefined,
          sodiumMg: sodiumMg !== undefined ? Math.round(sodiumMg) : undefined,
          basis: 'per_100g' // Foundation/SR foods are typically per 100g
        };
      }
    }

    return emptyResult;
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
    
    // Extract macros using the robust method
    const macroNutrients = this.extractMacros(foodDetail);
    
    // Extract serving size information
    const servingInfo = this.parseServingInfo(foodDetail);
    
    const foodItem: FoodItem = {
      id: `usda-${fdcId}`,
      name: foodDetail.description,
      servingSize: servingInfo.displaySize,
      calories: macroNutrients.calories,
      proteinG: macroNutrients.proteinG,
      carbsG: macroNutrients.carbsG,
      fatG: macroNutrients.fatG,
      fiberG: macroNutrients.fiberG,
      sugarG: macroNutrients.sugarG,
      sodiumMg: macroNutrients.sodiumMg,
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
    const macroNutrients = this.extractMacros(foodDetail);
    const servingInfo = this.parseServingInfo(foodDetail);
    
    // Normalize customUnit to 'serving' or 'grams'
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
      if (macroNutrients.basis === 'per_100g') {
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
      if (macroNutrients.basis === 'per_100g') {
        finalServingGrams = 100; // 1 serving = 100g for Foundation foods
      } else {
        // For branded foods (per_serving), use the actual serving grams
        finalServingGrams = servingInfo.gramsPerServing;
      }
    }
    
    // Apply scaling to get the final macro values
    const finalMacros = {
      calories: Math.round(macroNutrients.calories * scaleFactor),
      proteinG: Math.round((macroNutrients.proteinG * scaleFactor) * 10) / 10,
      carbsG: Math.round((macroNutrients.carbsG * scaleFactor) * 10) / 10,
      fatG: Math.round((macroNutrients.fatG * scaleFactor) * 10) / 10,
      fiberG: macroNutrients.fiberG !== undefined ? Math.round((macroNutrients.fiberG * scaleFactor) * 10) / 10 : undefined,
      sugarG: macroNutrients.sugarG !== undefined ? Math.round((macroNutrients.sugarG * scaleFactor) * 10) / 10 : undefined,
      sodiumMg: macroNutrients.sodiumMg !== undefined ? Math.round((macroNutrients.sodiumMg * scaleFactor)) : undefined
    };
    
    // Validate macros using the new validation system
    const validation = validateMacros(finalMacros);
    
    if (validation.recommendedAction === 'skip') {
      throw new Error(
        'This USDA food item has incomplete nutrition data. ' +
        'Missing: ' + (validation.missingMacros.join(', ') || 'all macros') + '. ' +
        'Please try another food or add as a manual item.'
      );
    }
    
    // If we can estimate, let's do it safely
    let final = finalMacros;
    if (validation.recommendedAction === 'estimate') {
      const estimated = estimateMissingMacro({
        calories: finalMacros.calories,
        proteinG: finalMacros.proteinG,
        carbsG: finalMacros.carbsG,
        fatG: finalMacros.fatG
      });
      final = { ...final, ...estimated };
      console.log('[USDA] Estimated missing macro for', foodDetail.description, ':', estimated);
    }
    
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
