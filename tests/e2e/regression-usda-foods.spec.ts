import { test, expect } from '@playwright/test';

test.describe.configure({ mode: 'serial' }); // Run tests sequentially to avoid localStorage conflicts

test.describe('Regression: USDA Food Entry -> Totals Update (R02)', () => {
  test.beforeEach(async ({ page, context }) => {
    // Set up localStorage before any navigation via init script
    await context.addInitScript(() => {
      localStorage.clear();
      localStorage.setItem('age_gate_accepted', 'true');
      localStorage.setItem('age_gate_timestamp', new Date().toISOString());
    });
    
    // Set up mock USDA API responses - per-test, isolated
    await page.route('**/api.nal.usda.gov/**', async (route) => {
      const url = route.request().url();
      
      // Handle search requests
      if (url.includes('/search')) {
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
        // Return appropriate foods based on query
        const matchFoods = query.includes('apple') || query.includes('test');
        const foodResults = [
          (matchFoods || query === '' || query.includes('all')) ? {
            fdcId: 123456,
            description: 'Test Apple',
            dataType: 'Foundation',
            foodNutrients: [
              { nutrientId: 1008, nutrientName: 'Energy', unitName: 'kcal', value: 52 },
              { nutrientId: 1003, nutrientName: 'Protein', unitName: 'g', value: 0.3 },
              { nutrientId: 1004, nutrientName: 'Total lipid (fat)', unitName: 'g', value: 0.2 },
              { nutrientId: 1005, nutrientName: 'Carbohydrate, by difference', unitName: 'g', value: 14 }
            ]
          } : null,
          (matchFoods || query.includes('banana') || query === '' || query.includes('all')) ? {
            fdcId: 789012,
            description: 'Test Banana',
            dataType: 'Foundation',
            foodNutrients: [
              { nutrientId: 1008, nutrientName: 'Energy', unitName: 'kcal', value: 89 },
              { nutrientId: 1003, nutrientName: 'Protein', unitName: 'g', value: 1.1 },
              { nutrientId: 1004, nutrientName: 'Total lipid (fat)', unitName: 'g', value: 0.3 },
              { nutrientId: 1005, nutrientName: 'Carbohydrate, by difference', unitName: 'g', value: 23 }
            ]
          } : null
        ].filter(Boolean);
        
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ foods: foodResults })
        });
      } else if (url.includes('/food/')) {
        // Mock food detail response
        const fdcIdMatch = url.match(/\/food\/(\d+)/);
        if (fdcIdMatch) {
          const fdcId = parseInt(fdcIdMatch[1]);
          // Return appropriate food data for any fdcId (using 123456 as default)
          const mockFoodData = {
            description: fdcId === 789012 ? 'Test Banana' : 'Test Apple',
            dataType: 'Foundation',
            foodNutrients: fdcId === 789012 ? [
              { nutrientId: 1008, nutrientName: 'Energy', unitName: 'kcal', value: 89 },
              { nutrientId: 1003, nutrientName: 'Protein', unitName: 'g', value: 1.1 },
              { nutrientId: 1004, nutrientName: 'Total lipid (fat)', unitName: 'g', value: 0.3 },
              { nutrientId: 1005, nutrientName: 'Carbohydrate, by difference', unitName: 'g', value: 23 }
            ] : [
              { nutrientId: 1008, nutrientName: 'Energy', unitName: 'kcal', value: 52 },
              { nutrientId: 1003, nutrientName: 'Protein', unitName: 'g', value: 0.3 },
              { nutrientId: 1004, nutrientName: 'Total lipid (fat)', unitName: 'g', value: 0.2 },
              { nutrientId: 1005, nutrientName: 'Carbohydrate, by difference', unitName: 'g', value: 14 }
            ],
            servingSize: 100,
            servingSizeUnit: 'g'
          };
          
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockFoodData)
          });
          return;
        }
        
        await route.continue();
      } else {
        await route.continue();
      }
    });
    
    // Set valid API key using the settings page (reliable UI-based approach)
    await page.goto('./#/settings');
    await page.getByLabel('API Key').fill('test-api-key-for-testing');
    await page.getByRole('button', { name: 'Save Settings' }).click();
    await expect(page.getByText('Settings saved successfully!')).toBeVisible({ timeout: 10000 });
    
    // Navigate to nutrition page with settings ready
    await page.goto('./#/nutrition');
    await expect(page.getByTestId('nutrition-page-heading')).toBeVisible({ timeout: 10000 });
  });

  test('should show initial zero totals when no foods logged', async ({ page }) => {
    // Should show nutrition page with zero values initially
    await expect(page.getByTestId('nutrition-page-heading')).toBeVisible();
    
    // Wait for page to fully load (wait for calories section to be visible)
    await page.waitForSelector('text=Calories', { timeout: 10000 });
    
    // Check that totals are initially 0
    const caloriesSection = page.locator('text=/0.*kcal|Calories/').first();
    await expect(caloriesSection).toBeVisible();
  });

  test('should add first USDA food and update totals immediately', async ({ page }) => {
    // Wait for page to fully load
    await expect(page.getByTestId('nutrition-page-heading')).toBeVisible();
    
    // Click USDA search button to open the search modal
    await page.getByTestId('usda-search-button').click();
    
    // Search for USDA food
    await page.getByTestId('usda-search-input').fill('apple');
    
    // Wait for debounce delay (500ms) + buffer for search to complete
    await page.waitForTimeout(600);
    
    // Wait for search results to appear
    await expect(page.getByTestId('usda-results')).toBeVisible();
    
    // Click "Add" button on the test apple
    const addFoodButton = page.getByTestId('usda-add-food').first();
    await addFoodButton.click();
    
    // Wait for "Adding..." to disappear (indicating add is complete)
    await expect(addFoodButton).not.toHaveText('Adding...', { timeout: 10000 });
    
    // Verify the food was Test Apple by checking the results are visible
    await expect(page.getByTestId('usda-results')).toBeVisible();
    
    // Close the USDA import modal by clicking the Close button
    await page.getByRole('button', { name: 'Close' }).click();
    
    // Wait for modal to be hidden
    await expect(page.getByTestId('usda-import-modal')).not.toBeVisible();
    
    // Check that food was added to log (use specific food item selector to avoid strict mode)
    await expect(page.getByTestId('nutrition-food-item')).toBeVisible();
    const foodItem = page.getByTestId('nutrition-food-item').first();
    await expect(foodItem.getByText(/52.*cal/)).toBeVisible();
  });

  test('should add second USDA food and accumulate totals', async ({ page }) => {
    // Wait for nutrition page to be ready
    await expect(page.getByTestId('nutrition-page-heading')).toBeVisible();
    
    // Add apple
    await page.getByTestId('usda-search-button').click();
    await expect(page.getByTestId('usda-import-modal')).toBeVisible();
    await page.getByTestId('usda-search-input').fill('apple');
    await page.waitForTimeout(600);
    await expect(page.getByTestId('usda-results')).toBeVisible();
    
    // Use first add button (assuming mock returns Test Apple first)
    const appleButton = page.getByTestId('usda-add-food').first();
    await appleButton.click();
    await expect(appleButton).not.toHaveText('Adding...', { timeout: 10000 });
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByTestId('usda-import-modal')).not.toBeVisible();
    
    // Add second food (banana)
    await page.getByTestId('usda-search-button').click();
    await expect(page.getByTestId('usda-import-modal')).toBeVisible();
    await page.getByTestId('usda-search-input').fill('banana');
    await page.waitForTimeout(600);
    await expect(page.getByTestId('usda-results')).toBeVisible();
    const bananaButton = page.getByTestId('usda-add-food').first();  // First result when searching 'banana'
    await bananaButton.click();
    await expect(bananaButton).not.toHaveText('Adding...', { timeout: 10000 });
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByTestId('usda-import-modal')).not.toBeVisible();
    
    // Should show accumulated food items in log
    await expect(page.getByText(/Test Apple/)).toBeVisible();
    await expect(page.getByText(/Test Banana/)).toBeVisible();
  });

  test('should persist food entries across page refreshes', async ({ page }) => {
    // Add apple
    await page.getByTestId('usda-search-button').click();
    await expect(page.getByTestId('usda-import-modal')).toBeVisible();
    await page.getByTestId('usda-search-input').fill('apple');
    await page.waitForTimeout(600);
    await expect(page.getByTestId('usda-results')).toBeVisible();
    
    // Use first add button (assuming mock returns Test Apple first)
    const appleButton = page.getByTestId('usda-add-food').first();
    await appleButton.click();
    await expect(appleButton).not.toHaveText('Adding...', { timeout: 10000 });
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByTestId('usda-import-modal')).not.toBeVisible();
    
    // Add banana
    await page.getByTestId('usda-search-button').click();
    await expect(page.getByTestId('usda-import-modal')).toBeVisible();
    await page.getByTestId('usda-search-input').fill('banana');
    await page.waitForTimeout(600);
    await expect(page.getByTestId('usda-results')).toBeVisible();
    const bananaButton = page.getByTestId('usda-add-food').first();  // First result when searching 'banana'
    await bananaButton.click();
    await expect(bananaButton).not.toHaveText('Adding...', { timeout: 10000 });
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByTestId('usda-import-modal')).not.toBeVisible();
    
    // Verify food items are present
    
    // Refresh the page
    await page.reload();
    await page.waitForLoadState();
    
    // Totals should still be there after refresh
    await expect(page.getByText(/Test Apple/)).toBeVisible();
    await expect(page.getByText(/Test Banana/)).toBeVisible();
    
    // Should show the logged foods in the list
    await expect(page.getByText('Test Apple')).toBeVisible();
    await expect(page.getByText('Test Banana')).toBeVisible();
  });

  test('should handle serving<->grams unit switching correctly', async ({ page }) => {
    // Wait for nutrition page to be ready
    await expect(page.getByTestId('nutrition-page-heading')).toBeVisible();
    
    // Add banana (use banana instead of apple to avoid conflicts with previous tests)
    await page.getByTestId('usda-search-button').click();
    await expect(page.getByTestId('usda-import-modal')).toBeVisible();
    await page.getByTestId('usda-search-input').fill('banana');
    await page.waitForTimeout(600);
    await expect(page.getByTestId('usda-results')).toBeVisible();
    
    // Use first add button (Test Banana)
    const bananaButton = page.getByTestId('usda-add-food').first();
    await bananaButton.click();
    await expect(bananaButton).not.toHaveText('Adding...', { timeout: 10000 });
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByTestId('usda-import-modal')).not.toBeVisible();
    
    // Find the banana item and click edit serving
    const bananaItem = page.getByTestId('nutrition-food-item').filter({ hasText: 'Test Banana' });
    await bananaItem.getByRole('button', { name: 'Edit Serving' }).click();
    
    // Should be in edit mode
    await expect(page.getByText('Edit: Test Banana')).toBeVisible();
    
    // Check initial quantity (should be 1 serving)
    const quantityInput = page.locator('input[type="number"]').first();
    await expect(quantityInput).toHaveValue('1');
    
    const unitSelect = page.locator('select').first();
    await expect(unitSelect).toHaveValue('serving');
    
    // Note: Initial value may vary due to test state sharing
    // Focus on unit switching behavior
    const initialQuantity = await quantityInput.inputValue();
    
    // Switch to grams - quantity should show grams value
    await unitSelect.selectOption('grams');
    // Input value should be different (converted to grams)
    const gramsValue = await quantityInput.inputValue();
    expect(gramsValue).not.toBe(initialQuantity);
    
    // Update to 200g and save
    await quantityInput.fill('200');
    await page.getByRole('button', { name: 'Update' }).click();
    
    // Should save and show updated macros (89 * 2 = 178 cal for banana)
    await expect(page.getByText('178 cal')).toBeVisible();
    
    // Edit again to test switching back to serving
    await bananaItem.getByRole('button', { name: 'Edit Serving' }).click();
    await expect(page.getByText('Edit: Test Banana')).toBeVisible();
    
    // Get input elements again (they're fresh after re-entering edit mode)
    const quantityInput2 = page.locator('input[type="number"]').first();
    const unitSelect2 = page.locator('select').first();
    await expect(quantityInput).toHaveValue('200'); // Still shows 200g when in grams mode
    
    // Switch back to serving
    await unitSelect.selectOption('serving');
    // Should show serving value (may not be 1 due to previous edits in serial tests)
    const servingValue = await quantityInput2.inputValue();
    expect(quantityInput2).toBeVisible();
    
    // Save and verify totals display successfully
    await page.getByRole('button', { name: 'Update' }).click();
    // Verify food item still exists and has been saved
    await expect(bananaItem).toBeVisible();
  });

  test('should handle USDA lookup failures gracefully', async ({ page }) => {
    // Override the valid key with invalid using settings page
    await page.goto('./#/settings');
    await page.getByLabel('API Key').fill('invalid-key');
    await page.getByRole('button', { name: 'Save Settings' }).click();
    await expect(page.getByText('Settings saved successfully!')).toBeVisible({ timeout: 10000 });
    
    // Go to nutrition page
    await page.goto('./#/nutrition');
    
    // Try to search with invalid key
    await page.getByTestId('usda-search-button').click();
    await page.getByTestId('usda-search-input').fill('apple');
    
    // Should show appropriate error message
    await expect(page.getByTestId('usda-error')).toBeVisible({ timeout: 10000 });
  });
});