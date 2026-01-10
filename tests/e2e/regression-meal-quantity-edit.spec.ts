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
    await expect(page.getByText('1 serving • 300 cal')).toBeVisible({ timeout: 3000 });
    
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
    await page.waitForTimeout(200);
    
    // Verify calories updated in the meal item row (use exact match to avoid total calories)
    await expect(page.getByText('2 1 serving • 600 cal')).toBeVisible({ timeout: 3000 });
    
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
    await expect(page.getByText('2 1 serving • 600 cal')).toBeVisible({ timeout: 3000 });
    
    console.log('✅ Meal item quantity editing and persistence working correctly');
  });
});