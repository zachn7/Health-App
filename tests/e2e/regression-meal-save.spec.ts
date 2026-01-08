import { test, expect } from '@playwright/test';

test.describe('Regression: Meal Save Persistence (R05)', () => {
  test.beforeEach(async ({ page, context }) => {
    // Set up age gate and onboarding
    await context.addInitScript(() => {
      localStorage.setItem('age_gate_accepted', 'true');
      localStorage.setItem('onboarding_completed', 'true');
    });
  });

  test('should create meal, add manual food, save and persist', async ({ page }) => {
    // Navigate to Meals page
    await page.goto('./#/meals');
    await page.waitForLoadState('networkidle');
    
    // Verify empty state
    await expect(page.getByText('No Meals Saved Yet')).toBeVisible({ timeout: 5000 });
    
    // Click "Create New Meal" button
    await page.getByTestId('create-new-meal-btn').click();
    await page.waitForTimeout(500);
    
    // Verify meal editor opened
    await expect(page.locator('h2').filter({ hasText: /Create New Meal/i })).toBeVisible({ timeout: 5000 });
    
    // Set meal name
    await page.getByTestId('meal-editor-name-input').fill('Test Meal');
    
    // Open manual food form
    await page.getByTestId('meal-editor-add-manual-food-btn').click();
    await page.waitForTimeout(500);
    
    // Fill in manual food form
    const foodNameInput = page.locator('input[placeholder*="e.g., Homemade Salad"]');
    await foodNameInput.fill('Test Food');
    
    const caloriesInput = page.locator('input[placeholder="200"]');
    await caloriesInput.fill('300');
    
    const proteinInput = page.locator('input[placeholder="20"]');
    await proteinInput.fill('25');
    
    const carbsInput = page.locator('input[placeholder="25"]');
    await carbsInput.fill('30');
    
    const fatInput = page.locator('input[placeholder="8"]');
    await fatInput.fill('10');
    
    // Add to meal
    await page.getByRole('button', { name: 'Add to Meal' }).click();
    await page.waitForTimeout(500);
    
    // Verify food appears in meal editor
    await expect(page.getByText('Test Food')).toBeVisible({ timeout: 5000 });
    
    // Save the meal
    await page.getByTestId('meal-editor-save-btn').click();
    await page.waitForTimeout(1000);
    
    // Verify meal editor closed
    await expect(page.locator('h2').filter({ hasText: /Create New Meal/i })).not.toBeVisible({ timeout: 5000 });
    
    // Verify meal appears in the list
    await expect(page.getByText('Test Meal')).toBeVisible({ timeout: 5000 });
    
    // Verify no error alert shown (check for error text in console or DOM)
    const errorAlert = page.locator('text=Failed to save meal');
    await expect(errorAlert).not.toBeVisible({ timeout: 5000 });
  });

  test('should retain meal data across page reloads', async ({ page }) => {
    // Navigate to Meals page
    await page.goto('./#/meals');
    await page.waitForLoadState('networkidle');
    
    // Click "Create New Meal" button
    await page.getByTestId('create-new-meal-btn').click();
    await page.waitForTimeout(500);
    
    // Set meal name
    await page.getByTestId('meal-editor-name-input').fill('Persistence Test Meal');
    
    // Open manual food form and add food
    await page.getByTestId('meal-editor-add-manual-food-btn').click();
    await page.waitForTimeout(500);
    
    const foodNameInput = page.locator('input[placeholder*="e.g., Homemade Salad"]');
    await foodNameInput.fill('Persistence Food');
    
    const caloriesInput = page.locator('input[placeholder="200"]');
    await caloriesInput.fill('400');
    
    const proteinInput = page.locator('input[placeholder="20"]');
    await proteinInput.fill('30');
    
    const carbsInput = page.locator('input[placeholder="25"]');
    await carbsInput.fill('40');
    
    const fatInput = page.locator('input[placeholder="8"]');
    await fatInput.fill('15');
    
    // Add to meal
    await page.getByRole('button', { name: 'Add to Meal' }).click();
    await page.waitForTimeout(500);
    
    // Save the meal
    await page.getByTestId('meal-editor-save-btn').click();
    await page.waitForTimeout(1000);
    
    // Refresh the page
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Verify meal still exists after reload
    await expect(page.getByText('Persistence Test Meal')).toBeVisible({ timeout: 5000 });
    
    // Verify food counts in the meal card
    await expect(page.getByText('1 food item')).toBeVisible({ timeout: 5000 });
  });

  test('should validate meal name and prevent save without name', async ({ page }) => {
    // Navigate to Meals page
    await page.goto('./#/meals');
    await page.waitForLoadState('networkidle');
    
    // Click "Create New Meal" button
    await page.getByTestId('create-new-meal-btn').click();
    await page.waitForTimeout(500);
    
    // Don't set meal name
    // Try to open manual food form
    await page.getByTestId('meal-editor-add-manual-food-btn').click();
    await page.waitForTimeout(500);
    
    // Add food
    const foodNameInput = page.locator('input[placeholder*="e.g., Homemade Salad"]');
    await foodNameInput.fill('Test Food');
    
    const caloriesInput = page.locator('input[placeholder="200"]');
    await caloriesInput.fill('300');
    
    const proteinInput = page.locator('input[placeholder="20"]');
    await proteinInput.fill('20');
    
    const carbsInput = page.locator('input[placeholder="25"]');
    await carbsInput.fill('25');
    
    const fatInput = page.locator('input[placeholder="8"]');
    await fatInput.fill('8');
    
    // Add to meal
    await page.getByRole('button', { name: 'Add to Meal' }).click();
    await page.waitForTimeout(500);
    
    // Try to save without meal name - button should be disabled
    const saveButton = page.getByTestId('meal-editor-save-btn');
    await expect(saveButton).toBeDisabled();
    
    // Set meal name
    await page.getByTestId('meal-editor-name-input').fill('Named Meal');
    
    // Now save button should be enabled
    await expect(saveButton).toBeEnabled();
    
    // Save and verify success
    await saveButton.click();
    await page.waitForTimeout(1000);
    
    // Verify meal appears in list
    await expect(page.getByText('Named Meal')).toBeVisible({ timeout: 5000 });
  });

  test('should validate meal has at least one food item', async ({ page }) => {
    // Set up alert handler to capture validation message
    page.on('dialog', async dialog => {
      console.log('Alert message:', dialog.message());
      await dialog.accept();
    });

    // Navigate to Meals page
    await page.goto('./#/meals');
    await page.waitForLoadState('networkidle');
    
    // Click "Create New Meal" button
    await page.getByTestId('create-new-meal-btn').click();
    await page.waitForTimeout(500);
    
    // Set meal name but don't add food
    await page.getByTestId('meal-editor-name-input').fill('Empty Meal');
    
    // Try to save without food items - should show alert
    await page.getByTestId('meal-editor-save-btn').click();
    await page.waitForTimeout(500);
    
    // Meal editor should still be open (alert was shown but didn't close it)
    await expect(page.locator('h2').filter({ hasText: /Create New Meal/i })).toBeVisible({ timeout: 5000 });
    
    // Verify meal name is still there (not saved)
    await expect(page.getByTestId('meal-editor-name-input')).toHaveValue('Empty Meal');
  });
});
