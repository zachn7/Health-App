import { expect, test } from '@playwright/test';
import { testIds } from '../../src/testIds';
import { bootstrapAppState } from './helpers/bootstrap';

test.describe('Regression: Workout Logger Always Editable (R10)', () => {
  test.beforeEach(async ({ context }) => {
    await bootstrapAppState(context, { completeOnboarding: true });
  });
  test('should allow editing sets/reps after finishing workout', async ({ page }) => {
    // Navigate to workout logger
    await page.goto('./#/log/workout');
    await page.waitForLoadState('networkidle');
    
    // Click "Manual Workout" to enter manual mode
    const manualWorkoutBtn = page.locator('button', { hasText: 'Manual Workout' });
    if (await manualWorkoutBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await manualWorkoutBtn.click();
      await expect(page.getByTestId(testIds.workoutLogger.addExerciseBtn)).toBeVisible({ timeout: 10_000 });
    }
    
    // Add an exercise manually
    const addExerciseBtn = page.getByTestId(testIds.workoutLogger.addExerciseBtn);
    await expect(addExerciseBtn).toBeVisible({ timeout: 5000 });
    await addExerciseBtn.click();

    // Search for and select an exercise
    const searchInput = page.getByTestId('exercise-search-input');
    await expect(searchInput).toBeVisible({ timeout: 10_000 });
    await searchInput.fill('squat');

    const firstResult = page.getByTestId('exercise-results-list').locator('[data-testid^="exercise-result-"]').first();
    await expect(firstResult).toBeVisible({ timeout: 10_000 });
    await firstResult.click();

    // Add a set
    const exerciseRow = page.getByTestId(testIds.workoutLogger.exerciseRow(0));
    await expect(exerciseRow).toBeVisible({ timeout: 5000 });
    
    // When exercise has no sets, button is "Add First Set"
    const addFirstSetButton = exerciseRow.getByRole('button', { name: 'Add First Set' });
    await expect(addFirstSetButton).toBeVisible({ timeout: 5000 });
    await addFirstSetButton.click();

    // After adding first set, button becomes "Add Set"
    const addSetButton = exerciseRow.getByRole('button', { name: 'Add Set' });
    await expect(addSetButton).toBeVisible({ timeout: 5000 });
    
    // Enter a rep value
    const allInputs = exerciseRow.locator('input[type="number"]');
    await expect(allInputs.first()).toBeVisible({ timeout: 5000 });
    await allInputs.first().fill('10');

    // Save the workout
    const saveBtn = page.locator('button', { hasText: 'Save Workout' });
    await expect(saveBtn).toBeVisible({ timeout: 5000 });
    await saveBtn.click();

    // Verify the workout is saved (shows "Workout Complete" status)
    await expect(page.getByTestId(testIds.workoutLogger.workoutCompleteStatus)).toBeVisible({ timeout: 5000 });
    
    // KEY TEST: Verify inputs are still enabled (not disabled) after saving
    await expect(allInputs.first()).toBeEnabled();
    
    // Edit the rep value to prove functionality remains
    await allInputs.first().fill('12');
    await expect(allInputs.first()).toHaveValue('12');
    
    // Add another set to prove full functionality remains
    await addSetButton.click();

    await expect.poll(async () => await allInputs.count(), { timeout: 5_000 }).toBe(4);
    const finalCount = await allInputs.count();
    expect(finalCount).toBe(4); // 2 sets x 2 inputs (reps + weight)
    
    console.log('✅ Workout remains fully editable after saving (no lockout!)');
  });
  
  test('should support optional timer: start/stop creates and saves time entry', async ({ page }) => {
    // Navigate to workout logger in manual mode
    await page.goto('./#/log/workout');
    await page.waitForLoadState('networkidle');
    
    // Click "Manual Workout" to enter manual mode
    const manualWorkoutBtn = page.locator('button', { hasText: 'Manual Workout' });
    if (await manualWorkoutBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await manualWorkoutBtn.click();
      await expect(page.getByTestId(testIds.workoutLogger.timerStart)).toBeVisible({ timeout: 10_000 });
    }
    
    // Click Start Timer button
    const startTimerBtn = page.getByTestId(testIds.workoutLogger.timerStart);
    await expect(startTimerBtn).toBeVisible({ timeout: 5000 });
    await startTimerBtn.click();

    // Verify timer buttons changed (Stop Timer is now visible instead of Start)
    const stopTimerBtn = page.getByTestId(testIds.workoutLogger.timerStop);
    await expect(stopTimerBtn).toBeVisible({ timeout: 5000 });
    await expect(startTimerBtn).not.toBeVisible();
    
    // Verify time entry section appears with active timer
    await expect(page.getByTestId(testIds.workoutLogger.timeSection)).toBeVisible();
    const timeEntry = page.getByTestId(testIds.workoutLogger.timeEntry(0));
    await expect(timeEntry).toBeVisible();
    await expect(timeEntry).toContainText('Active');
    
    // Stop the timer
    await stopTimerBtn.click();

    // Verify timer stopped (shows duration)
    await expect(timeEntry).not.toContainText('Active', { timeout: 10_000 });
    const timeEntryText = await timeEntry.textContent();
    expect(timeEntryText).not.toContain('Active');
    expect(timeEntryText).toMatch(/\d+ min/);
    
    console.log(`Time entry: ${timeEntryText}`);
    
    // Add an exercise to save with timer
    const addExerciseBtn = page.getByTestId(testIds.workoutLogger.addExerciseBtn);
    await addExerciseBtn.click();

    const searchInput = page.getByTestId('exercise-search-input');
    await expect(searchInput).toBeVisible({ timeout: 10_000 });
    await searchInput.fill('bench');

    const firstResult = page.getByTestId('exercise-results-list').locator('[data-testid^="exercise-result-"]').first();
    await expect(firstResult).toBeVisible({ timeout: 10_000 });
    await firstResult.click();

    // Try to add a set if the button is visible
    const exerciseRow = page.getByTestId(testIds.workoutLogger.exerciseRow(0));
    const addSetBtn = exerciseRow.locator('button', { hasText: 'Add Set' }).first();
    if (await addSetBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await addSetBtn.click();
    }
    
    // Enter any rep value
    const repsInput = exerciseRow.locator('input[type="number"]').first();
    if (await repsInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await repsInput.fill('10');
    }
    
    const saveBtn = page.locator('button', { hasText: 'Save Workout' });
    await expect(saveBtn).toBeVisible({ timeout: 5000 });
    await saveBtn.click();
    await expect(page.getByTestId(testIds.workoutLogger.workoutCompleteStatus)).toBeVisible({ timeout: 10_000 });

    // Reload page to verify timer entry persisted
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Verify time entry is still visible after reload
    await expect(page.getByTestId(testIds.workoutLogger.timeSection)).toBeVisible();
    const persistedTimeEntry = page.getByTestId(testIds.workoutLogger.timeEntry(0));
    await expect(persistedTimeEntry).toBeVisible();
    
    const persistedText = await persistedTimeEntry.textContent();
    console.log(`Persisted time entry: ${persistedText}`);
    
    console.log('✅ Timer entry created and persisted successfully');
  });
  
  test('should allow deleting timer entries', async ({ page }) => {
    // Navigate to workout logger
    await page.goto('./#/log/workout');
    await page.waitForLoadState('networkidle');
    
    // Click "Manual Workout" if visible to ensure timer is accessible
    const manualWorkoutBtn = page.locator('button', { hasText: 'Manual Workout' });
    if (await manualWorkoutBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await manualWorkoutBtn.click();
      await expect(page.getByTestId(testIds.workoutLogger.timerStart)).toBeVisible({ timeout: 10_000 });
    }
    
    // Start and stop a timer to create an entry
    const startTimerBtn = page.getByTestId(testIds.workoutLogger.timerStart);
    await startTimerBtn.click();

    const stopTimerBtn = page.getByTestId(testIds.workoutLogger.timerStop);
    await expect(stopTimerBtn).toBeVisible({ timeout: 10_000 });
    await stopTimerBtn.click();

    // Verify time entry exists
    await expect(page.getByTestId(testIds.workoutLogger.timeSection)).toBeVisible();
    const timeEntry = page.getByTestId(testIds.workoutLogger.timeEntry(0));
    await expect(timeEntry).toBeVisible();
    
    // Find and click the delete button
    const deleteBtn = page.getByTestId(testIds.workoutLogger.timeEntryDelete(0));
    await expect(deleteBtn).toBeVisible();
    await deleteBtn.click();

    // Verify time entry is removed (section should be gone now)
    await expect(page.getByTestId(testIds.workoutLogger.timeSection)).not.toBeVisible();
    
    console.log('✅ Timer entry deleted successfully');
  });
  
  test('should allow multiple timer entries in a single workout', async ({ page }) => {
    // Navigate to workout logger in manual mode
    await page.goto('./#/log/workout');
    await page.waitForLoadState('networkidle');
    
    // Click "Manual Workout" to enter manual mode
    const manualWorkoutBtn = page.locator('button', { hasText: 'Manual Workout' });
    if (await manualWorkoutBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await manualWorkoutBtn.click();
      await expect(page.getByTestId(testIds.workoutLogger.timerStart)).toBeVisible({ timeout: 10_000 });
    }
    
    // Start and stop first timer
    const startTimerBtn = page.getByTestId(testIds.workoutLogger.timerStart);
    await startTimerBtn.click();

    const stopTimerBtn = page.getByTestId(testIds.workoutLogger.timerStop);
    await expect(stopTimerBtn).toBeVisible({ timeout: 10_000 });
    await stopTimerBtn.click();
    
    // Start and stop second timer
    await startTimerBtn.click();
    await expect(stopTimerBtn).toBeVisible({ timeout: 10_000 });
    await stopTimerBtn.click();
    
    // Verify we have 2 time entries
    await expect(page.getByTestId(testIds.workoutLogger.timeSection)).toBeVisible();
    
    const timeEntry0 = page.getByTestId(testIds.workoutLogger.timeEntry(0));
    const timeEntry1 = page.getByTestId(testIds.workoutLogger.timeEntry(1));
    
    await expect(timeEntry0).toBeVisible();
    await expect(timeEntry1).toBeVisible();
    
    const entry0Text = await timeEntry0.textContent();
    const entry1Text = await timeEntry1.textContent();
    
    console.log(`Entry 1: ${entry0Text}`);
    console.log(`Entry 2: ${entry1Text}`);
    
    console.log('✅ Multiple timer entries work correctly');
  });
});