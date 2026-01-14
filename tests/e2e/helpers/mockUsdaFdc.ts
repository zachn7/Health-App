/**
 * USDA Fixture Helper for E2E Tests
 * 
 * Provides reusable mock data and route setup for USDA FoodData Central API calls.
 * Used by regression-usda-foods.spec.ts to create deterministic, stable tests.
 */

import type { Page } from '@playwright/test';

/**
 * Mock USDA food items used across tests
 */
export const MOCK_USDA_FOODS = {
  // Standard foods (passing)
  apple: {
    fdcId: 123456,
    description: 'Test Apple',
    dataType: 'Foundation',
    foodNutrients: [
      { nutrientId: 1008, nutrientName: 'Energy', unitName: 'kcal', value: 52 },
      { nutrientId: 1003, nutrientName: 'Protein', unitName: 'g', value: 0.3 },
      { nutrientId: 1004, nutrientName: 'Total lipid (fat)', unitName: 'g', value: 0.2 },
      { nutrientId: 1005, nutrientName: 'Carbohydrate, by difference', unitName: 'g', value: 14 }
    ]
  },
  
  banana: {
    fdcId: 789012,
    description: 'Test Banana',
    dataType: 'Foundation',
    foodNutrients: [
      { nutrientId: 1008, nutrientName: 'Energy', unitName: 'kcal', value: 89 },
      { nutrientId: 1003, nutrientName: 'Protein', unitName: 'g', value: 1.1 },
      { nutrientId: 1004, nutrientName: 'Total lipid (fat)', unitName: 'g', value: 0.3 },
      { nutrientId: 1005, nutrientName: 'Carbohydrate, by difference', unitName: 'g', value: 23 }
    ]
  },
  
  // 30g serving size test food
   smallPack: {
    fdcId: 999999,
    description: 'Test Small Pack (30g)',
    dataType: 'Branded',
    servingSize: 30,
    servingSizeUnit: 'g',
    labelNutrients: {
      calories: { value: 150 },
      protein: { value: 5 },
      fat: { value: 6 },
      carbohydrates: { value: 18 }
    }
  },
  
  // Inference test foods
   inferCalories: {
    fdcId: 222222,
    description: 'Test Infer Calories',
    dataType: 'Foundation',
    // Missing calories - will be inferred as 280 = 20*4 + 30*4 + 10*9
    foodNutrients: [
      { nutrientId: 1003, nutrientName: 'Protein', unitName: 'g', value: 20 },
      { nutrientId: 1004, nutrientName: 'Total lipid (fat)', unitName: 'g', value: 10 },
      { nutrientId: 1005, nutrientName: 'Carbohydrate, by difference', unitName: 'g', value: 30 }
    ]
  },
  
  inferProtein: {
    fdcId: 333333,
    description: 'Test Infer Protein',
    dataType: 'Foundation',
    // Missing protein - will be inferred as 25g = (500 - 30*4 - 10*9) / 4
    foodNutrients: [
      { nutrientId: 1008, nutrientName: 'Energy', unitName: 'kcal', value: 500 },
      { nutrientId: 1004, nutrientName: 'Total lipid (fat)', unitName: 'g', value: 10 },
      { nutrientId: 1005, nutrientName: 'Carbohydrate, by difference', unitName: 'g', value: 30 }
    ]
  },
  
  // Blocking/incomplete test foods
   incomplete: {
    fdcId: 444444,
    description: 'Test Incomplete Blocked',
    dataType: 'Foundation',
    // Missing fat and carbs - only has calories and protein
    // This should be blocked as it's too incomplete
    foodNutrients: [
      { nutrientId: 1008, nutrientName: 'Energy', unitName: 'kcal', value: 100 },
      { nutrientId: 1003, nutrientName: 'Protein', unitName: 'g', value: 5 }
      // Missing fat and carbs
    ]
  },
  
  // Zero-value food (all zeros are valid - not incomplete)
  water: {
    fdcId: 777777,
    description: 'Test Water (0 fat)',
    dataType: 'Foundation',
    servingSize: 100,
    servingSizeUnit: 'g',
    foodNutrients: [
      { nutrientId: 1008, nutrientName: 'Energy', unitName: 'kcal', value: 0 },
      { nutrientId: 1003, nutrientName: 'Protein', unitName: 'g', value: 0 },
      { nutrientId: 1005, nutrientName: 'Carbohydrate, by difference', unitName: 'g', value: 0 },
      { nutrientId: 1004, nutrientName: 'Total lipid (fat)', unitName: 'g', value: 0 }
    ]
  },
  
  // Query relaxation/prefix test foods
   cheeseCheddar: {
    fdcId: 555555,
    description: 'Cheese, cheddar, shredded',
    dataType: 'Foundation',
    foodNutrients: [
      { nutrientId: 1008, nutrientName: 'Energy', unitName: 'kcal', value: 402 },
      { nutrientId: 1003, nutrientName: 'Protein', unitName: 'g', value: 25 },
      { nutrientId: 1004, nutrientName: 'Total lipid (fat)', unitName: 'g', value: 33 },
      { nutrientId: 1005, nutrientName: 'Carbohydrate', unitName: 'g', value: 1.3 }
    ]
  },
  
  cheesecake: {
    fdcId: 666666,
    description: 'Cheesecake, plain, prepared from recipe',
    dataType: 'Branded',
    servingSize: 100,
    servingSizeUnit: 'g',
    labelNutrients: {
      calories: { value: 321 },
      protein: { value: 6 },
      fat: { value: 11 },
      carbohydrates: { value: 46 }
    }
  },
  
  cheeseSpread: {
    fdcId: 777776,
    description: 'Cheese spread',
    dataType: 'Foundation',
    foodNutrients: [
      { nutrientId: 1008, nutrientName: 'Energy', unitName: 'kcal', value: 350 },
      { nutrientId: 1003, nutrientName: 'Protein', unitName: 'g', value: 17 },
      { nutrientId: 1004, nutrientName: 'Total lipid (fat)', unitName: 'g', value: 29 },
      { nutrientId: 1005, nutrientName: 'Carbohydrate, by difference', unitName: 'g', value: 4.1 }
    ]
  },
  
  creamCheese: {
    fdcId: 888888,
    description: 'Cream cheese, regular',
    dataType: 'Foundation',
    foodNutrients: [
      { nutrientId: 1008, nutrientName: 'Energy', unitName: 'kcal', value: 342 },
      { nutrientId: 1003, nutrientName: 'Protein', unitName: 'g', value: 5.93 },
      { nutrientId: 1004, nutrientName: 'Total lipid (fat)', unitName: 'g', value: 34.4 },
      { nutrientId: 1005, nutrientName: 'Carbohydrate, by difference', unitName: 'g', value: 4.07 }
    ]
  },
  
  // Foundation food with foodPortions - test with 1 cup = 186g
  grapes: {
    fdcId: 1102665,
    description: 'Grapes, raw',
    dataType: 'Foundation',
    foodPortions: [
      {
        id: 239235,
        portionDescription: '1 cup',
        gramWeight: 151.0,
        sequenceNumber: 2,
        modifier: '10205',
        measureUnit: {
          id: 9999,
          name: 'undetermined',
          abbreviation: 'undetermined'
        }
      },
      {
        id: 247739,
        portionDescription: 'NLEA serving',
        gramWeight: 126.0,
        sequenceNumber: 1,
        modifier: '60831',
        measureUnit: {
          id: 9999,
          name: 'undetermined',
          abbreviation: 'undetermined'
        }
      }
    ],
    foodNutrients: [
      { nutrientId: 1008, nutrientName: 'Energy', unitName: 'kcal', value: 69 },
      { nutrientId: 1003, nutrientName: 'Protein', unitName: 'g', value: 0.7 },
      { nutrientId: 1004, nutrientName: 'Total lipid (fat)', unitName: 'g', value: 0.2 },
      { nutrientId: 1005, nutrientName: 'Carbohydrate, by difference', unitName: 'g', value: 18.1 }
    ]
  },
  
  // Foundation food with no portions - should show 'per 100 g'
  appleNoPortions: {
    fdcId: 1111111,
    description: 'Apple, no portions',
    dataType: 'Foundation',
    foodNutrients: [
      { nutrientId: 1008, nutrientName: 'Energy', unitName: 'kcal', value: 52 },
      { nutrientId: 1003, nutrientName: 'Protein', unitName: 'g', value: 0.3 },
      { nutrientId: 1004, nutrientName: 'Total lipid (fat)', unitName: 'g', value: 0.2 },
      { nutrientId: 1005, nutrientName: 'Carbohydrate, by difference', unitName: 'g', value: 14 }
    ]
  },
  
  // Empty search (no results)
  emptySearch: null
} as const;

/**
 * Apply USDA mock routes to a Playwright page
 * 
 * This sets up mocks for:
 * - /foods/search - search endpoint
 * - /food/:fdcId - detail endpoint
 * 
 * @param page - Playwright Page object
 */
export function applyUsdaMocks(page: Page): void {
  page.route('**/api.nal.usda.gov/fdc/v1/foods/search', async (route) => {
    const url = route.request().url;
    const searchParams = new URL(url).searchParams;
    const query = searchParams.get('query')?.toLowerCase() || '';
    const apiKey = searchParams.get('api_key');
    
    // Simulate error if API key is invalid
    if (apiKey === 'invalid-key') {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            message: 'Invalid API Key'
          }
        })
      });
      return;
    }
    
    // Return empty results for nonsense searches (all starting with 'xyz nonexistent food')
    if (query.startsWith('xyz nonexistent food')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          foods: [],
          totalPages: 1,
          currentPage: 1
        })
      });
      return;
    }
    
    // Build list of matching foods based on query
    const foodResults = [
      // Small pack (30g serving)
      (query.includes('small') || query === '' || query.includes('all')) ? MOCK_USDA_FOODS.smallPack : null,
      
      // Apple
      (query.includes('apple') || query === '' || query.includes('all')) ? MOCK_USDA_FOODS.apple : null,
      
      // Banana
      (query.includes('banana') || query === '' || query.includes('all')) ? MOCK_USDA_FOODS.banana : null,
      
      // Inference tests
      (query.includes('infer-cal') || query === '' || query.includes('all')) ? MOCK_USDA_FOODS.inferCalories : null,
      (query.includes('infer-prot') || query === '' || query.includes('all')) ? MOCK_USDA_FOODS.inferProtein : null,
      
      // Blocking/incomplete tests
      (query.includes('incomplete') || query === '' || query.includes('all')) ? MOCK_USDA_FOODS.incomplete : null,
      (query.includes('water') || query.includes('zero') || query === '' || query.includes('all')) ? MOCK_USDA_FOODS.water : null,
      
      // Query relaxation/prefix tests
      (query.includes('chick') || query === '' || query.includes('all')) ? MOCK_USDA_FOODS.cheeseCheddar : null,
      (query.includes('cheese') || query === '' || query.includes('all')) ? MOCK_USDA_FOODS.cheeseCheddar : null,
      (query.includes('cheese')) ? MOCK_USDA_FOODS.cheesecake : null,
      (query.includes('cheese')) ? MOCK_USDA_FOODS.cheeseSpread : null,
      (query.includes('cheese')) ? MOCK_USDA_FOODS.creamCheese : null,
      
      // Food portion tests
      (query.includes('grapes') || query === '' || query.includes('all')) ? MOCK_USDA_FOODS.grapes : null,
      (query.includes('apple-np') || query === '' || query.includes('all')) ? MOCK_USDA_FOODS.appleNoPortions : null,
    ]
    .filter(Boolean);
    
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        foods: foodResults,
        totalPages: 1,
        currentPage: 1
      })
    });
  });
  
  // Mock detail endpoint for each mock food
  const mockFoodIds = [
    MOCK_USDA_FOODS.apple.fdcId,
    MOCK_USDA_FOODS.banana.fdcId,
    MOCK_USDA_FOODS.smallPack.fdcId,
    MOCK_USDA_FOODS.inferCalories.fdcId,
    MOCK_USDA_FOODS.inferProtein.fdcId,
    MOCK_USDA_FOODS.incomplete.fdcId,
    MOCK_USDA_FOODS.water.fdcId,
    MOCK_USDA_FOODS.cheeseCheddar.fdcId,
    MOCK_USDA_FOODS.cheesecake.fdcId,
    MOCK_USDA_FOODS.cheeseSpread.fdcId,
    MOCK_USDA_FOODS.creamCheese.fdcId,
    MOCK_USDA_FOODS.grapes.fdcId,
    MOCK_USDA_FOODS.appleNoPortions.fdcId,
  ];
  
  mockFoodIds.forEach(fdcId => {
    page.route(`**/api.nal.usda.gov/fdc/v1/food/${fdcId}`, async (route) => {
      const food = Object.values(MOCK_USDA_FOODS).find(f => f?.fdcId === fdcId);
      
      if (!food) {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Food not found' })
        });
        return;
      }
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(food)
      });
    });
  });
}

/**
 * Clear USDA mock routes from a Playwright page
 * 
 * @param page - Playwright Page object
 */
export function clearUsdaMocks(page: Page): void {
  page.unrouteAll({ behavior: 'ignoreErrors' });
}