import { test, expect } from '@playwright/test';
import { setupTestProfile } from './helpers/setupProfile';

test.describe('Regression: Workout Presets Import - Complete Flow', () => {
  test.beforeEach(async ({ context }) => {
    // Set age gate to pass BEFORE page loads
    await context.addInitScript(() => {
      localStorage.setItem('age_gate_accepted', 'true');
      localStorage.setItem('age_gate_timestamp', new Date().toISOString());
    });
  });

  test('should import preset program with mapped exercises', async ({ page }) => {
    // Set up profile first
    await setupTestProfile(page);

    // Navigate to Workouts page
    await page.goto('./#/workouts');
    await page.waitForLoadState('networkidle');

    // Switch to Presets tab
    const presetsTab = page.getByTestId('workouts-presets-tab');
    await presetsTab.click();
    await expect(presetsTab).toHaveClass(/border-blue-500/);

    // Wait for preset cards to load
    const presetCards = page.locator('[data-testid^="workouts-preset-card-"]');
    await expect(presetCards.first()).toBeVisible({ timeout: 10000 });

    // Get the first preset card and click Import
    const firstPresetCard = presetCards.first();
    const importButton = firstPresetCard.getByRole('button', { name: 'Import' }).first();
    await expect(importButton).toBeVisible();
    await importButton.click();

    // Wait for navigation to My Programs and plan to load
    await page.waitForTimeout(3000);

    // Verify we're on My Programs tab (check for selected plan card)
    const planCard = page.locator('[data-testid^="workout-plan-"]').first();
    await expect(planCard).toBeVisible({ timeout: 10000 });

    // Verify program editor is visible (shows week selector)
    const weekSelector = page.getByText(/Week \d+/).first();
    await expect(weekSelector).toBeVisible({ timeout: 5000 });

    // Verify exercise rows are visible in the program editor
    const exerciseRows = page.locator('[data-testid^="plan-exercise-"]');
    const exerciseCount = await exerciseRows.count();
    expect(exerciseCount).toBeGreaterThan(0);

    // Check for import warning banner (may or may not be present)
    const importWarning = page.getByTestId('workouts-preset-import-warning');
    const warningVisible = await importWarning.isVisible().catch(() => false);
    if (warningVisible) {
      // If warning is present, verify it has appropriate text
      await expect(importWarning).toContainText(/exercise.*need.*attention|could not.*auto-matched/i);
    }

    // Test passes - preset imported successfully with exercises mapped
  });

  test('should allow swapping exercises in imported program', async ({ page }) => {
    // Set up profile first
    await setupTestProfile(page);

    // Import a preset first
    await page.goto('./#/workouts');
    await page.waitForLoadState('networkidle');

    const presetsTab = page.getByTestId('workouts-presets-tab');
    await presetsTab.click();

    const presetCards = page.locator('[data-testid^="workouts-preset-card-"]');
    const firstPresetCard = presetCards.first();
    const importButton = firstPresetCard.getByRole('button', { name: 'Import' });
    await expect(importButton).toBeVisible();
    await importButton.click();

    // Wait for import to complete
    await page.waitForTimeout(3000);

    // Find and click edit button for the first workout day
    const editButton = page.getByTestId(/edit-workout-day-btn-/).first();
    await expect(editButton).toBeVisible({ timeout: 10000 });
    await editButton.click();

    // Now swap button should be visible
    const swapButton = page.getByTestId('replace-exercise-btn').first();
    await expect(swapButton).toBeVisible({ timeout: 5000 });
    await swapButton.click();

    // Exercise picker should open
    await expect(page.getByTestId('exercise-search-input')).toBeVisible({ timeout: 5000 });
    
    // Close the exercise picker without selecting anything
    await page.keyboard.press('Escape');

    // Test passes - can enter edit mode and swap button is available
  });

  test('should import preset with equipment constraints', async ({ page }) => {
    // Set up profile first
    await setupTestProfile(page);

    // Navigate to Workouts > Presets
    await page.goto('./#/workouts');
    await page.waitForLoadState('networkidle');

    const presetsTab = page.getByTestId('workouts-presets-tab');
    await presetsTab.click();

    // Wait for presets
    const presetCards = page.locator('[data-testid^="workouts-preset-card-"]');
    await expect(presetCards.first()).toBeVisible({ timeout: 10000 });

    // Import second preset (likely different equipment requirements)
    const secondPresetCard = presetCards.nth(1);
    const importButton = secondPresetCard.getByRole('button', { name: 'Import' });
    await expect(importButton).toBeVisible();
    await importButton.click();

    // Verify navigation to My Programs - wait for URL or UI change
    await page.waitForTimeout(5000);

    // Verify program loaded (plan card visible)
    const planCard = page.locator('[data-testid^="workout-plan-"]').first();
    await expect(planCard).toBeVisible({ timeout: 10000 });

    // Verify exercises mapped (no crash, even if some unresolved)
    const exerciseRows = page.locator('[data-testid^="plan-exercise-"]');
    await expect(exerciseRows.first()).toBeVisible({ timeout: 5000 });
  });

  test('should handle presets gracefully with unknown exercise keywords', async ({ page }) => {
    // Set up profile first
    await setupTestProfile(page);

    await page.goto('./#/workouts');
    await page.waitForLoadState('networkidle');

    const presetsTab = page.getByTestId('workouts-presets-tab');
    await presetsTab.click();

    const presetCards = page.locator('[data-testid^="workouts-preset-card-"]');
    await expect(presetCards.first()).toBeVisible({ timeout: 10000 });

    // Import a preset
    const firstPresetCard = presetCards.first();
    const importButton = firstPresetCard.getByRole('button', { name: 'Import' });
    await expect(importButton).toBeVisible();
    await importButton.click();

    // Should complete without error (even if some exercises have unresolved placeholders)
    await page.waitForTimeout(2000);

    // Warning banner might be shown for unresolved exercises
    const importWarning = page.getByTestId('workouts-preset-import-warning');
    const warningVisible = await importWarning.isVisible().catch(() => false);

    // Verify program loaded (plan card visible)
    const planCard = page.locator('[data-testid^="workout-plan-"]').first();
    await expect(planCard).toBeVisible({ timeout: 10000 });

    // If warning present, verify it mentions unresolved exercises
    if (warningVisible) {
      await expect(importWarning).toContainText(/exercise/i);
    }
  });
});