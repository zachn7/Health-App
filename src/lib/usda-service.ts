import { settingsRepository } from '@/db/repositories/settings.repository';
import { db } from '@/db';
import { FoodItem, FoodLogItem } from '@/types';

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
    pageSize: number = 20
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
      const foods = data.foods || [];
      diagnostics.resultCount = foods.length;
      
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
   */
  static async createFoodLogItem(fdcId: number, customQuantity: number = 1, customUnit: string = 'serving'): Promise<FoodLogItem> {
    const foodDetail = await this.getFoodDetails(fdcId);
    const macroNutrients = this.extractMacros(foodDetail);
    const servingInfo = this.parseServingInfo(foodDetail);
    
    // Calculate the final macros based on the requested quantity/unit
    let scaleFactor = 1;
    let finalServingSize = servingInfo.displaySize;
    let finalQuantity = customQuantity;
    let finalServingGrams = servingInfo.gramsPerServing;
    let finalBaseUnit = servingInfo.baseUnit;
    
    if (customUnit === 'grams') {
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
      // User wants servings
      scaleFactor = customQuantity;
      finalServingSize = `${customQuantity} serving${customQuantity !== 1 ? 's' : ''}`;
      // If macro basis is per 100g and we're using servings, we need to account for that
      if (macroNutrients.basis === 'per_100g' && customQuantity !== 1) {
        // Macros are per 100g, but user wants X servings
        // Assume 1 serving = the default serving size (100g for Foundation/SR)
        scaleFactor = customQuantity;
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
    
    return {
      id: crypto.randomUUID(),
      name: foodDetail.description,
      servingSize: finalServingSize,
      quantidade: finalQuantity,
      ...finalMacros,
      servingGrams: finalServingGrams,
      baseUnit: finalBaseUnit,
      fdcId: fdcId
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
}

export const usdaService = USDAService;
