import { test, expect } from '@playwright/test';

test.describe('Smoke: USDA Search with Mocked Response', () => {
  test.beforeEach(async ({ page, context }) => {
    // Set up age gate before navigating
    await context.addInitScript(() => {
      localStorage.setItem('age_gate_accepted', 'true');
      localStorage.setItem('onboarding_completed', 'true');
    });
    
    // Mock USDA API responses - DO NOT require real API key in CI
    await page.route('**/fdc.nal.usda.gov/**', async (route) => {
      const url = route.request().url();
      
      if (url.includes('/search')) {
        // Mock search response with realistic food data
        const searchQuery = new URL(url).searchParams.get('query');
        
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
    await expect(page.getByRole('button', { name: 'Search USDA Database' })).toBeVisible();
  });

  test('should search USDA database with debounced typing and show results', async ({ page }) => {
    // Open USDA import dialog
    await page.getByRole('button', { name: 'Search USDA Database' }).click();
    await expect(page.getByText('Search USDA FoodData Central')).toBeVisible();
    
    // Type search query - debounced search should trigger automatically
    const searchInput = page.getByPlaceholder('Type to search foods');
    await searchInput.fill('chicken');
    
    // Wait for loading indicator to appear and disappear
    await expect(page.getByText('Searching...')).toBeVisible();
    await expect(page.getByText('Searching...')).toBeHidden({ timeout: 10000 });
    
    // Should show search results with our mocked data
    await expect(page.getByText('Search Results (2):')).toBeVisible();
    
    // Verify both chicken items are displayed
    await expect(page.getByText('Chicken, broilers or fryers, breast, meat only, cooked, roasted')).toBeVisible();
    await expect(page.getByText('Chicken, broilers or fryers, breast, meat and skin, cooked, roasted')).toBeVisible();
    
    // Verify food category is shown
    await expect(page.getByText('Poultry Products')).toBeVisible({ timeout: 5000 }).or(
      await expect(page.locator('.space-y-2').getByText('Poultry Products')).toBeVisible()
    );
  });

  test('should add USDA food to nutrition log', async ({ page }) => {
    // Open USDA import dialog
    await page.getByRole('button', { name: 'Search USDA Database' }).click();
    
    // Search for food
    await page.getByPlaceholder('Type to search foods').fill('chicken');
    await expect(page.getByText('Searching...')).toBeVisible();
    await expect(page.getByText('Searching...')).toBeHidden({ timeout: 10000 });
    
    // Click "Add" button on first result
    const addButton = page.locator('.p-3').filter({ hasText: 'Chicken, broilers or fryers' }).getByRole('button', { name: 'Add' });
    await addButton.click();
    
    // Should show importing state
    await expect(page.getByText('Importing...')).toBeVisible();
    await expect(page.getByText('Importing...')).toBeHidden({ timeout: 10000 });
    
    // Food should be added to the log
    await expect(page.getByText('Chicken, broilers or fryers, breast, meat only, cooked, roasted')).toBeVisible();
    
    // Should show macros in the added food (165 cal based on mock data)
    await expect(page.getByText(/165.*cal/i)).toBeVisible();
    await expect(page.getByText(/31.*protein/i)).toBeVisible();
  });

  test('should display error when search fails', async ({ page }) => {
    // Unroute the previous mock and set up a failing one
    await page.unroute('**/fdc.nal.usda.gov/**');
    await page.route('**/fdc.nal.usda.gov/**', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Invalid API Key' })
      });
    });
    
    // Open USDA import dialog
    await page.getByRole('button', { name: 'Search USDA Database' }).click();
    
    // Search for food
    await page.getByPlaceholder('Type to search foods').fill('chicken');
    await expect(page.getByText('Searching...')).toBeVisible();
    await expect(page.getByText('Searching...')).toBeHidden({ timeout: 10000 });
    
    // Should show error message
    await expect(page.getByText(/Invalid USDA API key|Search Error/i)).toBeVisible();
  });

  test('should show no results message for empty search', async ({ page }) => {
    // Open USDA import dialog
    await page.getByRole('button', { name: 'Search USDA Database' }).click();
    
    // Set up mock for empty results
    await page.route('**/fdc.nal.usda.gov/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/search')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ foods: [] })
        });
      } else {
        await route.continue();
      }
    });
    
    // Search for something that returns no results
    await page.getByPlaceholder('Type to search foods').fill('xyz nonexistent food 12345');
    await expect(page.getByText('Searching...')).toBeVisible();
    await expect(page.getByText('Searching...')).toBeHidden({ timeout: 10000 });
    
    // Should show no results message
    await expect(page.getByText(/No results found/i)).toBeVisible();
  });
});