import { test, expect } from '@playwright/test';

test.describe('Regression: Nutrition Log Saved Meals', () => {
  test.beforeEach(async ({ page, context }) => {
    // Set up age gate and onboarding
    await context.addInitScript(() => {
      localStorage.setItem('age_gate_accepted', 'true');
      localStorage.setItem('onboarding_completed', 'true');
    });
  });

  test('should add saved meal to nutrition log with correct quantity display', async ({ page }) => {
    // First, create a saved meal via the Meals page
    await page.goto('./#/meals');
    await page.waitForLoadState('networkidle');
    
    // Create a new meal
    await page.getByTestId('create-new-meal-btn').click();
    await page.waitForTimeout(500);
    
    await page.getByTestId('meal-editor-name-input').fill('Test Log Meal');
    
    // Add a manual food item
    await page.getByTestId('meal-editor-add-manual-food-btn').click();
    await page.waitForTimeout(500);
    
    const foodNameInput = page.locator('input[placeholder*="e.g., Homemade Salad"]');
    await foodNameInput.fill('Test Chicken Breast');
    
    const caloriesInput = page.locator('input[placeholder="200"]');
    await caloriesInput.fill('300');
    
    const proteinInput = page.locator('input[placeholder="20"]');
    await proteinInput.fill('25');
    
    const carbsInput = page.locator('input[placeholder="25"]');
    await carbsInput.fill('5');
    
    const fatInput = page.locator('input[placeholder="8"]');
    await fatInput.fill('3');
    
    await page.getByRole('button', { name: 'Add to Meal' }).click();
    await page.waitForTimeout(500);
    
    // Save the meal
    await page.getByTestId('meal-editor-save-btn').click();
    await page.waitForTimeout(1000);
    
    // Verify meal was saved
    await expect(page.getByText('Test Log Meal')).toBeVisible({ timeout: 5000 });
    
    // Now navigate to Nutrition Log
    await page.goto('./#/nutrition');
    await page.waitForLoadState('networkidle');
    
    // Verify 'Saved Meals' button exists
    await expect(page.getByTestId('nutrition-log-add-saved-meal-btn')).toBeVisible({ timeout: 5000 });
    
    // Click 'Saved Meals' button to open modal
    await page.getByTestId('nutrition-log-add-saved-meal-btn').click();
    await page.waitForTimeout(300);
    
    // Verify saved meals modal is visible
    await expect(page.getByTestId('nutrition-log-saved-meal-modal')).toBeVisible({ timeout: 3000 });
    
    // Click on the saved meal we created (find by name instead of testId)
    await expect(page.getByText('Test Log Meal')).toBeVisible({ timeout: 3000 });
    await page.locator('button').filter({ hasText: 'Test Log Meal' }).click();
    await page.waitForTimeout(500);
    
    // Verify modal is closed
    await expect(page.getByTestId('nutrition-log-saved-meal-modal')).not.toBeVisible({ timeout: 3000 });
    
    // Verify food items are in the log
    await expect(page.getByTestId('nutrition-food-item')).toBeVisible({ timeout: 3000 });
    
    // Verify food name is in the log
    await expect(page.getByText('Test Chicken Breast')).toBeVisible({ timeout: 3000 });
    
    // Verify quantity display shows '1 serving' and NOT '1g'
    await expect(page.getByText('1 serving')).toBeVisible({ timeout: 3000 });
    await expect(page.getByText(/1\s*g$/)).not.toBeVisible({ timeout: 3000 });
    
    // Reload the page to verify persistence
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Verify food items are still in the log
    await expect(page.getByTestId('nutrition-food-item')).toBeVisible({ timeout: 3000 });
    
    // Verify quantity display is still correct
    await expect(page.getByText('1 serving')).toBeVisible({ timeout: 3000 });
    await expect(page.getByText(/1\s*g$/)).not.toBeVisible({ timeout: 3000 });
    
    console.log('✅ Saved meal added to nutrition log with correct quantity display and persistence');
  });
});