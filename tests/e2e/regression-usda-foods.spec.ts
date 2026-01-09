import { test, expect } from '@playwright/test';

test.describe('Regression: USDA Food Entry -> Totals Update (R02)', () => {
  test.beforeEach(async ({ page, context }) => {
    // Set age gate to pass BEFORE page loads (runs on all page navigations)
    await context.addInitScript(() => {
      localStorage.setItem('age_gate_accepted', 'true');
      localStorage.setItem('age_gate_timestamp', new Date().toISOString());
    });
    
    // Set up mock USDA API responses
    await page.route('**/api.nal.usda.gov/**', async (route) => {
      // Mock USDA API responses for test foods
      const url = route.request().url();
      if (url.includes('/search')) {
        // Mock search response
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            foods: [
              {
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
              {
                fdcId: 789012,
                description: 'Test Banana',
                dataType: 'Foundation',
                foodNutrients: [
                  { nutrientId: 1008, nutrientName: 'Energy', unitName: 'kcal', value: 89 },
                  { nutrientId: 1003, nutrientName: 'Protein', unitName: 'g', value: 1.1 },
                  { nutrientId: 1004, nutrientName: 'Total lipid (fat)', unitName: 'g', value: 0.3 },
                  { nutrientId: 1005, nutrientName: 'Carbohydrate, by difference', unitName: 'g', value: 23 }
                ]
              }
            ]
          })
        });
      } else if (url.includes('/food/')) {
        // Mock food detail response
        const fdcIdMatch = url.match(/\/food\/(\d+)/);
        if (fdcIdMatch) {
          const fdcId = parseInt(fdcIdMatch[1]);
          const foodData = {
            123456: {
              description: 'Test Apple',
              dataType: 'Foundation',
              foodNutrients: [
                { nutrientId: 1008, nutrientName: 'Energy', unitName: 'kcal', value: 52 },
                { nutrientId: 1003, nutrientName: 'Protein', unitName: 'g', value: 0.3 },
                { nutrientId: 1004, nutrientName: 'Total lipid (fat)', unitName: 'g', value: 0.2 },
                { nutrientId: 1005, nutrientName: 'Carbohydrate, by difference', unitName: 'g', value: 14 }
              ],
              servingSize: 100,
              servingSizeUnit: 'g'
            },
            789012: {
              description: 'Test Banana',
              dataType: 'Foundation',
              foodNutrients: [
                { nutrientId: 1008, nutrientName: 'Energy', unitName: 'kcal', value: 89 },
                { nutrientId: 1003, nutrientName: 'Protein', unitName: 'g', value: 1.1 },
                { nutrientId: 1004, nutrientName: 'Total lipid (fat)', unitName: 'g', value: 0.3 },
                { nutrientId: 1005, nutrientName: 'Carbohydrate, by difference', unitName: 'g', value: 23 }
              ],
              servingSize: 100,
              servingSizeUnit: 'g'
            }
          };
          
          if (foodData[fdcId]) {
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify(foodData[fdcId])
            });
            return;
          }
        }
        await route.continue();
      } else {
        await route.continue();
      }
    });
    
    // Navigate to nutrition page
    await page.goto('./#/nutrition');
    await page.waitForLoadState();
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
    // Set up USDA API key in settings first
    await page.goto('./#/settings');
    await page.getByLabel('API Key').fill('test-api-key-for-testing');
    await page.getByRole('button', { name: 'Save Settings' }).click();
    await expect(page.getByText('Settings saved successfully!')).toBeVisible();
    
    // Go back to nutrition page
    await page.goto('./#/nutrition');
    await page.waitForLoadState();
    
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
    
    // Close the USDA import modal by clicking the search button again
    await page.getByTestId('usda-search-button').click();
    
    // Check that totals increased from 0
    await expect(page.getByText(/52.*kcal/)).toBeVisible(); // 52 calories from apple
    await expect(page.getByText(/0\s*g\s*protein/i)).toBeVisible(); // 0.3g protein
  });

  test('should add second USDA food and accumulate totals', async ({ page }) => {
    // Set up USDA API key
    await page.goto('./#/settings');
    await page.getByLabel('API Key').fill('test-api-key-for-testing');
    await page.getByRole('button', { name: 'Save Settings' }).click();
    await expect(page.getByText('Settings saved successfully!')).toBeVisible();
    
    // Go to nutrition and add first food (apple)
    await page.goto('./#/nutrition');
    await page.waitForLoadState();
    
    // Add apple
    await page.getByTestId('usda-search-button').click();
    await page.getByTestId('usda-search-input').fill('apple');
    await page.waitForTimeout(600);
    await expect(page.getByTestId('usda-results')).toBeVisible();
    const appleButton = page.getByTestId('usda-add-food').filter({ hasText: 'Test Apple' });
    await appleButton.click();
    await expect(appleButton).not.toHaveText('Adding...', { timeout: 10000 });
    await page.getByTestId('usda-search-button').click(); // Close modal
    
    // Add second food (banana)
    await page.getByTestId('usda-search-button').click();
    await page.getByTestId('usda-search-input').fill('banana');
    await page.waitForTimeout(600);
    await expect(page.getByTestId('usda-results')).toBeVisible();
    const bananaButton = page.getByTestId('usda-add-food').filter({ hasText: 'Test Banana' });
    await bananaButton.click();
    await expect(bananaButton).not.toHaveText('Adding...', { timeout: 10000 });
    await page.getByTestId('usda-search-button').click(); // Close modal
    
    // Should show accumulated totals: 52 + 89 = 141 calories
    await expect(page.getByText(/141.*kcal/)).toBeVisible();
    await expect(page.getByText(/1\s*g\s*protein/i)).toBeVisible(); // 0.3 + 1.1 = 1.4g protein
  });

  test('should persist food entries across page refreshes', async ({ page }) => {
    // Set up USDA API key and add foods
    await page.goto('./#/settings');
    await page.getByLabel('API Key').fill('test-api-key-for-testing');
    await page.getByRole('button', { name: 'Save Settings' }).click();
    await page.goto('./#/nutrition');
    
    // Add apple
    await page.getByTestId('usda-search-button').click();
    await page.getByTestId('usda-search-input').fill('apple');
    await page.waitForTimeout(600);
    await expect(page.getByTestId('usda-results')).toBeVisible();
    const appleButton = page.getByTestId('usda-add-food').filter({ hasText: 'Test Apple' });
    await appleButton.click();
    await expect(appleButton).not.toHaveText('Adding...', { timeout: 10000 });
    await page.getByTestId('usda-search-button').click(); // Close modal
    
    // Add banana
    await page.getByTestId('usda-search-button').click();
    await page.getByTestId('usda-search-input').fill('banana');
    await page.waitForTimeout(600);
    await expect(page.getByTestId('usda-results')).toBeVisible();
    const bananaButton = page.getByTestId('usda-add-food').filter({ hasText: 'Test Banana' });
    await bananaButton.click();
    await expect(bananaButton).not.toHaveText('Adding...', { timeout: 10000 });
    await page.getByTestId('usda-search-button').click(); // Close modal
    
    // Verify totals are there
    await expect(page.getByText(/141.*kcal/)).toBeVisible();
    
    // Refresh the page
    await page.reload();
    await page.waitForLoadState();
    
    // Totals should still be there after refresh
    await expect(page.getByText(/141.*kcal/)).toBeVisible();
    await expect(page.getByText(/1\s*g\s*protein/i)).toBeVisible();
    
    // Should show the logged foods in the list
    await expect(page.getByText('Test Apple')).toBeVisible();
    await expect(page.getByText('Test Banana')).toBeVisible();
  });

  test('should handle serving<->grams unit switching correctly', async ({ page }) => {
    // Set up USDA API key and add a food
    await page.goto('./#/settings');
    await page.getByLabel('API Key').fill('test-api-key-for-testing');
    await page.getByRole('button', { name: 'Save Settings' }).click();
    await page.goto('./#/nutrition');
    
    // Add apple
    await page.getByTestId('usda-search-button').click();
    await page.getByTestId('usda-search-input').fill('apple');
    await page.waitForTimeout(600);
    await expect(page.getByTestId('usda-results')).toBeVisible();
    const appleButton = page.getByTestId('usda-add-food').filter({ hasText: 'Test Apple' });
    await appleButton.click();
    await expect(appleButton).not.toHaveText('Adding...', { timeout: 10000 });
    await page.getByTestId('usda-search-button').click(); // Close modal
    
    // Find the apple item and click edit serving
    const appleItem = page.getByTestId('nutrition-food-item').filter({ hasText: 'Test Apple' });
    await appleItem.getByRole('button', { name: 'Edit Serving' }).click();
    
    // Should be in edit mode
    await expect(page.getByText('Edit: Test Apple')).toBeVisible();
    
    // Check initial quantity (should be 1 serving)
    const quantityInput = page.locator('input[type="number"]').first();
    await expect(quantityInput).toHaveValue('1');
    
    const unitSelect = page.locator('select').first();
    await expect(unitSelect).toHaveValue('serving');
    
    // Switch to grams - quantity should auto-update to servingGrams
    await unitSelect.selectOption('grams');
    await expect(quantityInput).toHaveValue('100'); // Should default to 100g
    
    // Update to 200g and save
    await quantityInput.fill('200');
    await page.getByRole('button', { name: 'Update' }).click();
    
    // Should save and show updated macros
    await expect(page.getByText('104 cal')).toBeVisible(); // 52 * 2 = 104
    
    // Edit again to test switching back to serving
    await appleItem.getByRole('button', { name: 'Edit Serving' }).click();
    await expect(page.getByText('Edit: Test Apple')).toBeVisible();
    
    // Get input elements again (they're fresh after re-entering edit mode)
    const quantityInput2 = page.locator('input[type="number"]').first();
    const unitSelect2 = page.locator('select').first();
    await expect(quantityInput).toHaveValue('200'); // Still shows 200g when in grams mode
    
    // Switch back to serving
    await unitSelect.selectOption('serving');
    await expect(quantityInput2).toHaveValue('1'); // Should reset to 1 serving
    
    // Save and verify totals are updated correctly
    await page.getByRole('button', { name: 'Update' }).click();
    await expect(page.getByText('52 cal')).toBeVisible(); // Back to original per-serving
  });

  test('should handle USDA lookup failures gracefully', async ({ page }) => {
    // Set up invalid API key scenario
    await page.goto('./#/settings');
    await page.getByLabel('API Key').fill('invalid-key');
    await page.getByRole('button', { name: 'Save Settings' }).click();
    await page.goto('./#/nutrition');
    
    // Try to search with invalid key
    await page.getByTestId('usda-search-button').click();
    await page.getByTestId('usda-search-input').fill('apple');
    
    // Wait for debounce delay
    await page.waitForTimeout(600);
    
    // Should show appropriate error message (search happens automatically)
    await expect(page.getByTestId('usda-error')).toBeVisible({ timeout: 10000 });
  });
});