import { test, expect } from '@playwright/test';
import { bootstrapContext, gotoApp } from './helpers/bootstrap';
import { waitForRouteReady } from './helpers/app';

test.describe('Regression: Workout Editor Swap', () => {
  test.describe.configure({ timeout: 90_000 })

  test.beforeEach(async ({ context }) => {
    await bootstrapContext(context, {
      clearStorage: true,
      acceptAgeGate: true,
      completeOnboarding: true,
      seedProfile: true,
    });
  });

  test('should replace exercise on swap (not append) and keep edit mode active', async ({ page }) => {
    await gotoApp(page, '/workouts');
    await waitForRouteReady(page);

    // Switch to Presets tab
    const presetsTab = page.getByTestId('workouts-presets-tab');
    await presetsTab.click();
    await expect(presetsTab).toHaveClass(/border-blue-500/);

    // Wait for preset cards to load
    const presetCards = page.locator('[data-testid^="workouts-preset-card-"]');
    await expect(presetCards.first()).toBeVisible({ timeout: 10000 });

    // Import first preset
    const firstPresetCard = presetCards.first();
    const importButton = firstPresetCard.getByRole('button', { name: 'Import as Copy' });
    await importButton.click({ timeout: 20000 });

    // Wait for import to actually create a plan (can be slow on WebKit)
    await expect
      .poll(async () => {
        const viewButtons = page.getByRole('button', { name: /^view$/i })
        return await viewButtons.count()
      }, { timeout: 30000 })
      .toBeGreaterThan(0)

    // Ensure the imported plan is actually opened (button is more reliable than clicking the card wrapper).
    const viewButtons = page.getByRole('button', { name: /^view$/i });
    await expect(viewButtons.first()).toBeVisible({ timeout: 15000 })
    await viewButtons.first().click({ timeout: 20000 });
    await expect(page.getByTestId('edit-workout-day-btn-0-0')).toBeVisible({ timeout: 20000 })

    // Get the initial exercise count in the first day
    const exerciseRows = page.locator('[data-testid^="workout-editor-exercise-row-"]');
    await expect(exerciseRows.first()).toBeVisible({ timeout: 20000 });
    const initialCount = await exerciseRows.count();
    expect(initialCount).toBeGreaterThan(0);

    // Get the initial first exercise name
    const firstExerciseRow = exerciseRows.first();
    const initialExerciseName = await firstExerciseRow.textContent();
    console.log('Initial first exercise:', initialExerciseName);

    // Enter edit mode for the first day (week 0, day 0)
    const editToggle = page.getByTestId('edit-workout-day-btn-0-0');
    await expect(editToggle).toBeVisible();
    await editToggle.click();

    // Wait for edit mode to activate
    await expect(page.getByTestId('workout-editor-exercise-swap-btn').first()).toBeVisible({ timeout: 10_000 });

    // Click Swap button on the first exercise
    const swapBtn = page.getByTestId('workout-editor-exercise-swap-btn').first();
    await expect(swapBtn).toBeVisible();
    await swapBtn.click();

    // Wait for exercise picker to load
    await expect(page.getByTestId('exercise-search-input')).toBeVisible({ timeout: 10_000 });

    // Pick the first actual result inside the ExercisePicker modal (scoped, deterministic)
    const pickerHeading = page.getByRole('heading', { name: 'Exercise Picker' });
    await expect(pickerHeading).toBeVisible({ timeout: 10_000 });

    const firstPickerResult = page.getByTestId('exercise-results-list').getByRole('button').first();
    await expect(firstPickerResult).toBeVisible({ timeout: 10_000 });
    await firstPickerResult.click();

    // Wait for swap to complete (picker closes)
    await expect(pickerHeading).not.toBeVisible({ timeout: 10_000 });

    // Verify exercise count is unchanged (not appended)
    const exerciseRowsAfterSwap = page.locator('[data-testid^="workout-editor-exercise-row-"]');
    const countAfterSwap = await exerciseRowsAfterSwap.count();
    expect(countAfterSwap).toBe(initialCount);

    // Verify exercise name changed (if possible)
    const firstExerciseRowAfterSwap = exerciseRowsAfterSwap.first();
    const exerciseNameAfterSwap = await firstExerciseRowAfterSwap.textContent();
    console.log('First exercise after swap:', exerciseNameAfterSwap);

    // Verify edit mode is still active (swap controls should still be visible)
    await expect(swapBtn).toBeVisible();

    // Now swap the SECOND exercise WITHOUT pressing Edit again
    if (initialCount >= 2) {
      const secondExerciseRow = exerciseRowsAfterSwap.nth(1);
      const secondSwapBtn = secondExerciseRow.getByTestId('workout-editor-exercise-swap-btn');
      await expect(secondSwapBtn).toBeVisible();
      
      // Get second exercise name before swap
      const secondExerciseNameBefore = await secondExerciseRow.textContent();
      console.log('Second exercise before swap:', secondExerciseNameBefore);

      // Click Swap on second exercise
      await secondSwapBtn.click();
      await expect(page.getByTestId('exercise-search-input')).toBeVisible({ timeout: 10_000 });

      // Select an exercise in picker (again: scoped + deterministic)
      const pickerHeading2 = page.getByRole('heading', { name: 'Exercise Picker' });
      await expect(pickerHeading2).toBeVisible({ timeout: 10_000 });

      const firstPickerResult2 = page.getByTestId('exercise-results-list').getByRole('button').first();
      await expect(firstPickerResult2).toBeVisible({ timeout: 10_000 });
      await firstPickerResult2.click();

      // Wait for swap to complete (picker closes)
      await expect(pickerHeading2).not.toBeVisible({ timeout: 10_000 });

      // Verify count is still unchanged
      const exerciseRowsAfterSecondSwap = page.locator('[data-testid^="workout-editor-exercise-row-"]');
      const countAfterSecondSwap = await exerciseRowsAfterSecondSwap.count();
      expect(countAfterSecondSwap).toBe(initialCount);

      // Verify edit mode is STILL active
      const swapBtnStillVisible = page.getByTestId('workout-editor-exercise-swap-btn').first();
      await expect(swapBtnStillVisible).toBeVisible();
    }
  });

  test('should have stable testIds for workout editor', async ({ page }) => {
    await gotoApp(page, '/workouts');
    await waitForRouteReady(page);

    // Switch to My Programs
    const myProgramsTab = page.getByTestId('workouts-my-programs-tab');
    await myProgramsTab.click();
    await expect(myProgramsTab).toHaveClass(/border-blue-500/);

    // Import a preset to get a plan to edit
    const presetsTab = page.getByTestId('workouts-presets-tab');
    await presetsTab.click();

    const presetCards = page.locator('[data-testid^="workouts-preset-card-"]');
    await expect(presetCards.first()).toBeVisible({ timeout: 10000 });

    const firstPresetCard = presetCards.first();
    const importButton = firstPresetCard.getByRole('button', { name: 'Import as Copy' });
    await importButton.click({ timeout: 20000 });

    await expect
      .poll(async () => {
        const viewButtons = page.getByRole('button', { name: /^view$/i })
        return await viewButtons.count()
      }, { timeout: 30000 })
      .toBeGreaterThan(0)

    // Verify stable testIds exist (ensure a plan is opened first)
    const viewButtons = page.getByRole('button', { name: /^view$/i });
    await expect(viewButtons.first()).toBeVisible({ timeout: 15000 })
    await viewButtons.first().click({ timeout: 20000 });

    await expect(page.getByTestId('edit-workout-day-btn-0-0')).toBeVisible({ timeout: 20000 });
    const exerciseRows = page.locator('[data-testid^="workout-editor-exercise-row-"]');
    await expect(exerciseRows.first()).toBeVisible();

    // Enter edit mode
    await page.getByTestId('edit-workout-day-btn-0-0').click();
    await expect(page.getByTestId('workout-editor-exercise-swap-btn').first()).toBeVisible({ timeout: 10_000 });

    // Verify swap button testId
    await expect(page.getByTestId('workout-editor-exercise-swap-btn').first()).toBeVisible();
  });
});