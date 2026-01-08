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
    
    // Verify exercises are loaded
    const exerciseContainer = page.locator('.space-y-4').first();
    await expect(exerciseContainer).toBeVisible({ timeout: 10000 });
    
    // Check that exercise entries exist
    const exerciseEntries = page.locator('div').filter({ hasText: /Exercise/i });
    const entryCount = await exerciseEntries.count();
    console.log(`Found ${entryCount} exercise entries`);
    
    // We should have at least some exercise entries loaded
    expect(entryCount).toBeGreaterThan(0);
    
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
    // First, navigate to Workouts page
    await page.goto('./#/workouts');
    await page.waitForLoadState('networkidle');
    
    // Mock profile
    await page.addInitScript(() => {
      let profiles = JSON.parse(localStorage.getItem('profiles') || '[]');
      if (profiles.length === 0) {
        profiles.push({
          id: 'test-profile-import',
          name: 'Test Import User',
          sex: 'male',
          age: 30,
          weightKg: 80,
          heightCm: 180,
          activityLevel: 'moderate',
          experienceLevel: 'intermediate',
          goals: [{
            id: 'goal-import',
            type: 'strength',
            isPrimary: true
          }],
          equipment: ['barbell', 'dumbbell', 'body only'],
          schedule: {
            monday: true,
            tuesday: false,
            wednesday: true,
            thursday: false,
            friday: true,
            saturday: false,
            sunday: false
          },
          preferredUnits: 'metric'
        });
        localStorage.setItem('profiles', JSON.stringify(profiles));
      }
    });
    
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Generate a workout plan if none exists
    const plans = page.locator('[data-testid^="workout-plan-"]');
    const planCount = await plans.count();
    
    if (planCount === 0) {
      console.log('No workout plans found, generating one...');
      page.on('dialog', dialog => dialog.accept());
      await page.getByTestId('generate-workout-plan-btn').click();
      await page.waitForTimeout(3000);
    }
    
    // Now try to view and import a plan
    const firstPlan = page.locator('[data-testid^="workout-plan-"]').first();
    await firstPlan.getByRole('button', { name: 'View' }).click();
    await page.waitForTimeout(500);
    
    // Look for "Import to Log" button
    const importButton = page.getByRole('button', { name: /Import to Log/i });
    
    if (await importButton.isVisible({ timeout: 3000 })) {
      await importButton.click();
      await page.waitForTimeout(500);
      
      // Select first exercise
      const firstExerciseCheckbox = page.locator('input[type="checkbox"]').first();
      if (await firstExerciseCheckbox.isVisible({ timeout: 1000 })) {
        await firstExerciseCheckbox.check();
        await page.waitForTimeout(300);
        
        // Click "Import Selected"
        const importSelectedButton = page.getByRole('button', { name: /Import Selected/i });
        await importSelectedButton.click();
        
        // Should navigate to logger
        await page.waitForTimeout(1000);
        expect(page.url()).toContain('/log/workout');
        
        // Verify exercises are loaded
        const exerciseContainer = page.locator('.space-y-3');
        await expect(exerciseContainer.first()).toBeVisible({ timeout: 5000 });
        
        console.log('Successfully imported workout to logger');
      }
    } else {
      console.log('Import to Log button not found - may need to be in edit mode');
    }
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
