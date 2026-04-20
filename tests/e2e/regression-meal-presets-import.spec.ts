import { test, expect } from '@playwright/test';
import { bootstrapContext, gotoApp } from './helpers/bootstrap';
import { waitForRouteReady } from './helpers/app';

test.describe('Regression: Meal Presets Import - Complete Flow', () => {
  test.beforeEach(async ({ context }) => {
    // Fast, deterministic starting state (no UI profile setup, no age gate).
    await bootstrapContext(context, {
      clearStorage: true,
      acceptAgeGate: true,
      completeOnboarding: true,
      seedProfile: true,
    });
  });

  test('should import preset as meal plan and edit title', async ({ page }) => {
    await gotoApp(page, '/meals');
    await waitForRouteReady(page);

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
    const importButton = firstPresetCard.getByRole('button', { name: 'Import as Copy' });
    await expect(importButton).toBeVisible();
    await importButton.click();

    // Wait for editor to load (no arbitrary sleep pls)

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

    // Trigger blur to save
    await page.mouse.click(0, 0);

    // Close editor and ensure the updated title made it to the list (i.e., save finished)
    const closeEditorButton = page.getByTestId('meal-plan-close-editor-btn');
    await closeEditorButton.click();
    await expect(page.getByText(newTitle)).toBeVisible({ timeout: 10_000 });

    // Reload to verify persistence
    await page.reload();
    await waitForRouteReady(page);

    // Navigate to Meals page directly (should reset any modal/editor state)
    await gotoApp(page, '/meals');
    await waitForRouteReady(page);

    // Click Meal Plans tab
    const mealPlansTabAfterReload = page.getByTestId('meals-meal-plans-tab');
    await mealPlansTabAfterReload.click();

    // Verify the meal plans tab shows our edited plan
    await expect(page.getByText(newTitle)).toBeVisible({ timeout: 10_000 });
  });

  test('should import preset and persist after reload', async ({ page }) => {
    await gotoApp(page, '/meals');
    await waitForRouteReady(page);

    const presetsTab = page.getByTestId('meals-presets-tab');
    await presetsTab.click();

    const presetCards = page.locator('[data-testid^="meals-preset-card-"]');
    await expect(presetCards.first()).toBeVisible({ timeout: 10000 });

    // Import first preset
    const firstPresetCard = presetCards.first();
    const importButton = firstPresetCard.getByRole('button', { name: 'Import as Copy' });
    await importButton.click();

    // Wait for import to complete by waiting on the editor UI

    // Get the plan title
    const titleInput = page.getByTestId('meal-plan-title-input');
    const planTitle = await titleInput.inputValue();

    // Reload the page
    await page.reload();
    await waitForRouteReady(page);

    // Navigate to Meal Plans
    const mealPlansTab = page.getByTestId('meals-meal-plans-tab');
    await mealPlansTab.click();

    // Verify the imported plan persists
    await expect(page.getByText(planTitle)).toBeVisible({ timeout: 5000 });
  });

  test('should import preset and show structure in editor', async ({ page }) => {
    await gotoApp(page, '/meals');
    await waitForRouteReady(page);

    const presetsTab = page.getByTestId('meals-presets-tab');
    await presetsTab.click();

    const presetCards = page.locator('[data-testid^="meals-preset-card-"]');
    const firstPresetCard = presetCards.first();
    const importButton = firstPresetCard.getByRole('button', { name: 'Import as Copy' });
    await importButton.click();

    // Wait for editor to load (by waiting on expected UI)

    // Verify editor shows day structure
    await expect(page.getByText('Day Structure')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Breakfast').first()).toBeVisible({ timeout: 3000 });
  });
});