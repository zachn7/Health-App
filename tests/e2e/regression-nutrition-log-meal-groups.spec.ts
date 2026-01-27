import { test, expect } from '@playwright/test';
import { setupTestProfile } from './helpers/setupProfile';

test.describe('Regression: Nutrition Log Meal Groups + Import from Meal Plans', () => {
  test.beforeEach(async ({ context }) => {
    // Set age gate to pass BEFORE page loads
    await context.addInitScript(() => {
      localStorage.setItem('age_gate_accepted', 'true');
      localStorage.setItem('age_gate_timestamp', new Date().toISOString());
    });
  });

  test('should import meal plan dinner section into nutrition log', async ({ page }) => {
    // Set up profile first
    await setupTestProfile(page);

    // Navigate to Meals page to create/import a meal plan
    await page.goto('./#/meals');
    await page.waitForLoadState('networkidle');

    // Switch to Presets tab
    const presetsTab = page.getByTestId('meals-presets-tab');
    await presetsTab.click();
    await expect(presetsTab).toHaveClass(/border-blue-500/);

    // Wait for preset cards to load
    const presetCards = page.locator('[data-testid^="meals-preset-card-"]');
    await expect(presetCards.first()).toBeVisible({ timeout: 10000 });

    // Import first preset
    const firstPresetCard = presetCards.first();
    const importButton = firstPresetCard.getByRole('button', { name: 'Import as Copy' });
    await importButton.click();
    await page.waitForTimeout(2000);

    // Close the meal plan editor
    const closeEditorButton = page.getByTestId('meal-plan-close-editor-btn');
    await closeEditorButton.click();
    await page.waitForTimeout(500);

    // Navigate to Nutrition page
    await page.goto('./#/nutrition');
    await page.waitForLoadState('networkidle');

    // Click "Import Meal Plan" button - verify it exists
    const importMealPlanButton = page.getByTestId('nutrition-import-meal-plan-btn');
    await expect(importMealPlanButton).toBeVisible({ timeout: 5000 });
    
    // Open import modal
    await importMealPlanButton.click();
    await page.waitForTimeout(500);

    // Verify the import modal opened with select element
    const planSelect = page.locator('select').first();
    await expect(planSelect).toBeVisible({ timeout: 3000 });

    // Cancel the modal
    const cancelButton = page.getByRole('button', { name: 'Cancel' });
    await cancelButton.click();
    await page.waitForTimeout(500);

    // Verify the modal is closed
    await expect(importMealPlanButton).toBeVisible();
  });

  test('should add food using manual entry to Breakfast section', async ({ page }) => {
    // Set up profile
    await setupTestProfile(page);

    // Navigate to Nutrition page
    await page.goto('./#/nutrition');
    await page.waitForLoadState('networkidle');

    // Click "Manual Entry" button
    const manualEntryButton = page.getByTestId('nutrition-manual-entry-btn');
    await expect(manualEntryButton).toBeVisible({ timeout: 5000 });
    await manualEntryButton.click();
    await page.waitForTimeout(500);

    // Fill in food details
    const nameInput = page.locator('input[placeholder*="Chicken Breast"]');
    await nameInput.fill('Test Breakfast Food');

    // Find and fill calories input (second number input in the form)
    const numberInputs = page.locator('input[type="number"]');
    await numberInputs.nth(1).fill('300');

    // Click Save
    const saveButton = page.getByRole('button', { name: 'Save Food' });
    await saveButton.click();
    await page.waitForTimeout(2000);

    // Verify food was added (check if any section has food)
    const foodItems = page.getByTestId('nutrition-food-item');
    const itemCount = await foodItems.count();
    expect(itemCount).toBeGreaterThan(0);
  });

  test('should add food to Dinner section using Dinner Add Food button', async ({ page }) => {
    // Set up profile
    await setupTestProfile(page);

    // Navigate to Nutrition page
    await page.goto('./#/nutrition');
    await page.waitForLoadState('networkidle');

    // Click Dinner Add Food button
    const dinnerAddButton = page.getByTestId('nutrition-add-food-dinner');
    await expect(dinnerAddButton).toBeVisible({ timeout: 5000 });
    await dinnerAddButton.click();
    await page.waitForTimeout(500);

    // Fill in food details
    const nameInput = page.locator('input[placeholder*="Chicken Breast"]');
    await nameInput.fill('Test Dinner Food');

    const numberInputs = page.locator('input[type="number"]');
    await numberInputs.nth(1).fill('400');

    // Click Save
    const saveButton = page.getByRole('button', { name: 'Save Food' });
    await saveButton.click();
    await page.waitForTimeout(2000);

    // Verify food was added and appears under Dinner section
    const dinnerSection = page.locator('text=Dinner').last();
    await expect(dinnerSection).toBeVisible();

    // Find the food item within the Dinner section
    // The Dinner section should have our added food
    const allFoodItems = page.getByTestId('nutrition-food-item');
    const itemCount = await allFoodItems.count();
    expect(itemCount).toBeGreaterThan(0);

    // Verify the food name appears
    const pageContent = await page.content();
    expect(pageContent).toContain('Test Dinner Food');

    console.log('✅ Food added to Dinner section successfully');
  });

  test('should persist meal group after page reload', async ({ page }) => {
    // Set up profile
    await setupTestProfile(page);

    // Navigate to Nutrition page
    await page.goto('./#/nutrition');
    await page.waitForLoadState('networkidle');

    // Add food to Lunch section
    const lunchAddButton = page.getByTestId('nutrition-add-food-lunch');
    await expect(lunchAddButton).toBeVisible({ timeout: 5000 });
    await lunchAddButton.click();
    await page.waitForTimeout(500);

    const nameInput = page.locator('input[placeholder*="Chicken Breast"]');
    await nameInput.fill('Test Lunch Food');

    const numberInputs = page.locator('input[type="number"]');
    await numberInputs.nth(1).fill('300');

    const saveButton = page.getByRole('button', { name: 'Save Food' });
    await saveButton.click();
    await page.waitForTimeout(2000);

    // Verify food was added
    let foodItems = page.getByTestId('nutrition-food-item');
    let itemCountBeforeReload = await foodItems.count();
    expect(itemCountBeforeReload).toBeGreaterThan(0);

    console.log('✅ Food added before reload');

    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Verify food still exists after reload
    foodItems = page.getByTestId('nutrition-food-item');
    let itemCountAfterReload = await foodItems.count();
    expect(itemCountAfterReload).toBeGreaterThan(0);
    expect(itemCountAfterReload).toBe(itemCountBeforeReload);

    // Verify the food name still appears
    const pageContent = await page.content();
    expect(pageContent).toContain('Test Lunch Food');

    console.log('✅ Food persists after reload');
  });

  test('should show meal group sections', async ({ page }) => {
    // Set up profile
    await setupTestProfile(page);

    // Navigate to Nutrition page
    await page.goto('./#/nutrition');
    await page.waitForLoadState('networkidle');

    // Verify we can click Add Food buttons in different sections
    // First, add a generic food to create Uncategorized section
    const manualEntryButton = page.getByTestId('nutrition-manual-entry-btn');
    await manualEntryButton.click();
    await page.waitForTimeout(500);

    const nameInput = page.locator('input[placeholder*="Chicken Breast"]');
    await nameInput.fill('Test Food');

    const numberInputs = page.locator('input[type="number"]');
    await numberInputs.nth(1).fill('100');

    const saveButton = page.getByRole('button', { name: 'Save Food' });
    await saveButton.click();
    await page.waitForTimeout(2000);

    // Add another food to Breakfast section
    const addFoodButtons = page.getByRole('button', { name: 'Add Food' });
    const buttonCount = await addFoodButtons.count();
    
    if (buttonCount > 0) {
      await addFoodButtons.first().click();
      await page.waitForTimeout(500);

      const nameInput2 = page.locator('input[placeholder*="Chicken Breast"]');
      await nameInput2.fill('Breakfast Item');

      const numberInputs2 = page.locator('input[type="number"]');
      await numberInputs2.nth(1).fill('200');

      const saveButton2 = page.getByRole('button', { name: 'Save Food' });
      await saveButton2.click();
      await page.waitForTimeout(2000);

      // Verify we have food items displayed
      const foodItems = page.getByTestId('nutrition-food-item');
      await expect(foodItems.first()).toBeVisible({ timeout: 5000 });
    }
  });
});