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
  foodNutrients: {
    nutrientId: number;
    nutrientName: string;
    unitName: string;
    value: number;
    derivationCode?: string;
    derivationDescription?: string;
  }[];
  servingSize?: number;
  servingSizeUnit?: string;
  householdServingFullText?: string;
}

export class USDAService {
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
    
    const searchParams = new URLSearchParams({
      query: query,
      pageSize: pageSize.toString(),
      pageNumber: '1',
      sortBy: 'score',
      sortOrder: 'desc',
      api_key: apiKey
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
  
  static async importFoodItem(fdcId: number): Promise<FoodItem> {
    const foodDetail = await this.getFoodDetails(fdcId);
    
    // Map USDA nutrient data to our format
    const macroNutrients = this.extractMacroNutrients(foodDetail.foodNutrients);
    
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
  
  private static extractMacroNutrients(nutrients: USDAFoodDetail['foodNutrients']) {
    const getNutrient = (nutrientId: number) => {
      return nutrients.find(n => n.nutrientId === nutrientId)?.value || 0;
    };
    
    return {
      calories: getNutrient(1008), // Energy
      proteinG: getNutrient(1003), // Protein
      carbsG: getNutrient(1005), // Carbohydrate
      fatG: getNutrient(1004), // Total lipid (fat)
      fiberG: getNutrient(1079), // Fiber, total dietary
      sugarG: getNutrient(2000), // Sugars, total
      sodiumMg: getNutrient(1093) // Sodium
    };
  }
  
  private static parseServingInfo(foodDetail: USDAFoodDetail): {
    displaySize: string;
    gramsPerServing: number;
    baseUnit: 'serving' | 'grams';
  } {
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
        // For non-gram units, we assume the nutrient values are per serving
        // gramsPerServing remains as estimated or can be enhanced later
      }
    } else if (foodDetail.householdServingFullText) {
      // Use household serving size
      displaySize = foodDetail.householdServingFullText;
      baseUnit = 'serving';
      // gramsPerServing remains as the USDA nutrient values are per serving
    }
    
    return {
      displaySize,
      gramsPerServing,
      baseUnit
    };
  }
  
  /**
   * Create a FoodLogItem from USDA data with proper macro normalization
   */
  static async createFoodLogItem(fdcId: number, customQuantity: number = 1, customUnit: string = 'serving'): Promise<FoodLogItem> {
    const foodDetail = await this.getFoodDetails(fdcId);
    const macroNutrients = this.extractMacroNutrients(foodDetail.foodNutrients);
    const servingInfo = this.parseServingInfo(foodDetail);
    
    // Calculate the final macros based on the requested quantity/unit
    let scaleFactor = 1;
    let finalServingSize = servingInfo.displaySize;
    let finalQuantity = customQuantity;
    
    if (customUnit === 'grams') {
      // User wants specific grams
      scaleFactor = customQuantity / 100; // USDA macros are typically per 100g
      finalServingSize = `${customQuantity}g`;
      finalQuantity = 1; // Quantity represents 1 unit of the specified grams
    } else {
      // User wants servings
      scaleFactor = customQuantity;
      finalServingSize = `${customQuantity} serving${customQuantity !== 1 ? 's' : ''}`;
    }
    
    // Apply scaling to get the final macro values
    const finalMacros = {
      calories: Math.round(macroNutrients.calories * scaleFactor),
      proteinG: Math.round((macroNutrients.proteinG * scaleFactor) * 10) / 10,
      carbsG: Math.round((macroNutrients.carbsG * scaleFactor) * 10) / 10,
      fatG: Math.round((macroNutrients.fatG * scaleFactor) * 10) / 10,
      fiberG: macroNutrients.fiberG ? Math.round((macroNutrients.fiberG * scaleFactor) * 10) / 10 : 0,
      sugarG: macroNutrients.sugarG ? Math.round((macroNutrients.sugarG * scaleFactor) * 10) / 10 : 0,
      sodiumMg: macroNutrients.sodiumMg ? Math.round((macroNutrients.sodiumMg * scaleFactor)) : 0
    };
    
    return {
      id: crypto.randomUUID(),
      name: foodDetail.description,
      servingSize: finalServingSize,
      quantidade: finalQuantity,
      ...finalMacros,
      servingGrams: customUnit === 'grams' ? customQuantity : servingInfo.gramsPerServing,
      baseUnit: customUnit === 'grams' ? 'grams' : servingInfo.baseUnit,
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
          // Continue with other foods
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