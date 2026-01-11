import { test, expect } from '@playwright/test';

test.describe('Regression: Meal Save Persistence (R05)', () => {
  test.beforeEach(async ({ page, context }) => {
    // Set up age gate and onboarding
    await context.addInitScript(() => {
      localStorage.setItem('age_gate_accepted', 'true');
      localStorage.setItem('onboarding_completed', 'true');
    });
  });

  test('should show macros on meal rows without needing to click Edit', async ({ page }) => {
    // Navigate to Meals page
    await page.goto('./#/meals');
    await page.waitForLoadState('networkidle');
    
    // Click "Create New Meal" button
    await page.getByTestId('create-new-meal-btn').click();
    await page.waitForTimeout(500);
    
    // Set meal name
    await page.getByTestId('meal-editor-name-input').fill('Macro Display Test Meal');
    
    // Open manual food form
    await page.getByTestId('meal-editor-add-manual-food-btn').click();
    await page.waitForTimeout(500);
    
    // Fill in manual food form with all macros
    const foodNameInput = page.locator('input[placeholder*="e.g., Homemade Salad"]');
    await foodNameInput.fill('Chicken Breast');
    
    const caloriesInput = page.locator('input[placeholder="200"]');
    await caloriesInput.fill('165');
    
    const proteinInput = page.locator('input[placeholder="20"]');
    await proteinInput.fill('31');
    
    const carbsInput = page.locator('input[placeholder="25"]');
    await carbsInput.fill('0');
    
    const fatInput = page.locator('input[placeholder="8"]');
    await fatInput.fill('3.6');
    
    // Add to meal
    await page.getByRole('button', { name: 'Add to Meal' }).click();
    await page.waitForTimeout(500);
    
    // Save the meal
    await page.getByRole('button', { name: 'Save Meal' }).click();
    await page.waitForTimeout(1000);
    
    // Navigate back to meals list
    await page.goto('./#/meals');
    await page.waitForLoadState('networkidle');
    
    // Find the meal and click Edit to view items
    const mealCard = page.locator('[data-testid^="meal-card-"]').filter({ hasText: 'Macro Display Test Meal' });
    await expect(mealCard).toBeVisible({ timeout: 5000 });
    
    // Click Edit button - it's a button with an SVG icon
    const editButton = mealCard.locator('button').nth(0); // First button is Edit
    await editButton.click();
    
    // Wait for editor to load
    await page.waitForTimeout(500);
    
    // Find the meal item row (should be index 0)
    const mealItemRow = page.getByTestId('meal-item-row-0');
    await expect(mealItemRow).toBeVisible();
    
    // Verify macros are visible WITHOUT needing to click Edit
    // Use testId selectors to avoid strict mode violations
    await expect(page.getByTestId('meal-item-cal-0')).toBeVisible();
    await expect(page.getByTestId('meal-item-protein-0')).toBeVisible();
    await expect(page.getByTestId('meal-item-carbs-0')).toBeVisible();
    await expect(page.getByTestId('meal-item-fat-0')).toBeVisible();
    
    // Verify the actual values
    await expect(page.getByTestId('meal-item-cal-0')).toContainText('165 cal');
    await expect(page.getByTestId('meal-item-protein-0')).toContainText('31.0g protein');
    await expect(page.getByTestId('meal-item-carbs-0')).toContainText('0.0g carbs');
    await expect(page.getByTestId('meal-item-fat-0')).toContainText('3.6g fat');
    
    console.log('✅ Macros shown on meal row without Edit click');
  });

  test('should show ingredient macros in meal card view (non-edit state)', async ({ page }) => {
    // Navigate to Meals page
    await page.goto('./#/meals');
    await page.waitForLoadState('networkidle');
    
    // Click "Create New Meal" button
    await page.getByTestId('create-new-meal-btn').click();
    await page.waitForTimeout(500);
    
    // Set meal name
    await page.getByTestId('meal-editor-name-input').fill('Card View Macros Test');
    
    // Open manual food form
    await page.getByTestId('meal-editor-add-manual-food-btn').click();
    await page.waitForTimeout(500);
    
    // Fill in manual food form with all macros
    const foodNameInput = page.locator('input[placeholder*="e.g., Homemade Salad"]');
    await foodNameInput.fill('Salmon Fillet');
    
    const caloriesInput = page.locator('input[placeholder="200"]');
    await caloriesInput.fill('208');
    
    const proteinInput = page.locator('input[placeholder="20"]');
    await proteinInput.fill('20');
    
    const carbsInput = page.locator('input[placeholder="25"]');
    await carbsInput.fill('0');
    
    const fatInput = page.locator('input[placeholder="8"]');
    await fatInput.fill('13');
    
    // Add to meal
    await page.getByRole('button', { name: 'Add to Meal' }).click();
    await page.waitForTimeout(500);
    
    // Save the meal
    await page.getByRole('button', { name: 'Save Meal' }).click();
    await page.waitForTimeout(1000);
    
    // Navigate back to meals list
    await page.goto('./#/meals');
    await page.waitForLoadState('networkidle');
    
    // Find the meal card (without clicking Edit)
    const mealCard = page.locator('[data-testid^="meal-card-"]').filter({ hasText: 'Card View Macros Test' });
    await expect(mealCard).toBeVisible({ timeout: 5000 });
    
    // Find the details element and open it
    const detailsElement = mealCard.locator('details').first();
    // Use JavaScript to set the open attribute
    await page.evaluate((el) => el.setAttribute('open', ''), await detailsElement.elementHandle());
    await page.waitForTimeout(300);
    
    // Verify the ingredient item is visible
    // Look for the ingredient within the meal card
    const ingredient = mealCard.locator('[data-testid^="meal-card-item-"]').filter({ hasText: 'Salmon Fillet' });
    await expect(ingredient).toBeVisible({ timeout: 5000 });
    
    // Verify macros are visible in the ingredient section
    // The testId format is: meal-card-item-cal-{mealId}-{index}
    // We'll search by text content instead
    await expect(ingredient.getByText(/Cal: 208/)).toBeVisible();
    await expect(ingredient.getByText(/P: 20.0g/)).toBeVisible();
    await expect(ingredient.getByText(/C: 0.0g/)).toBeVisible();
    await expect(ingredient.getByText(/F: 13.0g/)).toBeVisible();
    
    console.log('✅ Ingredient macros visible in meal card view (non-edit state)');
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
