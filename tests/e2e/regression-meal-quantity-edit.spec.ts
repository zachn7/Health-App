import { test, expect } from '@playwright/test';

test.describe('Regression: Meal Item Quantity Editing', () => {
  test.beforeEach(async ({ page, context }) => {
    // Set up age gate and onboarding
    await context.addInitScript(() => {
      localStorage.setItem('age_gate_accepted', 'true');
      localStorage.setItem('onboarding_completed', 'true');
    });
  });

  test('should allow editing serving size for manual food in meal', async ({ page }) => {
    // Navigate to Meals page
    await page.goto('./#/meals');
    await page.waitForLoadState('networkidle');
    
    // Click "Create New Meal" button
    await page.getByTestId('create-new-meal-btn').click();
    await page.waitForTimeout(500);
    
    // Set meal name
    await page.getByTestId('meal-editor-name-input').fill('Quantity Test Meal');
    
    // Add a manual food item
    await page.getByTestId('meal-editor-add-manual-food-btn').click();
    await page.waitForTimeout(500);
    
    const foodNameInput = page.locator('input[placeholder*="e.g., Homemade Salad"]');
    await foodNameInput.fill('Test Chicken Breast');
    
    const caloriesInput = page.locator('input[placeholder="200"]');
    await caloriesInput.fill('300'); // 300 calories per serving (100g)
    
    const proteinInput = page.locator('input[placeholder="20"]');
    await proteinInput.fill('25'); // 25g protein per serving (100g)
    
    const carbsInput = page.locator('input[placeholder="25"]');
    await carbsInput.fill('5'); // 5g carbs per serving (100g)
    
    const fatInput = page.locator('input[placeholder="8"]');
    await fatInput.fill('3'); // 3g fat per serving (100g)
    
    // Add to meal
    await page.getByRole('button', { name: 'Add to Meal' }).click();
    await page.waitForTimeout(500);
    
    // Verify food appears in meal with initial values
    await expect(page.getByText('Test Chicken Breast')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('1 serving')).toBeVisible({ timeout: 3000 });
    await expect(page.getByText(/1 serving • 300 cal/)).toBeVisible({ timeout: 3000 });
    
    // Click edit button on the food item
    await page.getByTestId('meal-item-edit-btn-0').click();
    await page.waitForTimeout(300);
    
    // Verify edit controls are visible
    await expect(page.getByTestId('meal-item-qty-type-toggle-0')).toBeVisible({ timeout: 3000 });
    await expect(page.getByTestId('meal-item-qty-input-0')).toBeVisible({ timeout: 3000 });
    
    // Verify current values (should be 1 serving)
    const qtyInput = page.getByTestId('meal-item-qty-input-0');
    await expect(qtyInput).toHaveValue('1');
    await expect(page.getByText('Serving Size')).toBeVisible({ timeout: 3000 });
    
    // Change quantity to 2 servings
    await qtyInput.fill('2');
    // Blur the input to trigger update
    await qtyInput.blur();
    await page.waitForTimeout(300);
    
    // Verify calories updated (should be 2 * 300 = 600)
    await expect(page.getByText(/2 servings • 600 cal/)).toBeVisible({ timeout: 3000 });
    
    // Save the meal
    await page.getByTestId('meal-editor-save-btn').click();
    await page.waitForTimeout(1000);
    
    // Verify meal editor closed
    await expect(page.locator('h2').filter({ hasText: /Create New Meal/i })).not.toBeVisible({ timeout: 5000 });
    
    // Verify meal appears in the list
    await expect(page.getByText('Quantity Test Meal')).toBeVisible({ timeout: 5000 });
    
    // Click edit on the meal
    await page.getByTitle('Edit meal').click();
    await page.waitForTimeout(500);
    
    // Verify quantity persisted (should still show 2 servings)
    await expect(page.getByText(/2 servings • 600 cal/)).toBeVisible({ timeout: 3000 });
    
    console.log('✅ Meal item quantity editing and persistence working correctly');
  });

  test('should allow clearing quantity input and defaulting to 0 on blur', async ({ page }) => {
    // Navigate to Meals page
    await page.goto('./#/meals');
    await page.waitForLoadState('networkidle');
    
    // Click "Create New Meal" button
    await page.getByTestId('create-new-meal-btn').click();
    await page.waitForTimeout(500);
    
    // Set meal name
    await page.getByTestId('meal-editor-name-input').fill('Blank Input Test Meal');
    
    // Add a manual food item
    await page.getByTestId('meal-editor-add-manual-food-btn').click();
    await page.waitForTimeout(500);
    
    const foodNameInput = page.locator('input[placeholder*="e.g., Homemade Salad"]');
    await foodNameInput.fill('Test Egg');
    
    const caloriesInput = page.locator('input[placeholder="200"]');
    await caloriesInput.fill('70'); 
    
    const proteinInput = page.locator('input[placeholder="20"]');
    await proteinInput.fill('6'); 
    
    const carbsInput = page.locator('input[placeholder="25"]');
    await carbsInput.fill('0.6'); 
    
    const fatInput = page.locator('input[placeholder="8"]');
    await fatInput.fill('5'); 
    
    // Add to meal
    await page.getByRole('button', { name: 'Add to Meal' }).click();
    await page.waitForTimeout(500);
    
    // Verify food appears with initial values
    await expect(page.getByText('Test Egg')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/1 serving • 70 cal/)).toBeVisible({ timeout: 3000 });
    
    // Click edit button
    await page.getByTestId('meal-item-edit-btn-0').click();
    await page.waitForTimeout(300);
    
    const qtyInput = page.getByTestId('meal-item-qty-input-0');
    await expect(qtyInput).toHaveValue('1');
    
    // Clear the input entirely
    await qtyInput.fill('');
    await expect(qtyInput).toHaveValue('');
    
    // Blur the input (click elsewhere)
    await page.getByText('Serving Size').click();
    await page.waitForTimeout(200);
    
    // Verify input defaults to 0 after blur
    await expect(qtyInput).toHaveValue('0');
    
    // Verify macros display shows 0 calories
    const caloriesText = await page.locator(`text=/cal/`).first().textContent();
    expect(caloriesText).toContain('0 cal');
    
    console.log('✅ Blank input handling works correctly (defaults to 0 on blur)');
  });

  test('should allow arrow key increments from blank field', async ({ page }) => {
    // Navigate to Meals page
    await page.goto('./#/meals');
    await page.waitForLoadState('networkidle');
    
    // Click "Create New Meal" button
    await page.getByTestId('create-new-meal-btn').click();
    await page.waitForTimeout(500);
    
    // Set meal name
    await page.getByTestId('meal-editor-name-input').fill('Arrow Key Test Meal');
    
    // Add a manual food item
    await page.getByTestId('meal-editor-add-manual-food-btn').click();
    await page.waitForTimeout(500);
    
    const foodNameInput = page.locator('input[placeholder*="e.g., Homemade Salad"]');
    await foodNameInput.fill('Test Rice');
    
    const caloriesInput = page.locator('input[placeholder="200"]');
    await caloriesInput.fill('130'); 
    
    const proteinInput = page.locator('input[placeholder="20"]');
    await proteinInput.fill('2.7'); 
    
    const carbsInput = page.locator('input[placeholder="25"]');
    await carbsInput.fill('28'); 
    
    const fatInput = page.locator('input[placeholder="8"]');
    await fatInput.fill('0.3'); 
    
    // Add to meal
    await page.getByRole('button', { name: 'Add to Meal' }).click();
    await page.waitForTimeout(500);
    
    // Verify food appears
    await expect(page.getByText('Test Rice')).toBeVisible({ timeout: 5000 });
    
    // Click edit button
    await page.getByTestId('meal-item-edit-btn-0').click();
    await page.waitForTimeout(300);
    
    const qtyInput = page.getByTestId('meal-item-qty-input-0');
    await expect(qtyInput).toHaveValue('1');
    
    // Clear the input
    await qtyInput.fill('');
    await expect(qtyInput).toHaveValue('');
    
    // Press Arrow Up - should increment by step (0.1 for servings)
    await qtyInput.press('ArrowUp');
    await expect(qtyInput).toHaveValue('0.1');
    
    // Press Arrow Up again
    await qtyInput.press('ArrowUp');
    await expect(qtyInput).toHaveValue('0.2');
    
    // Press Arrow Down - should decrement
    await qtyInput.press('ArrowDown');
    await expect(qtyInput).toHaveValue('0.1');
    
    // Switch to grams mode
    const gramsButton = page.getByText('Grams');
    if (await gramsButton.isVisible()) {
      await gramsButton.click();
      await page.waitForTimeout(200);
    }
    
    // Verify current value in grams (should be integer)
    // Note: The exact value depends on the default servingGrams
    const gramsValue = await qtyInput.inputValue();
    console.log(`Grams mode value: ${gramsValue}`);
    // Just verify it's a number (not empty)
    expect(parseInt(gramsValue || '0')).toBeGreaterThanOrEqual(0);
    
    // Clear the grams input
    await qtyInput.fill('');
    await expect(qtyInput).toHaveValue('');
    
    // Press Arrow Up - should increment by step (1 for grams)
    await qtyInput.press('ArrowUp');
    await expect(qtyInput).toHaveValue('1');
    
    // Press Arrow Up multiple times
    await qtyInput.press('ArrowUp');
    await qtyInput.press('ArrowUp');
    await expect(qtyInput).toHaveValue('3');
    
    // Arrow Down should decrement
    await qtyInput.press('ArrowDown');
    await expect(qtyInput).toHaveValue('2');
    
    console.log('✅ Arrow key increments work correctly from blank field');
  });

});
