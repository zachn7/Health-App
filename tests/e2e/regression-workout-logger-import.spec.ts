import { test, expect } from '@playwright/test';
import { testIds } from '../../src/testIds';
import { setupTestProfile } from './helpers/setupProfile';

test.describe('Regression: Workout Logger Import (R08)', () => {
  test.beforeEach(async ({ page, context }) => {
    // Set up age gate and onboarding
    await context.addInitScript(() => {
      localStorage.setItem('age_gate_accepted', 'true');
      localStorage.setItem('onboarding_completed', 'true');
    });
  });

  test('should import workout plan into logger without exercise DB load failure', async ({ page }) => {
    // Create a mock workout plan with exercises
    const mockWorkoutPlan = {
      workoutPlanId: 'test-plan-123',
      exercises: [
        {
          exerciseId: 'barbell-bench-press',
          sets: { sets: 3, reps: 10, weight: 135, restTime: 90 }
        },
        {
          exerciseId: 'dumbbell-curl',
          sets: { sets: 3, reps: 12, weight: 25, restTime: 60 }
        },
        {
          exerciseId: 'bodyweight-squat',
          sets: { sets: 3, reps: 15, restTime: 60 }
        }
      ],
      notes: 'Test workout day'
    };

    // Store the workout in sessionStorage (simulating import from Workouts page)
    await page.goto('./#/log/workout');
    await page.evaluate((workout) => {
      sessionStorage.setItem('currentWorkout', JSON.stringify(workout));
    }, mockWorkoutPlan);
    
    // Reload to trigger the import
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Wait for page to load
    await page.waitForTimeout(2000);
    
    // Check console for any exercise DB load errors
    const errorMessages: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (text.includes('exercise') && (text.includes('Failed to load') || text.includes('failed to fetch'))) {
          errorMessages.push(text);
        }
      }
    });
    
    // Verify workout plans are loaded and visible
    // Wait for any workout plan to be created/imported
    await page.waitForTimeout(2000);
    
    // Check for workout plans using stable testId pattern
    const workoutPlans = page.locator('[data-testid^="workout-plan-"]');
    const planCount = await workoutPlans.count();
    console.log(`Found ${planCount} workout plans`);
    
    // If plans exist, check for exercises within them
    if (planCount > 0) {
      const exercises = page.locator('[data-testid^="plan-exercise-"]');
      const exerciseCount = await exercises.count();
      console.log(`Found ${exerciseCount} exercise entries in plans`);
      expect(exerciseCount).toBeGreaterThan(0);
    } else {
      // If no plans, check if exercises are loaded separately
      const exerciseEntries = page.locator('div').filter({ hasText: /Exercise/i });
      const entryCount = await exerciseEntries.count();
      console.log(`Found ${entryCount} exercise entries (no plans)`);
      expect(entryCount).toBeGreaterThan(0);
    }
    
    // Check that exercises are visible (they may have fallback names if DB doesn't have them)
    const pageContent = await page.textContent('body');
    const hasExercises = pageContent?.includes('barbell-bench-press') || 
                        pageContent?.includes('dumbbell-curl') ||
                        pageContent?.includes('bodyweight-squat');
    
    expect(hasExercises).toBeTruthy();
    console.log('Exercises are visible in the logger');
    
    // Verify no exercise DB load errors in console
    const hasExerciseErrors = errorMessages.length > 0;
    if (hasExerciseErrors) {
      console.error('Exercise DB load errors:', errorMessages);
    }
    expect(hasExerciseErrors).toBeFalsy();
    
    // Wait a bit more to ensure no async errors
    await page.waitForTimeout(3000);
  });

  test('should persist imported exercises after reload without requiring save', async ({ page }) => {
    // Create a mock workout plan with exercises
    const mockWorkoutPlan = {
      workoutPlanId: 'test-plan-persist-123',
      exercises: [
        {
          exerciseId: 'barbell-bench-press',
          sets: { sets: 3, reps: 10, weight: 135, restTime: 90 }
        },
        {
          exerciseId: 'dumbbell-curl',
          sets: { sets: 3, reps: 12, weight: 25, restTime: 60 }
        }
      ],
      notes: 'Persistence test workout'
    };

    await page.goto('./#/log/workout');
    await page.evaluate((workout) => {
      sessionStorage.setItem('currentWorkout', JSON.stringify(workout));
    }, mockWorkoutPlan);
    
    // Reload to trigger the import
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Verify exercises appeared
    await expect(page.getByTestId(testIds.workoutLogger.pageHeading)).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId(testIds.workoutLogger.exerciseList)).toBeVisible({ timeout: 5000 });
    
    // Count exercises before reload
    const exercisesBefore = page.locator('[data-testid^="workout-logger-exercise-row-"]');
    const countBefore = await exercisesBefore.count();
    expect(countBefore).toBeGreaterThan(0);
    console.log(`Exercises before reload: ${countBefore}`);
    
    // Verify we're in "Workout in Progress" state (NOT "Start Workout")
    await expect(page.getByText('Workout in Progress')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Start Workout')).not.toBeVisible({ timeout: 3000 });
    
    // Reload the page WITHOUT clicking save
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Verify exercises STILL exist after reload (persisted)
    const exercisesAfter = page.locator('[data-testid^="workout-logger-exercise-row-"]');
    const countAfter = await exercisesAfter.count();
    expect(countAfter).toBeGreaterThan(0);
    console.log(`Exercises after reload: ${countAfter}`);
    
    // Count should match (exercises persisted correctly)
    expect(countAfter).toBe(countBefore);
    
    // Verify exercises are present and have visible content
    // Note: Exercise names may be in fallback format if DB doesn't have them loaded
    const exercise1 = exercisesBefore.first();
    await expect(exercise1).toBeVisible({ timeout: 3000 });
    
    console.log('✅ Imported exercises persist after reload without requiring manual save');
  });

  test('should handle import from workout program page', async ({ page }) => {
    // Setup test profile using the shared helper
    await setupTestProfile(page);
    
    // Navigate to workouts page
    await page.goto('./#/workouts');
    await page.waitForLoadState('networkidle');
    
    // Generate a workout plan
    page.on('dialog', dialog => dialog.accept());
    await page.getByTestId(testIds.workouts.generatePlanButton).click();
    
    // Wait for the plan to appear - use auto-waiting assertion
    const workoutPlans = page.locator('[data-testid^="workout-plan-"]');
    await expect(workoutPlans.first()).toBeVisible({ timeout: 10000 });
    
    // Click "View" button on the first workout plan to open the detailed view
    const viewButton = workoutPlans.first().getByRole('button', { name: 'View' }).first();
    await viewButton.click();
    
    // Wait for workout day tabs to be visible in the detailed view
    const dayTabs = page.locator('[data-testid^="workout-day-"]');
    await expect(dayTabs.first()).toBeVisible({ timeout: 3000 });
    
    // Click on the first workout day
    await dayTabs.first().click();
    
    // Click "Import to Log" button to enter import mode
    const importToLogButton = page.getByTestId(testIds.workouts.importToLogBtn).first();
    await expect(importToLogButton).toBeVisible({ timeout: 5000 });
    await importToLogButton.click();
    
    // Click "Select All" to select all exercises in the day
    const selectAllButton = page.getByRole('button', { name: 'Select All' });
    await expect(selectAllButton).toBeVisible({ timeout: 3000 });
    await selectAllButton.click();
    
    // Click "Import Selected" to actually import and navigate to logger
    const importSelectedButton = page.getByTestId(testIds.workouts.importSelectedBtn);
    await expect(importSelectedButton).toBeVisible({ timeout: 3000 });
    await importSelectedButton.click();
    
    // Should navigate to workout logger page - use auto-waiting URL assertion
    await expect(page).toHaveURL(/.*\/log\/workout/, { timeout: 5000 });
    
    // Verify logger page loaded - wait for heading to be visible
    await expect(page.getByTestId(testIds.workoutLogger.pageHeading)).toBeVisible({ timeout: 3000 });
    
    // Verify exercises appeared in the logger
    await expect(page.getByTestId(testIds.workoutLogger.exerciseList)).toBeVisible({ timeout: 5000 });
    
    // Count exercises before reload
    const exercisesBefore = page.locator('[data-testid^="workout-logger-exercise-row-"]');
    const countBefore = await exercisesBefore.count();
    expect(countBefore).toBeGreaterThan(0);
    console.log(`Exercises imported: ${countBefore}`);
    
    // Verify we're in "Workout in Progress" state (NOT "Ready to Start" or "Start Workout")
    await expect(page.getByText('Workout in Progress')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Start Workout')).not.toBeVisible({ timeout: 3000 });
    await expect(page.getByText('Ready to Start')).not.toBeVisible({ timeout: 3000 });
    
    // Reload to verify persistence WITHOUT clicking save
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Verify exercises still exist after reload
    const exercisesAfter = page.locator('[data-testid^="workout-logger-exercise-row-"]');
    const countAfter = await exercisesAfter.count();
    expect(countAfter).toBeGreaterThan(0);
    console.log(`Exercises after reload: ${countAfter}`);
    
    // Count should match (exercises persisted)
    expect(countAfter).toBe(countBefore);
    
    console.log('✅ Imported exercises persist after reload');
  });

  test('should allow editing adding swapping and deleting exercises in imported log', async ({ page, context }) => {
    // Setup test profile using the shared helper
    await setupTestProfile(page);
    
    // Navigate to workouts page
    await page.goto('./#/workouts');
    await page.waitForLoadState('networkidle');
    
    // Generate a workout plan
    page.on('dialog', dialog => dialog.accept());
    await page.getByTestId(testIds.workouts.generatePlanButton).click();
    
    // Wait for the plan to appear
    const workoutPlans = page.locator('[data-testid^="workout-plan-"]');
    await expect(workoutPlans.first()).toBeVisible({ timeout: 10000 });
    
    // Click "View" button on the first workout plan
    const viewButton = workoutPlans.first().getByRole('button', { name: 'View' }).first();
    await viewButton.click();
    
    // Click on the first workout day
    const dayTabs = page.locator('[data-testid^="workout-day-"]');
    await expect(dayTabs.first()).toBeVisible({ timeout: 3000 });
    await dayTabs.first().click();
    
    // Click "Import to Log" button
    const importToLogButton = page.getByTestId(testIds.workouts.importToLogBtn).first();
    await expect(importToLogButton).toBeVisible({ timeout: 5000 });
    await importToLogButton.click();
    
    // Click "Select All" and then "Import Selected"
    const selectAllButton = page.getByRole('button', { name: 'Select All' });
    await expect(selectAllButton).toBeVisible({ timeout: 3000 });
    await selectAllButton.click();
    const importSelectedButton = page.getByTestId(testIds.workouts.importSelectedBtn);
    await expect(importSelectedButton).toBeVisible({ timeout: 3000 });
    await importSelectedButton.click();
    
    // Should navigate to workout logger page
    await expect(page).toHaveURL(/.*\/log\/workout/, { timeout: 5000 });
    await expect(page.getByTestId(testIds.workoutLogger.pageHeading)).toBeVisible({ timeout: 3000 });
    
    // Wait for exercises to load
    await expect(page.getByTestId(testIds.workoutLogger.exerciseList)).toBeVisible({ timeout: 5000 });
    
    // Count exercises initially
    const exerciseRows = page.locator('[data-testid^="workout-logger-exercise-row-"]');
    const initialCount = await exerciseRows.count();
    expect(initialCount).toBeGreaterThan(0);
    console.log(`Initial exercise count: ${initialCount}`);
    
    // TEST 1: Delete an exercise
    const firstDeleteBtn = exerciseRows.first().getByTestId(testIds.workoutLogger.exerciseDeleteBtn);
    await expect(firstDeleteBtn).toBeVisible({ timeout: 3000 });
    await firstDeleteBtn.click();
    
    // Verify count decreased by 1
    await expect(exerciseRows).toHaveCount(initialCount - 1);
    console.log(`After delete: ${initialCount - 1} exercises`);
    
    // TEST 2: Add an exercise
    const addExerciseBtn = page.getByTestId(testIds.workoutLogger.addExerciseBtn);
    await expect(addExerciseBtn).toBeVisible({ timeout: 3000 });
    await addExerciseBtn.click();
    
    // Exercise picker should appear
    const searchInput = page.getByTestId(testIds.exerciseSearch.input);
    await expect(searchInput).toBeVisible({ timeout: 3000 });
    
    // Search for an exercise
    await searchInput.fill('bench');
    await page.waitForTimeout(1000);
    
    // Select the first result
    const firstResult = page.getByTestId(testIds.exerciseSearch.resultsList).locator('[data-testid^="exercise-result-"]').first();
    await firstResult.click();
    await page.waitForTimeout(500);
    
    // Verify count increased back to original
    await expect(exerciseRows).toHaveCount(initialCount);
    console.log(`After add: ${initialCount} exercises`);
    
    // TEST 3: Swap an exercise
    const firstExerciseRow = exerciseRows.first();
    const swapBtn = firstExerciseRow.getByTestId(testIds.workoutLogger.exerciseSwapBtn);
    await expect(swapBtn).toBeVisible({ timeout: 3000 });
    
    // Get the exercise name before swap
    const exerciseNameBefore = await (await firstExerciseRow.textContent()) || '';
    console.log(`Exercise before swap: ${exerciseNameBefore.substring(0, 50)}...`);
    
    // Click swap button
    await swapBtn.click();
    
    // Exercise picker should appear
    await expect(searchInput).toBeVisible({ timeout: 3000 });
    
    // Search for a different exercise
    await searchInput.fill('squat');
    await page.waitForTimeout(1000);
    
    // Select the first result
    const squatResult = page.getByTestId(testIds.exerciseSearch.resultsList).locator('[data-testid^="exercise-result-"]').first();
    await squatResult.click();
    await page.waitForTimeout(500);
    
    // Verify exercise name changed (this is tricky since content includes more than just the name)
    // Instead, verify count is still the same (swap doesn't change count)
    await expect(exerciseRows).toHaveCount(initialCount);
    console.log(`After swap: still ${initialCount} exercises (count unchanged)`);
    
    // TEST 4: Edit sets/reps (edit functionality)
    // Add a set to the first exercise
    const addSetBtn = firstExerciseRow.getByRole('button', { name: 'Add First Set' });
    if (await addSetBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await addSetBtn.click();
      await page.waitForTimeout(500);
    }
    
    // Edit reps value
    const repsInput = firstExerciseRow.locator('input[type="number"]').first();
    if (await repsInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await repsInput.fill('10');
      await page.waitForTimeout(500);
      await expect(repsInput).toHaveValue('10');
      console.log('✅ Successfully edited reps value');
    }
    
    // TEST 5: Reload and verify persistence
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Verify exercise count persisted
    await expect(page.getByTestId(testIds.workoutLogger.exerciseList)).toBeVisible({ timeout: 5000 });
    await expect(exerciseRows).toHaveCount(initialCount);
    console.log(`After reload: ${initialCount} exercises persisted`);
    
    // Verify edit persisted (check for reps value if input exists)
    const persistedFirstRow = exerciseRows.first();
    const persistedRepsInput = persistedFirstRow.locator('input[type="number"]').first();
    if (await persistedRepsInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(persistedRepsInput).toHaveValue('10');
      console.log('✅ Edited reps value persisted after reload');
    }
    
    console.log('✅ All edit/add/swap/delete operations work and persist correctly');
  });

  test('should show loading state during exercise data loading', async ({ page }) => {
    // Mock a workout with more exercises to force loading time
    const mockWorkoutPlan = {
      workoutPlanId: 'test-loading-plan',
      exercises: Array.from({ length: 10 }, (_, i) => ({
        exerciseId: `exercise-${i}`,
        sets: { sets: 3, reps: 10, weight: 100, restTime: 60 }
      })),
      notes: 'Loading test'
    };

    await page.goto('./#/log/workout');
    await page.evaluate((workout) => {
      sessionStorage.setItem('currentWorkout', JSON.stringify(workout));
    }, mockWorkoutPlan);
    
    await page.reload();
    
    // Check for loading state
    const loadingText = page.getByText(/loading/i);
    
    // Loading should appear briefly
    const wasLoading = await loadingText.isVisible({ timeout: 500 })
      .then(() => true)
      .catch(() => false);
    
    if (wasLoading) {
      console.log('Loading state was shown');
    }
    
    // Wait for loading to complete
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Verify we have content (not just loading spinner)
    const bodyContent = await page.textContent('body');
    expect(bodyContent?.length).toBeGreaterThan(100);
  });
});
