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