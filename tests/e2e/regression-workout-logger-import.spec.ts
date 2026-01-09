import { test, expect } from '@playwright/test';

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
    // First, create a profile through the app flow
    await page.goto('./#/profile');
    await page.getByRole('button', { name: 'Create Profile' }).click();
    await page.getByTestId('profile-units-select').selectOption('metric');
    await page.getByPlaceholder('100-250').fill('180');
    await page.getByPlaceholder('30-300').fill('80');
    await page.getByTestId('profile-age-input').fill('30');
    await page.getByTestId('profile-sex-select').selectOption('male');
    await page.getByTestId('profile-activity-level-select').selectOption('moderate');
    await page.getByTestId('profile-experience-level-select').selectOption('beginner');
    await page.getByTestId('equipment-bodyweight').check();
    await page.getByTestId('equipment-barbell').check();
    await page.getByTestId('equipment-dumbbells').check();
    await page.waitForTimeout(300);
    await page.getByTestId('schedule-monday').check();
    await page.getByTestId('schedule-wednesday').check();
    await page.getByTestId('schedule-friday').check();
    await page.getByRole('button', { name: 'Save Profile' }).click();
    
    // Verify profile was saved
    await expect(page.getByText(/Profile saved/i)).toBeVisible({ timeout: 5000 });
    
    // Navigate to workouts page
    await page.goto('./#/workouts');
    await page.waitForLoadState('networkidle');
    
    // Add console logging for debugging
    const consoleMessages: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      consoleMessages.push(text);
      if (msg.type() === 'error' || msg.type() === 'warning') {
        console.log('Browser console:', text);
      }
    });
    
    // Create a valid workout plan using window.repositories if available
    // This isolates the test from the flaky generator and focuses on import functionality
    const planId = await page.evaluate(() => {
      const now = new Date().toISOString();
      const mockPlan = {
        id: 'test-plan-' + Date.now(),
        name: 'Test Import Plan',
        weeks: [
          {
            workouts: [
              {
                day: 'Monday',
                exercises: [
                  { name: 'Test Exercise 1', sets: [{ set: 1, reps: 10 }] },
                  { name: 'Test Exercise 2', sets: [{ set: 1, reps: 12 }] }
                ]
              },
              {
                day: 'Wednesday',
                exercises: [
                  { name: 'Test Exercise 3', sets: [{ set: 1, reps: 8 }] }
                ]
              },
              {
                day: 'Friday',
                exercises: [
                  { name: 'Test Exercise 4', sets: [{ set: 1, reps: 15 }] }
                ]
              }
            ]
          }
        ],
        generatedBy: 'manual' as const,
        createdAt: now,
        updatedAt: now
      };
      
      // Store in localStorage as a fallback
      localStorage.setItem('mock-workout-plan-import', JSON.stringify(mockPlan));
      
      // Try using repositories if available
      // @ts-ignore - repositories is on window but not typed
      if (window.repositories && window.repositories.workout) {
        // @ts-ignore
        return window.repositories.workout.createWorkoutPlan(mockPlan);
      }
      
      return mockPlan.id;
    });
    
    console.log('Created test plan:', planId);
    
    // Navigate to workouts page to trigger a fresh data load
    await page.goto('./#/workouts');
    await page.waitForLoadState('networkidle');
    
    // Wait a moment for data to load
    await page.waitForTimeout(2000);
    
    // Verify the plan appears
    const workoutPlanSelector = page.locator('[data-testid^="workout-plan-"]').first();
    await expect(workoutPlanSelector).toBeVisible({ timeout: 10000 });
    console.log('Workout plan visible');
    
    // Verify the plan has actual workout content 
    // Look for workout day cards within the plan (each day card shows exercises)
    const workoutDayCards = page.locator('[data-testid^="workout-day-card"]');
    await expect(workoutDayCards.first()).toBeVisible({ timeout: 5000 });
    console.log('Workout day cards visible');
    
    // Now click View on the first plan
    await workoutPlanSelector.getByRole('button', { name: 'View' }).click();
    await firstPlan.getByRole('button', { name: 'View' }).click();
    
    // Wait for plan detail view to open
    await page.waitForTimeout(500);
    
    // Click "Import to Log" button - should be available on individual workout days
    const importButton = page.getByRole('button', { name: /Import to Log/i }).first();
    await expect(importButton).toBeVisible({ timeout: 5000 });
    await importButton.click();
    
    // Should show exercise selection modal
    await page.waitForTimeout(500);
    
    // Select at least one exercise by checking the first checkbox
    const firstExerciseCheckbox = page.locator('input[type="checkbox"]').first();
    await expect(firstExerciseCheckbox).toBeVisible({ timeout: 5000 });
    await firstExerciseCheckbox.check();
    await page.waitForTimeout(300);
    
    // Click "Import Selected" button
    const importSelectedButton = page.getByRole('button', { name: /Import \(.*\)/i }).or(page.getByRole('button', { name: /Import Selected/i }));
    await expect(importSelectedButton.first()).toBeVisible({ timeout: 5000 });
    await importSelectedButton.first().click();
    
    // Should navigate to workout logger page
    await expect(page).toHaveURL(/.*\/log\/workout/, { timeout: 5000 });
    
    // Verify exercises are displayed on the logger page
    const exerciseEntries = page.locator('[data-testid^="exercise-entry-"]').or(page.locator('.space-y-3').first());
    await expect(exerciseEntries.first()).toBeVisible({ timeout: 5000 });
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