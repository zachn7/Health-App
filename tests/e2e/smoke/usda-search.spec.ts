import { test, expect } from '@playwright/test';

test.describe('Smoke: USDA Search with Mocked Response', () => {
  test.beforeEach(async ({ page, context }) => {
    // Set up age gate before navigating
    await context.addInitScript(() => {
      localStorage.setItem('age_gate_accepted', 'true');
      localStorage.setItem('onboarding_completed', 'true');
    });
    
    // Mock USDA API responses - DO NOT require real API key in CI
    await page.route('**/api.nal.usda.gov/fdc/v1/**', async (route) => {
      const url = route.request().url();
      
      if (url.includes('/foods/search')) {
        const searchQuery = new URL(url).searchParams.get('query');
        
        // Return empty results for nonsense searches
        if (searchQuery === 'xyz nonexistent food 12345') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              foods: [],
              totalPages: 0,
              currentPage: 1
            })
          });
          return;
        }
        
        // Mock search response with realistic food data
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            foods: [
              {
                fdcId: 170967,
                description: 'Chicken, broilers or fryers, breast, meat only, cooked, roasted',
                dataType: 'Foundation',
                gtinUpc: undefined,
                publishedDate: '2019-04-01',
                brandOwner: undefined,
                ingredients: undefined,
                foodCategory: 'Poultry Products',
                score: 987.5
              },
              {
                fdcId: 170968,
                description: 'Chicken, broilers or fryers, breast, meat and skin, cooked, roasted',
                dataType: 'Foundation',
                gtinUpc: undefined,
                publishedDate: '2019-04-01',
                brandOwner: undefined,
                ingredients: undefined,
                foodCategory: 'Poultry Products',
                score: 945.2
              }
            ],
            totalPages: 1,
            currentPage: 1
          })
        });
      } else if (url.includes('/food/')) {
        // Mock food details response
        const fdcId = url.match(/\/food\/(\d+)/)?.[1];
        
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            fdcId: parseInt(fdcId || '0'),
            description: fdcId === '170967' 
              ? 'Chicken, broilers or fryers, breast, meat only, cooked, roasted'
              : 'Chicken, broilers or fryers, breast, meat and skin, cooked, roasted',
            dataType: 'Foundation',
            publishedDate: '2019-04-01',
            brandOwner: undefined,
            ingredients: undefined,
            foodCategory: 'Poultry Products',
            servingSize: 100,
            servingSizeUnit: 'g',
            foodNutrients: [
              { nutrientId: 1008, nutrientName: 'Energy', unitName: 'kcal', value: 165 },
              { nutrientId: 1003, nutrientName: 'Protein', unitName: 'g', value: 31.0 },
              { nutrientId: 1004, nutrientName: 'Total lipid (fat)', unitName: 'g', value: 3.6 },
              { nutrientId: 1005, nutrientName: 'Carbohydrate, by difference', unitName: 'g', value: 0 },
              { nutrientId: 1079, nutrientName: 'Fiber, total dietary', unitName: 'g', value: 0 },
              { nutrientId: 2000, nutrientName: 'Sugars, total including NLEA', unitName: 'g', value: 0 },
              { nutrientId: 1093, nutrientName: 'Sodium, Na', unitName: 'mg', value: 74 }
            ]
          })
        });
      } else {
        await route.continue();
      }
    });
    
    // Set up a mock API key in settings
    await page.goto('./#/settings');
    await page.getByLabel('API Key').fill('mock-api-key-for-ci-testing');
    await page.getByRole('button', { name: /Save Settings/i }).click();
    
    // Wait for save confirmation - use first() to handle strict mode
    await expect(page.getByText(/Settings saved|USDA lookups are enabled/i).first()).toBeVisible({ timeout: 5000 });
    
    // Navigate to nutrition page
    await page.goto('./#/nutrition');
    await page.waitForLoadState('networkidle');
  });

  test('should show USDA search button when API key is configured', async ({ page }) => {
    // Should see the USDA search button
    await expect(page.getByTestId('usda-search-button')).toBeVisible();
  });

  test('should search USDA database with debounced typing and show results', async ({ page }) => {
    // Open USDA import dialog
    await page.getByTestId('usda-search-button').click();
    await expect(page.getByText('Search USDA FoodData Central')).toBeVisible();
    
    // Set up network wait BEFORE typing to ensure we catch the request
    const searchResponse = page.waitForResponse(
      response => response.url().includes('/foods/search') && response.status() === 200
    );
    
    // Type search query - debounced search should trigger automatically
    const searchInput = page.getByTestId('usda-search-input');
    await searchInput.fill('chicken');
    
    // Wait for the network response
    await searchResponse;
    
    // Wait for debounce delay and DOM update
    await page.waitForTimeout(600); // 500ms debounce + buffer
    
    // Should show search results container
    const resultsContainer = page.getByTestId('usda-results');
    await expect(resultsContainer).toBeVisible({ timeout: 10000 });
    
    // Verify result count header
    await expect(page.getByText('Search Results (2):')).toBeVisible();
    
    // Verify both chicken items are displayed using testids
    const resultRows = page.getByTestId('usda-result-row');
    await expect(resultRows).toHaveCount(2);
    
    // Verify specific food descriptions
    await expect(page.getByText('Chicken, broilers or fryers, breast, meat only, cooked, roasted')).toBeVisible();
    await expect(page.getByText('Chicken, broilers or fryers, breast, meat and skin, cooked, roasted')).toBeVisible();
    
    // Verify food category is shown
    await expect(page.getByText('Poultry Products').first()).toBeVisible();
  });

  test('should add USDA food to nutrition log with non-zero macros', async ({ page }) => {
    // Open USDA import dialog
    await page.getByTestId('usda-search-button').click();
    
    // Set up network wait
    const searchResponse = page.waitForResponse(
      response => response.url().includes('/foods/search') && response.status() === 200
    );
    
    // Search for food
    await page.getByTestId('usda-search-input').fill('chicken');
    await searchResponse;
    await page.waitForTimeout(600);
    
    // Wait for results to appear
    await expect(page.getByTestId('usda-results')).toBeVisible({ timeout: 10000 });
    
    // Set up detail response wait
    const detailResponse = page.waitForResponse(
      response => response.url().includes('/food/170967') && response.status() === 200
    );
    
    // Get initial count of nutrition log items using stable testids
    const nutritionLogList = page.getByTestId('nutrition-log-list');
    const initialItemsCount = await nutritionLogList.getByTestId('nutrition-food-item').count();
    
    // Click "Add" button on first result using testid
    const addButton = page.getByTestId('usda-add-food').first();
    await addButton.click();
    
    // Wait for detail API call to complete
    await detailResponse;
    
    // Wait for "Adding..." to disappear (indicating add is complete)
    await expect(addButton.getByText('Adding...')).not.toBeVisible({ timeout: 10000 });
    
    // Wait a bit for the UI to update
    await page.waitForTimeout(500);
    
    // Close the USDA import modal by clicking the search button again (toggles it closed)
    await page.getByTestId('usda-search-button').click();
    
    // Nutrition log list should now be visible
    await expect(nutritionLogList).toBeVisible({ timeout: 5000 });
    
    // Count nutrition log items using stable testids - count should have increased by 1
    const nutritionLogItems = nutritionLogList.getByTestId('nutrition-food-item');
    await expect(nutritionLogItems).toHaveCount(initialItemsCount + 1, { timeout: 10000 });
    
    // Verify the last added item has the expected name
    const lastItem = nutritionLogItems.last();
    await expect(lastItem.getByTestId('nutrition-log-item-name')).toHaveText(
      'Chicken, broilers or fryers, breast, meat only, cooked, roasted'
    );
    
    // Verify the added item has non-zero macros (mocked response should include them)
    await expect(lastItem.getByTestId('nutrition-log-item-macros')).toBeVisible();
    
    // Check that calories are not '0' and not empty
    const calories = lastItem.getByTestId('food-calories');
    await expect(calories).not.toHaveText('');
    await expect(calories).not.toHaveText('0');
    
    // Check that protein is not '0' and not empty
    const protein = lastItem.getByTestId('food-protein');
    await expect(protein).not.toHaveText('');
    await expect(protein).not.toHaveText('0');
    
    // Check that other macros are present
    await expect(lastItem.getByTestId('food-carbs')).toBeVisible();
    await expect(lastItem.getByTestId('food-fat')).toBeVisible();
  });

  test('should add multiple foods back-to-back without hanging', async ({ page }) => {
    // Open USDA import dialog
    await page.getByTestId('usda-search-button').click();
    
    // Set up network wait
    const searchResponse = page.waitForResponse(
      response => response.url().includes('/foods/search') && response.status() === 200
    );
    
    // Search for food
    await page.getByTestId('usda-search-input').fill('chicken');
    await searchResponse;
    await page.waitForTimeout(600);
    
    // Wait for results to appear
    await expect(page.getByTestId('usda-results')).toBeVisible({ timeout: 10000 });
    
    // Get initial count of nutrition log items
    const nutritionLogList = page.getByTestId('nutrition-log-list');
    const initialItemsCount = await nutritionLogList.getByTestId('nutrition-food-item').count();
    
    // Set up detail response waits for both foods
    const detailResponse1 = page.waitForResponse(
      response => response.url().includes('/food/170967') && response.status() === 200
    );
    const detailResponse2 = page.waitForResponse(
      response => response.url().includes('/food/170968') && response.status() === 200
    );
    
    // Click "Add" on both foods quickly (within 500ms)
    const addButton1 = page.getByTestId('usda-add-food').nth(0);
    const addButton2 = page.getByTestId('usda-add-food').nth(1);
    
    await addButton1.click();
    // Add second food quickly without waiting for first to complete
    await addButton2.click();
    
    // Wait for both detail API calls to complete
    await Promise.all([detailResponse1, detailResponse2]);
    
    // Wait for both "Adding..." to disappear
    await expect(addButton1.getByText('Adding...')).not.toBeVisible({ timeout: 10000 });
    await expect(addButton2.getByText('Adding...')).not.toBeVisible({ timeout: 10000 });
    
    // Close the USDA import modal
    await page.getByTestId('usda-search-button').click();
    await page.waitForTimeout(500);
    
    // Count nutrition log items - should have increased by 2
    const nutritionLogItems = nutritionLogList.getByTestId('nutrition-food-item');
    await expect(nutritionLogItems).toHaveCount(initialItemsCount + 2, { timeout: 10000 });
    
    // Verify both added items have non-zero macros
    const items = nutritionLogItems.all();
    for (const item of await items) {
      await expect(item.getByTestId('food-calories')).not.toHaveText('0');
      await expect(item.getByTestId('food-protein')).not.toHaveText('0');
    }
  });

  test('should display error when search fails', async ({ page }) => {
    // Unroute the previous mock and set up a failing one
    await page.unroute('**/api.nal.usda.gov/fdc/v1/**');
    await page.route('**/api.nal.usda.gov/fdc/v1/**', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Invalid API Key' })
      });
    });
    
    // Re-navigate to refresh the page state
    await page.goto('./#/nutrition');
    await page.waitForLoadState('networkidle');
    
    // Open USDA import dialog
    await page.getByTestId('usda-search-button').click();
    
    // Set up network wait for error response
    const searchResponse = page.waitForResponse(
      response => response.url().includes('/foods/search') && response.status() === 401
    );
    
    // Search for food
    await page.getByTestId('usda-search-input').fill('chicken');
    await searchResponse;
    await page.waitForTimeout(600);
    
    // Should show error message using testid
    const errorElement = page.getByTestId('usda-error');
    await expect(errorElement).toBeVisible({ timeout: 10000 });
    await expect(errorElement.getByText(/Invalid USDA API key/i)).toBeVisible();
  });

  test('should show no results message for empty search', async ({ page }) => {
    // Open USDA import dialog
    await page.getByTestId('usda-search-button').click();
    
    // Set up network wait
    const searchResponse = page.waitForResponse(
      response => response.url().includes('/foods/search') && response.status() === 200
    );
    
    // Search for something that returns no results (already mocked to return empty array)
    await page.getByTestId('usda-search-input').fill('xyz nonexistent food 12345');
    await searchResponse;
    await page.waitForTimeout(600);
    
    // Should show no results message using testid
    const noResultsElement = page.getByTestId('usda-no-results');
    await expect(noResultsElement).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/No results found/i)).toBeVisible();
  });
});
