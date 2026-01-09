import { expect, test } from '@playwright/test';
import { testIds } from '../../src/testIds';

test.describe('Regression: Workout Logger Always Editable (R10)', () => {
  test.beforeEach(async ({ page, context }) => {
    // Set up age gate and onboarding
    await context.addInitScript(() => {
      localStorage.setItem('age_gate_accepted', 'true');
      localStorage.setItem('onboarding_completed', 'true');
    });
  });
  test('should allow editing sets/reps after finishing workout', async ({ page }) => {
    // Navigate to workout logger
    await page.goto('./#/log/workout');
    await page.waitForLoadState('networkidle');
    
    // Click "Manual Workout" to enter manual mode
    const manualWorkoutBtn = page.locator('button', { hasText: 'Manual Workout' });
    if (await manualWorkoutBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await manualWorkoutBtn.click();
      await page.waitForTimeout(500);
    }
    
    // Add an exercise manually
    const addAnotherBtn = page.locator('button', { hasText: 'Add Another Exercise' });
    await expect(addAnotherBtn).toBeVisible({ timeout: 5000 });
    await addAnotherBtn.click();
    await page.waitForTimeout(500);
    
    // Search for and select an exercise
    const searchInput = page.getByTestId('exercise-search-input');
    await searchInput.fill('squat');
    await page.waitForTimeout(1000);
    
    const firstResult = page.getByTestId('exercise-results-list').locator('[data-testid^="exercise-result-"]').first();
    await firstResult.click();
    await page.waitForTimeout(1000);
    
    // Add a set
    const exerciseRow = page.getByTestId(testIds.workoutLogger.exerciseRow(0));
    await expect(exerciseRow).toBeVisible({ timeout: 5000 });
    
    // Look for 'Add Set' button anywhere in the row, not just a filtered button
    const addSetButton = exerciseRow.getByRole('button', { name: 'Add Set' });
    await expect(addSetButton).toBeVisible({ timeout: 5000 });
    await addSetButton.click();
    await page.waitForTimeout(1000);
    
    // Enter a rep value
    const allInputs = exerciseRow.locator('input[type="number"]');
    await expect(allInputs.first()).toBeVisible({ timeout: 5000 });
    await allInputs.first().fill('10');
    await page.waitForTimeout(500);
    
    // Save the workout
    const saveBtn = page.locator('button', { hasText: 'Save Workout' });
    await expect(saveBtn).toBeVisible({ timeout: 5000 });
    await saveBtn.click();
    await page.waitForTimeout(1000);
    
    // Verify the workout is saved (shows "Workout Complete" status)
    await expect(page.getByText('Workout Complete!')).toBeVisible({ timeout: 5000 });
    
    // KEY TEST: Verify inputs are still enabled (not disabled) after saving
    await expect(allInputs.first()).toBeEnabled();
    
    // Edit the rep value to prove functionality remains
    await allInputs.first().fill('12');
    await page.waitForTimeout(500);
    await expect(allInputs.first()).toHaveValue('12');
    
    // Add another set to prove full functionality remains
    await addSetButton.click();
    await page.waitForTimeout(500);
    
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
      await page.waitForTimeout(500);
    }
    
    // Click Start Timer button
    const startTimerBtn = page.getByTestId(testIds.workoutLogger.timerStart);
    await expect(startTimerBtn).toBeVisible({ timeout: 5000 });
    await startTimerBtn.click();
    await page.waitForTimeout(500);
    
    // Verify timer buttons changed (Stop Timer is now visible instead of Start)
    const stopTimerBtn = page.getByTestId(testIds.workoutLogger.timerStop);
    await expect(stopTimerBtn).toBeVisible({ timeout: 5000 });
    await expect(startTimerBtn).not.toBeVisible();
    
    // Verify time entry section appears with active timer
    await expect(page.getByTestId(testIds.workoutLogger.timeSection)).toBeVisible();
    const timeEntry = page.getByTestId(testIds.workoutLogger.timeEntry(0));
    await expect(timeEntry).toBeVisible();
    await expect(timeEntry).toContainText('Active');
    
    // Wait a moment then stop the timer
    await page.waitForTimeout(1000);
    await stopTimerBtn.click();
    await page.waitForTimeout(500);
    
    // Verify timer stopped (shows duration)
    const timeEntryText = await timeEntry.textContent();
    expect(timeEntryText).not.toContain('Active');
    expect(timeEntryText).toMatch(/\d+ min/);
    
    console.log(`Time entry: ${timeEntryText}`);
    
    // Add an exercise to save with timer
    const addAnotherBtn = page.locator('button', { hasText: 'Add Another Exercise' });
    await addAnotherBtn.click();
    await page.waitForTimeout(500);
    
    const searchInput = page.getByTestId('exercise-search-input');
    await searchInput.fill('bench');
    await page.waitForTimeout(1000);
    
    const firstResult = page.getByTestId('exercise-results-list').locator('[data-testid^="exercise-result-"]').first();
    await firstResult.click();
    await page.waitForTimeout(500);
    
    // Try to add a set if the button is visible
    const exerciseRow = page.getByTestId(testIds.workoutLogger.exerciseRow(0));
    const addSetBtn = exerciseRow.locator('button', { hasText: 'Add Set' }).first();
    if (await addSetBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await addSetBtn.click();
      await page.waitForTimeout(500);
    }
    
    // Enter any rep value
    const repsInput = exerciseRow.locator('input[type="number"]').first();
    if (await repsInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await repsInput.fill('10');
      await page.waitForTimeout(500);
    }
    
    const saveBtn = page.locator('button', { hasText: 'Save Workout' });
    await expect(saveBtn).toBeVisible({ timeout: 5000 });
    await saveBtn.click();
    await page.waitForTimeout(1000);
    
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
    
    // Click "Log Exercises Manually" if visible
    const manuallyBtn = page.locator('button', { hasText: 'Log Exercises Manually' });
    if (await manuallyBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await manuallyBtn.click();
      await page.waitForTimeout(500);
    }
    
    // Start and stop a timer to create an entry
    const startTimerBtn = page.getByTestId(testIds.workoutLogger.timerStart);
    await startTimerBtn.click();
    await page.waitForTimeout(1000);
    
    const stopTimerBtn = page.getByTestId(testIds.workoutLogger.timerStop);
    await stopTimerBtn.click();
    await page.waitForTimeout(500);
    
    // Verify time entry exists
    await expect(page.getByTestId(testIds.workoutLogger.timeSection)).toBeVisible();
    const timeEntry = page.getByTestId(testIds.workoutLogger.timeEntry(0));
    await expect(timeEntry).toBeVisible();
    
    // Find and click the delete button
    const deleteBtn = page.getByTestId(testIds.workoutLogger.timeEntryDelete(0));
    await expect(deleteBtn).toBeVisible();
    await deleteBtn.click();
    await page.waitForTimeout(500);
    
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
      await page.waitForTimeout(500);
    }
    
    // Start and stop first timer
    const startTimerBtn = page.getByTestId(testIds.workoutLogger.timerStart);
    await startTimerBtn.click();
    await page.waitForTimeout(1000);
    
    const stopTimerBtn = page.getByTestId(testIds.workoutLogger.timerStop);
    await stopTimerBtn.click();
    await page.waitForTimeout(500);
    
    // Start and stop second timer
    await startTimerBtn.click();
    await page.waitForTimeout(1000);
    await stopTimerBtn.click();
    await page.waitForTimeout(500);
    
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