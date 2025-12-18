import { settingsRepository } from '@/db/repositories/settings.repository';
import { db } from '@/db';
import { FoodItem } from '@/types';

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
  
  static async searchFoods(query: string, pageSize: number = 20): Promise<USDFoodSearchResult[]> {
    const apiKey = await this.getApiKey();
    if (!apiKey) {
      throw new Error('USDA API key not configured');
    }
    
    const enabled = await this.isUSDALookupsEnabled();
    if (!enabled) {
      throw new Error('USDA lookups are disabled in settings');
    }
    
    try {
      const searchParams = new URLSearchParams({
        query: query,
        pageSize: pageSize.toString(),
        pageNumber: '1',
        sortBy: 'score',
        sortOrder: 'desc',
        api_key: apiKey
      });
      
      const response = await fetch(
        `${this.BASE_URL}/foods/search?${searchParams.toString()}`
      );
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Invalid USDA API key');
        } else if (response.status === 429) {
          throw new Error('USDA API rate limit exceeded');
        }
        throw new Error(`USDA API error: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.foods || [];
    } catch (error) {
      if (error instanceof Error && error.message.includes('Invalid USDA API key')) {
        throw error;
      }
      console.error('Failed to search USDA foods:', error);
      throw new Error('Failed to search USDA foods');
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
    
    const foodItem: FoodItem = {
      id: `usda-${fdcId}`,
      name: foodDetail.description,
      servingSize: this.formatServingSize(foodDetail),
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
  
  private static formatServingSize(foodDetail: USDAFoodDetail): string {
    if (foodDetail.servingSize && foodDetail.servingSizeUnit) {
      return `${foodDetail.servingSize} ${foodDetail.servingSizeUnit}`;
    }
    
    if (foodDetail.householdServingFullText) {
      return foodDetail.householdServingFullText;
    }
    
    return '100 g'; // Default serving size
  }
  
  static async searchAndImport(query: string): Promise<FoodItem[]> {
    try {
      const searchResults = await this.searchFoods(query, 10);
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