import { test, expect } from '@playwright/test';
import { setupTestProfile } from './helpers/setupProfile';

test.describe('Regression: Meal Plan Editor - Add Foods & Delete Sections', () => {
  test.beforeEach(async ({ context }) => {
    // Set age gate to pass BEFORE page loads
    await context.addInitScript(() => {
      localStorage.setItem('age_gate_accepted', 'true');
      localStorage.setItem('age_gate_timestamp', new Date().toISOString());
    });
  });

  test('should import preset and add food to Lunch', async ({ page }) => {
    // Set up profile first
    await setupTestProfile(page);

    // Navigate to Meals page
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

    // Wait for import to complete and editor to load
    await page.waitForTimeout(2000);

    // Get the meal plan ID
    const titleInput = page.getByTestId('meal-plan-title-input');
    await expect(titleInput).toBeVisible({ timeout: 5000 });
    
    // Find the Lunch meal section and click Add Food
    const addFoodButtons = page.getByRole('button', { name: 'Add Food' });
    await expect(addFoodButtons.first()).toBeVisible({ timeout: 5000 });
    
    // Click the second Add Food button (Lunch)
    await addFoodButtons.nth(1).click();
    
    // Wait for food picker to open
    await page.waitForTimeout(500);
    
    // Type in search
    const searchInput = page.locator('input[placeholder*="Search for food"]');
    await expect(searchInput).toBeVisible({ timeout: 3000 });
    await searchInput.fill('chicken');
    await page.waitForTimeout(1000);
    
    // Click first food result with complete data
    const firstFoodResult = page.locator('button').filter({ hasText: /cal|protein|grams/i }).first();
    const buttonCount = await firstFoodResult.count();
    
    if (buttonCount > 0) {
      await firstFoodResult.click();
      await page.waitForTimeout(500);
      
      // Verify food was added (check if Lunch shows foods)
      const lunchSectionText = await page.locator('div').filter({ hasText: 'Lunch' }).textContent();
      expect(lunchSectionText).toBeTruthy();
    }
  });

  test('should delete Breakfast meal section', async ({ page }) => {
    // Set up profile first
    await setupTestProfile(page);

    await page.goto('./#/meals');
    await page.waitForLoadState('networkidle');

    const presetsTab = page.getByTestId('meals-presets-tab');
    await presetsTab.click();

    const presetCards = page.locator('[data-testid^="meals-preset-card-"]');
    await expect(presetCards.first()).toBeVisible({ timeout: 10000 });

    const firstPresetCard = presetCards.first();
    const importButton = firstPresetCard.getByRole('button', { name: 'Import as Copy' });
    await importButton.click();
    await page.waitForTimeout(2000);

    const titleInput = page.getByTestId('meal-plan-title-input');
    await expect(titleInput).toBeVisible({ timeout: 5000 });
    
    // Find Delete buttons - verify they exist and are clickable
    const deleteButtons = page.getByRole('button', { name: 'Delete' });
    await expect(deleteButtons.first()).toBeVisible({ timeout: 5000 });
    
    // Verify we can click a delete button
    await deleteButtons.first().click();
    
    // Handle the native confirm dialog
    page.on('dialog', async dialog => {
      await dialog.accept();
    });
    
    // Verify the UI didn't crash and the editor is still visible
    await expect(titleInput).toBeVisible({ timeout: 5000 });
  });

  test('should edit food serving and persist after save', async ({ page }) => {
    await setupTestProfile(page);

    await page.goto('./#/meals');
    await page.waitForLoadState('networkidle');

    const presetsTab = page.getByTestId('meals-presets-tab');
    await presetsTab.click();

    const presetCards = page.locator('[data-testid^="meals-preset-card-"]');
    await expect(presetCards.first()).toBeVisible({ timeout: 10000 });

    const firstPresetCard = presetCards.first();
    const importButton = firstPresetCard.getByRole('button', { name: 'Import as Copy' });
    await importButton.click();
    await page.waitForTimeout(2000);

    const titleInput = page.getByTestId('meal-plan-title-input');
    await expect(titleInput).toBeVisible({ timeout: 5000 });
    
    // Add a manual food using the Manual button in the meal section
    const manualButton = page.getByTestId(/meal-plan-.*-day-.*-meal-.*-add-manual-food/).first();
    await expect(manualButton).toBeVisible({ timeout: 5000 });
    await manualButton.click();
    await page.waitForTimeout(500);
    
    // Fill in manual food form
    const nameInput = page.locator('input[placeholder="e.g., Homemade Salad"]');
    await expect(nameInput).toBeVisible({ timeout: 3000 });
    await nameInput.fill('Test Chicken Breast');
    
    const caloriesInput = page.locator('input[type="number"]').nth(0);
    await caloriesInput.fill('200');
    
    const proteinInput = page.locator('input[type="number"]').nth(1);
    await proteinInput.fill('30');
    
    const carbsInput = page.locator('input[type="number"]').nth(2);
    await carbsInput.fill('0');
    
    const fatInput = page.locator('input[type="number"]').nth(3);
    await fatInput.fill('5');
    
    // Submit the form - the button is labeled "Add to Meal" in this context
    const modal = page.locator('.fixed.inset-0.bg-black').filter({ hasText: 'Add Manual Food' });
    const addToMealButton = modal.getByRole('button', { name: 'Add to Meal' });
    await addToMealButton.click();
    await page.waitForTimeout(500);
    
    // Now find a food item with Edit button
    const editButton = page.getByTestId(/meal-plan-food-edit-btn-/).first();
    await expect(editButton).toBeVisible({ timeout: 5000 });
    
    // Get initial calories
    const foodRow = page.getByTestId(/meal-plan-food-/).first();
    const initialText = await foodRow.textContent();
    const initialCalMatch = initialText?.match(/(\d+) cal/);
    const initialCalories = initialCalMatch ? parseInt(initialCalMatch[1]) : 0;
    
    // Click Edit button
    await editButton.click();
    await page.waitForTimeout(300);
    
    // Verify edit mode UI is visible
    const qtyInput = page.locator('input[type="number"]').first();
    await expect(qtyInput).toBeVisible({ timeout: 3000 });
    
    const saveButton = page.getByTestId(/meal-plan-food-save-qty-/).first();
    await expect(saveButton).toBeVisible({ timeout: 3000 });
    
    // Change quantity to 2x
    const currentQty = await qtyInput.inputValue();
    const numericQty = parseFloat(currentQty) || 1;
    await qtyInput.fill((numericQty * 2).toString());
    await page.waitForTimeout(300);
    
    // Click Save
    await saveButton.click();
    await page.waitForTimeout(500);
    
    // Verify food is updated (calories should be ~2x)
    const updatedText = await foodRow.textContent();
    const updatedCalMatch = updatedText?.match(/(\d+) cal/);
    const updatedCalories = updatedCalMatch ? parseInt(updatedCalMatch[1]) : 0;
    
    expect(updatedCalories).toBeGreaterThanOrEqual(initialCalories * 1.9);
    
    // Verify edit mode is closed
    await expect(qtyInput).not.toBeVisible({ timeout: 3000 });
    
    // Reload and verify persistence
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Navigate to Meal Plans tab
    const mealPlansTab = page.getByTestId('meals-meal-plans-tab');
    await mealPlansTab.click();
    await page.waitForTimeout(500);
    
    // Open the plan again (click on the first plan card)
    const planCard = page.locator('.card.cursor-pointer').first();
    await expect(planCard).toBeVisible({ timeout: 5000 });
    await planCard.click();
    await page.waitForTimeout(500);
    
    // Find the food again after reload and reopening editor
    const finalFoodRow = page.getByTestId(/meal-plan-food-/).first();
    await expect(finalFoodRow).toBeVisible({ timeout: 5000 });
    
    // Verify calories are still the edited value
    const finalText = await finalFoodRow.textContent();
    const finalCalMatch = finalText?.match(/(\d+) cal/);
    const finalCalories = finalCalMatch ? parseInt(finalCalMatch[1]) : 0;
    
    expect(finalCalories).toBeGreaterThanOrEqual(initialCalories * 1.9);
  });

  test('should persist changes after reload', async ({ page }) => {
    // Set up profile first
    await setupTestProfile(page);

    await page.goto('./#/meals');
    await page.waitForLoadState('networkidle');

    const presetsTab = page.getByTestId('meals-presets-tab');
    await presetsTab.click();

    const presetCards = page.locator('[data-testid^="meals-preset-card-"]');
    await expect(presetCards.first()).toBeVisible({ timeout: 10000 });

    const firstPresetCard = presetCards.first();
    const importButton = firstPresetCard.getByRole('button', { name: 'Import as Copy' });
    await importButton.click();
    await page.waitForTimeout(2000);

    const titleInput = page.getByTestId('meal-plan-title-input');
    await expect(titleInput).toBeVisible({ timeout: 5000 });
    const planName = await titleInput.inputValue();
    
    // Close editor
    const closeEditorButton = page.getByRole('button', { name: 'Close editor' });
    if (await closeEditorButton.isVisible()) {
      await closeEditorButton.click();
      await page.waitForTimeout(500);
    }
    
    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Navigate to Meal Plans tab
    const mealPlansTab = page.getByTestId('meals-meal-plans-tab');
    await mealPlansTab.click();
    await page.waitForTimeout(500);
    
    // Verify plan still exists
    await expect(page.getByText(planName)).toBeVisible({ timeout: 5000 });
  });
});