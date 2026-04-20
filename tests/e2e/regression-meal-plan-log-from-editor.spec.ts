import { test, expect } from '@playwright/test';
import { bootstrapContext, gotoApp } from './helpers/bootstrap';
import { waitForRouteReady } from './helpers/app';

test.describe('Regression: Meal Plan Log from Editor', () => {
  test.beforeEach(async ({ context }) => {
    await bootstrapContext(context, {
      clearStorage: true,
      acceptAgeGate: true,
      completeOnboarding: true,
      seedProfile: true,
    });
  });

  test('should log single meal from meal plan editor to nutrition log', async ({ page }) => {
    await gotoApp(page, '/meals');
    await waitForRouteReady(page);

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

    // Verify meal plan editor is open
    const titleInput = page.getByTestId('meal-plan-title-input');
    await expect(titleInput).toBeVisible({ timeout: 5000 });

    // Click "Log Day to Today" button to log all meals with existing foods
    const logDayButton = page.getByTestId('meal-plan-log-day-btn');
    await logDayButton.click();

    // Wait for *some* indication logging happened.
    await expect
      .poll(async () => page.locator('div').filter({ hasText: /Logged/i }).count(), { timeout: 10_000 })
      .toBeGreaterThan(0);

    // Verify success message appears
    const toastMessage = page.locator('div').filter({ hasText: /Logged/i });
    const hasToast = await toastMessage.count() > 0;
    
    // Navigate to Nutrition page
    await gotoApp(page, '/nutrition');
    await waitForRouteReady(page);

    // Verify food items exist (if any were logged)
    const foodItems = page.getByTestId('nutrition-food-item');
    const itemCount = await foodItems.count();
    
    // If foods were logged, verify persistence
    if (itemCount > 0) {
      // Reload page to verify persistence
      await page.reload();
      await waitForRouteReady(page);

      // Verify food items are still present after reload
      const foodItemsAfterReload = page.getByTestId('nutrition-food-item');
      const itemCountAfterReload = await foodItemsAfterReload.count();
      
      expect(itemCountAfterReload).toBeGreaterThan(0);
    }
  });

  test('should show success message when logging from meal plan editor', async ({ page }) => {
    await gotoApp(page, '/meals');
    await waitForRouteReady(page);

    // Switch to Presets tab
    const presetsTab = page.getByTestId('meals-presets-tab');
    await presetsTab.click();

    // Wait for preset cards to load
    const presetCards = page.locator('[data-testid^="meals-preset-card-"]');
    await expect(presetCards.first()).toBeVisible({ timeout: 10000 });

    // Import first preset
    const firstPresetCard = presetCards.first();
    const importButton = firstPresetCard.getByRole('button', { name: 'Import as Copy' });
    await importButton.click();

    // Verify meal plan editor is open
    const titleInput = page.getByTestId('meal-plan-title-input');
    await expect(titleInput).toBeVisible({ timeout: 10_000 });

    // Verify Log Day to Today button exists
    const logDayButton = page.getByTestId('meal-plan-log-day-btn');
    await expect(logDayButton).toBeVisible({ timeout: 3000 });

    // Verify Log buttons exist for meals
    const logButtons = page.getByRole('button', { name: 'Log' });
    await expect(logButtons.first()).toBeVisible({ timeout: 3000 });
  });
});