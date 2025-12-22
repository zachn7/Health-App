import { test, expect } from '@playwright/test';

test.describe('Regression: USDA Food Entry -> Totals Update (R02)', () => {
  test.beforeEach(async ({ page }) => {
    // Start fresh and set up test environment
    await page.goto('about:blank');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
      // Set age gate to pass
      localStorage.setItem('age_gate_accepted', 'true');
      localStorage.setItem('age_gate_timestamp', new Date().toISOString());
    });
    
    // Set up a mock USDA API key for testing
    await page.route('**/fdc.nal.usda.gov/**', async (route) => {
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
    await expect(page.getByText('Nutrition')).toBeVisible();
    
    // Check that totals are initially 0 or not displayed
    const calorieText = await page.locator('text=kcal').first().textContent();
    expect(calorieText).toContain('0');
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
    
    // Click to add food
    await page.getByRole('button', { name: /Add Food|Log Food/ }).click();
    
    // Search for USDA food
    await page.getByPlaceholder(/Search foods|Enter food name/).fill('apple');
    await page.getByRole('button', { name: 'Search' }).click();
    
    // Wait for search results and select the test apple
    await expect(page.getByText('Test Apple')).toBeVisible();
    await page.getByText('Test Apple').click();
    
    // Enter amount and log it
    await page.getByPlaceholder(/Amount|Quantity/).fill('1');
    await page.getByRole('button', { name: 'Log Food' }).click();
    
    // Should show success and update totals
    await expect(page.getByText(/Food logged|Added successfully/)).toBeVisible();
    
    // Check that totals increased from 0
    await expect(page.getByText(/52.*kcal/)).toBeVisible(); // 52 calories from apple
    await expect(page.getByText(/0.3.*protein/i)).toBeVisible(); // 0.3g protein
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
    
    await page.getByRole('button', { name: /Add Food|Log Food/ }).click();
    await page.getByPlaceholder(/Search foods|Enter food name/).fill('apple');
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page.getByText('Test Apple')).toBeVisible();
    await page.getByText('Test Apple').click();
    await page.getByPlaceholder(/Amount|Quantity/).fill('1');
    await page.getByRole('button', { name: 'Log Food' }).click();
    await expect(page.getByText(/Food logged/)).toBeVisible();
    
    // Add second food (banana)
    await page.getByRole('button', { name: /Add Food|Log Food/ }).click();
    await page.getByPlaceholder(/Search foods|Enter food name/).fill('banana');
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page.getByText('Test Banana')).toBeVisible();
    await page.getByText('Test Banana').click();
    await page.getByPlaceholder(/Amount|Quantity/).fill('1');
    await page.getByRole('button', { name: 'Log Food' }).click();
    await expect(page.getByText(/Food logged/)).toBeVisible();
    
    // Should show accumulated totals: 52 + 89 = 141 calories
    await expect(page.getByText(/141.*kcal/)).toBeVisible();
    await expect(page.getByText(/1.4.*protein/i)).toBeVisible(); // 0.3 + 1.1 = 1.4g protein
  });

  test('should persist food entries across page refreshes', async ({ page }) => {
    // Set up USDA API key and add foods
    await page.goto('./#/settings');
    await page.getByLabel('API Key').fill('test-api-key-for-testing');
    await page.getByRole('button', { name: 'Save Settings' }).click();
    await page.goto('./#/nutrition');
    
    // Add apple
    await page.getByRole('button', { name: /Add Food|Log Food/ }).click();
    await page.getByPlaceholder(/Search foods|Enter food name/).fill('apple');
    await page.getByRole('button', { name: 'Search' }).click();
    await page.getByText('Test Apple').click();
    await page.getByPlaceholder(/Amount|Quantity/).fill('1');
    await page.getByRole('button', { name: 'Log Food' }).click();
    
    // Add banana
    await page.getByRole('button', { name: /Add Food|Log Food/ }).click();
    await page.getByPlaceholder(/Search foods|Enter food name/).fill('banana');
    await page.getByRole('button', { name: 'Search' }).click();
    await page.getByText('Test Banana').click();
    await page.getByPlaceholder(/Amount|Quantity/).fill('1');
    await page.getByRole('button', { name: 'Log Food' }).click();
    
    // Verify totals are there
    await expect(page.getByText(/141.*kcal/)).toBeVisible();
    
    // Refresh the page
    await page.reload();
    await page.waitForLoadState();
    
    // Totals should still be there after refresh
    await expect(page.getByText(/141.*kcal/)).toBeVisible();
    await expect(page.getByText(/1.4.*protein/i)).toBeVisible();
    
    // Should show the logged foods in the list
    await expect(page.getByText('Test Apple')).toBeVisible();
    await expect(page.getByText('Test Banana')).toBeVisible();
  });

  test('should handle USDA lookup failures gracefully', async ({ page }) => {
    // Set up invalid API key scenario
    await page.goto('./#/settings');
    await page.getByLabel('API Key').fill('invalid-key');
    await page.getByRole('button', { name: 'Save Settings' }).click();
    await page.goto('./#/nutrition');
    
    // Try to search with invalid key
    await page.getByRole('button', { name: /Add Food|Log Food/ }).click();
    await page.getByPlaceholder(/Search foods|Enter food name/).fill('apple');
    await page.getByRole('button', { name: 'Search' }).click();
    
    // Should show appropriate error message
    await expect(page.getByText(/API.*error|lookup.*failed|invalid.*key/i)).toBeVisible({ timeout: 10000 });
  });
});