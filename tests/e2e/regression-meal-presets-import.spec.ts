import { test, expect } from '@playwright/test';
import { setupTestProfile } from './helpers/setupProfile';

test.describe('Regression: Meal Presets Import - Complete Flow', () => {
  test.beforeEach(async ({ context }) => {
    // Set age gate to pass BEFORE page loads
    await context.addInitScript(() => {
      localStorage.setItem('age_gate_accepted', 'true');
      localStorage.setItem('age_gate_timestamp', new Date().toISOString());
    });
  });

  test('should import preset as meal plan and edit title', async ({ page }) => {
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

    // Get first preset card and import it
    const firstPresetCard = presetCards.first();
    const presetId = await firstPresetCard.getAttribute('data-preset-id');
    const importButton = firstPresetCard.getByRole('button', { name: 'Import' });
    await expect(importButton).toBeVisible();
    await importButton.click();

    // Wait for navigation to Meal Plans tab and editor to load
    await page.waitForTimeout(2000);

    // Verify we're on Meal Plans tab
    const mealPlansTab = page.getByTestId('meals-meal-plans-tab');
    await expect(mealPlansTab).toHaveClass(/border-blue-500/);

    // Verify editor is visible
    const titleInput = page.getByTestId('meal-plan-title-input');
    await expect(titleInput).toBeVisible({ timeout: 5000 });

    // Get the original plan title
    const originalTitle = await titleInput.inputValue();
    expect(originalTitle).toBeTruthy();

    // Edit the plan title
    const newTitle = `My Edited ${originalTitle}`;
    await titleInput.clear();
    await titleInput.fill(newTitle);

    // Trigger blur to save by clicking outside
    await page.mouse.click(100, 100);
    await page.waitForTimeout(1000);

    // Click outside to close editor
    await page.mouse.click(500, 500);
    await page.waitForTimeout(500);

    // Reload to verify persistence
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Navigate to Meals page directly (should reset any modal/editor state)
    await page.goto('./#/meals');
    await page.waitForLoadState('networkidle');

    // Click Meal Plans tab
    const mealPlansTabAfterReload = page.getByTestId('meals-meal-plans-tab');
    await mealPlansTabAfterReload.click();
    await page.waitForTimeout(1000);

    // Verify the meal plans tab shows our edited plan
    await expect(page.getByText(newTitle)).toBeVisible({ timeout: 5000 });
  });

  test('should import preset and persist after reload', async ({ page }) => {
    // Set up profile first
    await setupTestProfile(page);

    await page.goto('./#/meals');
    await page.waitForLoadState('networkidle');

    const presetsTab = page.getByTestId('meals-presets-tab');
    await presetsTab.click();

    const presetCards = page.locator('[data-testid^="meals-preset-card-"]');
    await expect(presetCards.first()).toBeVisible({ timeout: 10000 });

    // Import first preset
    const firstPresetCard = presetCards.first();
    const importButton = firstPresetCard.getByRole('button', { name: 'Import' });
    await importButton.click();

    // Wait for import to complete
    await page.waitForTimeout(2000);

    // Get the plan title
    const titleInput = page.getByTestId('meal-plan-title-input');
    const planTitle = await titleInput.inputValue();

    // Reload the page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Navigate to Meal Plans
    const mealPlansTab = page.getByTestId('meals-meal-plans-tab');
    await mealPlansTab.click();
    await page.waitForTimeout(1000);

    // Verify the imported plan persists
    await expect(page.getByText(planTitle)).toBeVisible({ timeout: 5000 });
  });

  test('should import preset and show structure in editor', async ({ page }) => {
    // Set up profile first
    await setupTestProfile(page);

    await page.goto('./#/meals');
    await page.waitForLoadState('networkidle');

    const presetsTab = page.getByTestId('meals-presets-tab');
    await presetsTab.click();

    const presetCards = page.locator('[data-testid^="meals-preset-card-"]');
    const firstPresetCard = presetCards.first();
    const importButton = firstPresetCard.getByRole('button', { name: 'Import' });
    await importButton.click();

    // Wait for editor to load
    await page.waitForTimeout(2000);

    // Verify editor shows day structure
    await expect(page.getByText('Day Structure')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Breakfast').first()).toBeVisible({ timeout: 3000 });
  });
});