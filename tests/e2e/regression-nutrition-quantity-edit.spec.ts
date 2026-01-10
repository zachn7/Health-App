import { test, expect } from '@playwright/test';

test.describe('Regression: Nutrition Logger Quantity Editing', () => {
  test.beforeEach(async ({ page, context }) => {
    // Set up age gate and onboarding
    await context.addInitScript(() => {
      localStorage.setItem('age_gate_accepted', 'true');
      localStorage.setItem('onboarding_completed', 'true');
    });

    // Mock USDA API responses
    await page.route('**/api.nal.usda.gov/fdc/v1/**', async (route) => {
      const url = route.request().url();

      if (url.includes('/foods/search')) {
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
              }
            ],
            totalPages: 1,
            currentPage: 1
          })
        });
      } else if (url.includes('/food/')) {
        const fdcId = url.match(/\/food\/(\d+)/)?.[1];

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            fdcId: parseInt(fdcId || '0'),
            description: 'Chicken, broilers or fryers, breast, meat only, cooked, roasted',
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

    // Set up mock API key
    await page.goto('./#/settings');
    await page.getByLabel('API Key').fill('mock-api-key-for-ci-testing');
    await page.getByRole('button', { name: /Save Settings/i }).click();
    await expect(page.getByText(/Settings saved|USDA lookups are enabled/i).first()).toBeVisible({ timeout: 5000 });

    // Navigate to nutrition page
    await page.goto('./#/nutrition');
    await page.waitForLoadState('networkidle');
  });

  test('should allow clearing quantity input and defaulting to 0 on blur', async ({ page }) => {
    // Open USDA import dialog
    await page.getByTestId('usda-search-button').click();

    // Search for food
    const searchResponse = page.waitForResponse(
      response => response.url().includes('/foods/search') && response.status() === 200
    );
    await page.getByTestId('usda-search-input').fill('chicken');
    await searchResponse;
    await page.waitForTimeout(600);

    // Add food
    const detailResponse = page.waitForResponse(
      response => response.url().includes('/food/170967') && response.status() === 200
    );
    const addButton = page.getByTestId('usda-add-food').first();
    await addButton.click();
    await detailResponse;
    await expect(addButton.getByText('Adding...')).not.toBeVisible({ timeout: 10000 });

    // Close modal
    await page.getByTestId('usda-search-button').click();
    await page.waitForTimeout(500);

    // Get first food item
    const firstItem = page.getByTestId('nutrition-food-item').first();
    await expect(firstItem).toBeVisible({ timeout: 5000 });

    // Click edit serving on the first food item
    const editServingButton = firstItem.getByRole('button', { name: 'edit serving' });
    await editServingButton.click();
    await page.waitForTimeout(300);

    // Get the quantity input using testId
    const quantityInput = page.getByTestId('quantity-input');
    await expect(quantityInput).toHaveValue('1');

    // Clear the input entirely
    await quantityInput.fill('');
    await expect(quantityInput).toHaveValue('');

    // Blur the input (click toggle button)
    await page.getByTestId('quantity-servings-btn').click();
    await page.waitForTimeout(200);

    // Verify input defaults to 0 after blur
    await expect(quantityInput).toHaveValue('0');

    // Verify macro tiles show 0 values
    const caloriesTile = page.getByTestId('quantity-macro-calories');
    await expect(caloriesTile).toContainText('0 cal');

    console.log('✅ Nutrition logger blank input handling works correctly (defaults to 0 on blur)');
  });

  test('should allow arrow key increments from blank field', async ({ page }) => {
    // Open USDA import dialog
    await page.getByTestId('usda-search-button').click();

    // Search for food
    const searchResponse = page.waitForResponse(
      response => response.url().includes('/foods/search') && response.status() === 200
    );
    await page.getByTestId('usda-search-input').fill('chicken');
    await searchResponse;
    await page.waitForTimeout(600);

    // Add food
    const detailResponse = page.waitForResponse(
      response => response.url().includes('/food/170967') && response.status() === 200
    );
    const addButton = page.getByTestId('usda-add-food').first();
    await addButton.click();
    await detailResponse;
    await expect(addButton.getByText('Adding...')).not.toBeVisible({ timeout: 10000 });

    // Close modal
    await page.getByTestId('usda-search-button').click();
    await page.waitForTimeout(500);

    // Get first food item
    const firstItem = page.getByTestId('nutrition-food-item').first();
    await expect(firstItem).toBeVisible({ timeout: 5000 });

    // Click edit serving on the first food item
    const editServingButton = firstItem.getByRole('button', { name: 'edit serving' });
    await editServingButton.click();
    await page.waitForTimeout(300);

    // Get the quantity input using testId
    const quantityInput = page.getByTestId('quantity-input');
    await expect(quantityInput).toHaveValue('1');

    // Test 1: Arrow key increments in serving mode
    // Clear the input
    await quantityInput.fill('');
    await expect(quantityInput).toHaveValue('');

    // Press Arrow Up - should increment by step (0.1 for servings)
    await quantityInput.press('ArrowUp');
    await expect(quantityInput).toHaveValue('0.1');

    // Press Arrow Up again
    await quantityInput.press('ArrowUp');
    await expect(quantityInput).toHaveValue('0.2');

    // Press Arrow Down - should decrement
    await quantityInput.press('ArrowDown');
    await expect(quantityInput).toHaveValue('0.1');

    // Test 2: Arrow key increments in grams mode
    // Switch to grams using toggle button
    await page.getByTestId('quantity-grams-btn').click();
    await page.waitForTimeout(300);

    // Verify current value in grams (should be integer) - just check it's not empty
    const gramsValue = await quantityInput.inputValue();
    console.log(`Nutrition grams mode value: ${gramsValue}`);
    expect(parseInt(gramsValue || '0')).toBeGreaterThanOrEqual(0);

    // Clear the grams input
    await quantityInput.fill('');
    await expect(quantityInput).toHaveValue('');

    // Press Arrow Up - should increment by step (1 for grams)
    await quantityInput.press('ArrowUp');
    await expect(quantityInput).toHaveValue('1');

    // Press Arrow Up multiple times
    await quantityInput.press('ArrowUp');
    await quantityInput.press('ArrowUp');
    await expect(quantityInput).toHaveValue('3');

    // Press Arrow Down
    await quantityInput.press('ArrowDown');
    await expect(quantityInput).toHaveValue('2');

    console.log('✅ Nutrition logger arrow key increments work correctly from blank field');
  });


  test('should preserve value when switching between serving and grams modes', async ({ page }) => {
    // Open USDA import dialog
    await page.getByTestId('usda-search-button').click();

    // Search for food
    const searchResponse = page.waitForResponse(
      response => response.url().includes('/foods/search') && response.status() === 200
    );
    await page.getByTestId('usda-search-input').fill('chicken');
    await searchResponse;
    await page.waitForTimeout(600);

    // Add food
    const detailResponse = page.waitForResponse(
      response => response.url().includes('/food/170967') && response.status() === 200
    );
    const addButton = page.getByTestId('usda-add-food').first();
    await addButton.click();
    await detailResponse;
    await expect(addButton.getByText('Adding...')).not.toBeVisible({ timeout: 10000 });

    // Close modal
    await page.getByTestId('usda-search-button').click();
    await page.waitForTimeout(500);

    // Get first food item
    const firstItem = page.getByTestId('nutrition-food-item').first();

    // Click edit serving on the first food item
    const editServingButton = firstItem.getByRole('button', { name: 'edit serving' });
    await editServingButton.click();
    await page.waitForTimeout(300);

    // Get the quantity input using testId
    const quantityInput = page.getByTestId('quantity-input');
    const servingsBtn = page.getByTestId('quantity-servings-btn');
    const gramsBtn = page.getByTestId('quantity-grams-btn');
    const caloriesTile = page.getByTestId('quantity-macro-calories');

    // Set value to 1.5 servings
    await quantityInput.fill('1.5');
    await page.waitForTimeout(200);

    // Verify macro tiles show correct values for 1.5 servings
    await expect(caloriesTile).toContainText('248 cal'); // 1.5 * 165 ≈ 248

    // Switch to grams mode
    await gramsBtn.click();
    await page.waitForTimeout(200);

    // Should show the equivalent grams (1.5 * 100 = 150g)
    await expect(quantityInput).toHaveValue('150');

    // Verify macros are preserved (same as before)
    await expect(caloriesTile).toContainText('248 cal'); // Still 248 cal for 150g

    // Change grams to 200
    await quantityInput.fill('200');
    await page.waitForTimeout(200);

    // Verify macros updated (200g = 2 servings * 165 = 330 cal)
    await expect(caloriesTile).toContainText('330 cal');

    // Switch back to serving mode
    await servingsBtn.click();
    await page.waitForTimeout(200);

    // Should show 2 servings (200g / 100g per serving)
    await expect(quantityInput).toHaveValue('2');

    // Verify macros are still 330 cal
    await expect(caloriesTile).toContainText('330 cal');

    console.log('✅ Nutrition logger preserves value across mode switches with correct macro calculations');
  });

  test('should update macro tiles live while typing without blur', async ({ page }) => {
    // Open USDA import dialog
    await page.getByTestId('usda-search-button').click();

    // Search for food
    const searchResponse = page.waitForResponse(
      response => response.url().includes('/foods/search') && response.status() === 200
    );
    await page.getByTestId('usda-search-input').fill('chicken');
    await searchResponse;
    await page.waitForTimeout(600);

    // Add food
    const detailResponse = page.waitForResponse(
      response => response.url().includes('/food/170967') && response.status() === 200
    );
    const addButton = page.getByTestId('usda-add-food').first();
    await addButton.click();
    await detailResponse;
    await expect(addButton.getByText('Adding...')).not.toBeVisible({ timeout: 10000 });

    // Close modal
    await page.getByTestId('usda-search-button').click();
    await page.waitForTimeout(500);

    // Get first food item and click edit
    const firstItem = page.getByTestId('nutrition-food-item').first();
    await firstItem.getByRole('button', { name: 'edit serving' }).click();
    await page.waitForTimeout(300);

    const quantityInput = page.getByTestId('quantity-input');
    const caloriesTile = page.getByTestId('quantity-macro-calories');

    // Focus the input
    await quantityInput.focus();

    // Type without blurring - macro tiles should update immediately
    // Start with value '2' for 2 servings
    await quantityInput.fill('2');

    // Verify macro tile updated WITHOUT blurring (2 * 165 = 330 cal)
    await expect(caloriesTile).toContainText('330 cal');

    // Continue typing without blurring - change to '3'
    await quantityInput.fill('3');

    // Verify macro tile updated immediately (3 * 165 = 495 cal)
    await expect(caloriesTile).toContainText('495 cal');

    // Verify input is still focused (not blurred)
    await expect(quantityInput).toBeFocused();

    console.log('✅ Macro tiles update live while typing without blur');
  });

  test('should toggle after save: 200g saved -> switch to servings shows 2.0 not 200', async ({ page }) => {
    // Open USDA import dialog
    await page.getByTestId('usda-search-button').click();

    // Search for food
    const searchResponse = page.waitForResponse(
      response => response.url().includes('/foods/search') && response.status() === 200
    );
    await page.getByTestId('usda-search-input').fill('chicken');
    await searchResponse;
    await page.waitForTimeout(600);

    // Add food
    const detailResponse = page.waitForResponse(
      response => response.url().includes('/food/170967') && response.status() === 200
    );
    const addButton = page.getByTestId('usda-add-food').first();
    await addButton.click();
    await detailResponse;
    await expect(addButton.getByText('Adding...')).not.toBeVisible({ timeout: 10000 });

    // Close modal
    await page.getByTestId('usda-search-button').click();
    await page.waitForTimeout(500);

    // Get first food item and edit buttons
    const firstItem = page.getByTestId('nutrition-food-item').first();
    const editServingButton = firstItem.getByRole('button', { name: 'edit serving' });

    // First edit: open and switch to grams, set 200g
    await editServingButton.click();
    await page.waitForTimeout(300);

    const quantityInput = page.getByTestId('quantity-input');
    const gramsBtn = page.getByTestId('quantity-grams-btn');
    const servingsBtn = page.getByTestId('quantity-servings-btn');
    const saveButton = page.getByTestId('quantity-save-btn');

    // Switch to grams mode
    await gramsBtn.click();
    await page.waitForTimeout(200);

    // Set grams to 200
    await quantityInput.fill('200');
    await expect(quantityInput).toHaveValue('200');

    // Save the changes
    await saveButton.click();

    // Wait for edit modal to close
    await page.waitForTimeout(500);

    // Second edit: reopen the food item editor
    // Re-find the elements since the modal re-rendered
    const firstItem2 = page.getByTestId('nutrition-food-item').first();
    const editServingButton2 = firstItem2.getByRole('button', { name: 'edit serving' });
    const quantityInput2 = page.getByTestId('quantity-input');
    const servingsBtn2 = page.getByTestId('quantity-servings-btn');
    
    // Reopen the edit dialog
    await editServingButton2.click();
    await page.waitForTimeout(300);

    // Wait a bit more for state to fully initialize
    await page.waitForTimeout(300);

    // Should still be in grams mode with value 200
    await expect(quantityInput2).toHaveValue('200');

    // Switch to servings mode
    await servingsBtn2.click();
    await page.waitForTimeout(200);

    // Critical: Should show 2 servings (200g / 100g per serving), NOT 200 servings
    await expect(quantityInput2).toHaveValue('2');

    // Verify macro tiles are correct for 2 servings (2 * 165 = 330 cal)
    const caloriesTile = page.getByTestId('quantity-macro-calories');
    await expect(caloriesTile).toContainText('330 cal');

    console.log('✅ Toggle after save shows correct servings (2.0 not 200)');
  });
});
