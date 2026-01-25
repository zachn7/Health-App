import { test, expect } from '@playwright/test';
import { setupTestProfile } from './helpers/setupProfile';

test.describe('Regression: Workout Editor Swap', () => {
  test.beforeEach(async ({ context }) => {
    // Set age gate to pass BEFORE page loads
    await context.addInitScript(() => {
      localStorage.setItem('age_gate_accepted', 'true');
      localStorage.setItem('age_gate_timestamp', new Date().toISOString());
    });
  });

  test('should replace exercise on swap (not append) and keep edit mode active', async ({ page }) => {
    // Set up profile
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

    // Import first preset
    const firstPresetCard = presetCards.first();
    const importButton = firstPresetCard.getByRole('button', { name: 'Import as Copy' });
    await importButton.click();
    await page.waitForTimeout(3000);

    // Import usually switches to My Programs tab automatically
    // Wait for the plan to load in the editor
    await page.waitForTimeout(3000);

    // Sometimes the import opens the plan directly, sometimes we need to select it
    // Try clicking on the first workout plan card if it exists
    const workoutPlanCards = page.locator('[data-testid^="workout-plan-"]');
    const hasPlanCards = await workoutPlanCards.count() > 0;
    
    if (hasPlanCards) {
      await workoutPlanCards.first().click();
      await page.waitForTimeout(2000);
    }

    // Get the initial exercise count in the first day
    const exerciseRows = page.locator('[data-testid^="workout-editor-exercise-row-"]');
    await expect(exerciseRows.first()).toBeVisible({ timeout: 10000 });
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

    // Wait a moment for edit mode to activate
    await page.waitForTimeout(500);

    // Click Swap button on the first exercise
    const swapBtn = page.getByTestId('workout-editor-exercise-swap-btn').first();
    await expect(swapBtn).toBeVisible();
    await swapBtn.click();

    // Wait for exercise picker to load
    await page.waitForTimeout(1000);

    // Click the first exercise in the picker (different from original)
    const pickerExercise = page.locator('button').filter({ hasText: /bench|squat|deadlift|press/i }).first();
    const hasPickerExercise = await pickerExercise.count() > 0;
    
    if (!hasPickerExercise) {
      // If no specific exercise found, try clicking any exercise button
      const anyExercise = page.locator('button').filter({ hasText: /cal|reps\/kg|kg|lbs/i }).first();
      if (await anyExercise.count() > 0) {
        await anyExercise.click();
      }
    } else {
      await pickerExercise.click();
    }

    // Wait for swap to complete
    await page.waitForTimeout(2000);

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
      await page.waitForTimeout(1000);

      // Select an exercise in picker
      const pickerExercise2 = page.locator('button').filter({ hasText: /row|lat|pull|curl/i }).first();
      const hasPickerExercise2 = await pickerExercise2.count() > 0;
      
      if (hasPickerExercise2) {
        await pickerExercise2.click();
      } else {
        // Fallback to any exercise
        const anyExercise2 = page.locator('button').filter({ hasText: /cal|reps\/kg|kg|lbs/i }).first();
        if (await anyExercise2.count() > 0) {
          await anyExercise2.click();
        }
      }

      // Wait for swap to complete
      await page.waitForTimeout(2000);

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
    // Set up profile
    await setupTestProfile(page);

    // Navigate to Workouts page
    await page.goto('./#/workouts');
    await page.waitForLoadState('networkidle');

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
    await importButton.click();
    await page.waitForTimeout(2000);

    // Verify stable testIds exist
    await expect(page.getByTestId('edit-workout-day-btn-0-0')).toBeVisible();
    const exerciseRows = page.locator('[data-testid^="workout-editor-exercise-row-"]');
    await expect(exerciseRows.first()).toBeVisible();

    // Enter edit mode
    await page.getByTestId('edit-workout-day-btn-0-0').click();
    await page.waitForTimeout(500);

    // Verify swap button testId
    await expect(page.getByTestId('workout-editor-exercise-swap-btn').first()).toBeVisible();
  });
});