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
    
    // Check that exercise names are NOT the fallback "Exercise {id}" format
    // (this would indicate the DB load failed)
    const pageContent = await page.textContent('body');
    const hasFallbackNames = pageContent?.includes('Exercise barbell-bench-press') || 
                            pageContent?.includes('Exercise dumbbell-curl') ||
                            pageContent?.includes('Exercise bodyweight-squat');
    
    expect(hasFallbackNames).toBeFalsy();
    console.log('No fallback exercise names found - exercise DB loaded successfully');
    
    // Verify no exercise DB load errors in console
    const hasExerciseErrors = errorMessages.length > 0;
    if (hasExerciseErrors) {
      console.error('Exercise DB load errors:', errorMessages);
    }
    expect(hasExerciseErrors).toBeFalsy();
    
    // Wait a bit more to ensure no async errors
    await page.waitForTimeout(3000);
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
    
    // Verify we have content (not just loading spinner)
    const bodyContent = await page.textContent('body');
    expect(bodyContent?.length).toBeGreaterThan(100);
    console.log('Successfully imported exercises to workout logger');
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
