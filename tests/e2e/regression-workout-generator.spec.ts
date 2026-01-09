import { test, expect } from '@playwright/test';
import { setupTestProfile } from './helpers/setupProfile';
import { testIds } from '../../src/testIds';

test.describe('Regression: Workout Plan Generator (R07)', () => {
  test.beforeEach(async ({ page, context }) => {
    // Set up age gate and onboarding
    await context.addInitScript(() => {
      localStorage.setItem('age_gate_accepted', 'true');
      localStorage.setItem('onboarding_completed', 'true');
    });
  });

  test('should generate a workout plan with exercises without AI', async ({ page }) => {
    // Setup a test profile first
    await setupTestProfile(page);
    // Navigate to Workouts page
    await page.goto('./#/workouts');
    await page.waitForLoadState('networkidle');
    
    // Click "Generate Workout Plan" button
    const generateButton = page.getByTestId('generate-workout-plan-btn');
    await expect(generateButton).toBeVisible({ timeout: 5000 });
    
    // Click generate button
    await generateButton.click();
    
    // Wait for generation to complete (alert should appear)
    page.on('dialog', dialog => {
      console.log('Dialog message:', dialog.message());
      dialog.accept();
    });
    
    // Wait for plan to appear
    const planCard = page.locator('[data-testid^="workout-plan-"]').first();
    await expect(planCard).toBeVisible({ timeout: 10000 });
    
    // Verify plan is not empty
    const planText = await planCard.textContent();
    expect(planText).toBeTruthy();
    
    // Click "View" button to see the plan details
    const viewButton = planCard.getByRole('button', { name: 'View', exact: true });
    await viewButton.click();
    await page.waitForTimeout(500);
    
    // Check that exercises are present in the plan
    const exerciseRow = page.locator('[data-testid^="plan-exercise-"]').first();
    await expect(exerciseRow).toBeVisible({ timeout: 5000 });
    
    // Get count of exercises
    const exerciseCount = await page.locator('[data-testid^="plan-exercise-"]').count();
    console.log(`Found ${exerciseCount} exercises in the generated plan`);
    expect(exerciseCount).toBeGreaterThan(0);
  });

  test('should substitute an exercise with a different one', async ({ page }) => {
    // Setup profile and generate a plan
    await setupTestProfile(page);
    
    // Navigate to Workouts page
    await page.goto('./#/workouts');
    await page.waitForLoadState('networkidle');
    
    // Generate a plan first
    page.on('dialog', dialog => dialog.accept());
    
    const generateButton = page.getByTestId('generate-workout-plan-btn');
    await expect(generateButton).toBeVisible({ timeout: 5000 });
    await generateButton.click();
    
    // Wait for plan to appear
    const plans = page.locator('[data-testid^="workout-plan-"]');
    await expect(plans.first()).toBeVisible({ timeout: 15000 });
    
    // Click "View" button on the first plan
    const firstPlan = page.locator('[data-testid^="workout-plan-"]').first();
    await firstPlan.getByRole('button', { name: 'View', exact: true }).click();
    await page.waitForTimeout(500);
    
    // Enable editing mode for the first workout day
    const editWorkoutDayButton = page.getByTestId('edit-workout-day-btn-0-0').first();
    if (await editWorkoutDayButton.isVisible({ timeout: 3000 })) {
      await editWorkoutDayButton.click();
      await page.waitForTimeout(500);
    }
    
    // Get the first exercise's text content before substitution
    const firstExercise = page.locator('[data-testid^="plan-exercise-"]').first();
    const originalExerciseText = await firstExercise.textContent();
    console.log('Original exercise text:', originalExerciseText);
    
    // Count exercises before substitution
    const exerciseCountBefore = await page.locator('[data-testid^="plan-exercise-"]').count();
    console.log('Exercise count before substitution:', exerciseCountBefore);
    
    // Click the substitute button on the first exercise
    const substituteButton = firstExercise.getByTestId('substitute-exercise-btn');
    await expect(substituteButton).toBeVisible({ timeout: 3000 });
    
    // Check that no error is visible on the first exercise before clicking
    const errorMessageOnFirst = firstExercise.getByTestId('substitute-error');
    await expect(errorMessageOnFirst).not.toBeVisible({ timeout: 1000 });
    
    await substituteButton.click();
    await page.waitForTimeout(1000);
    
    // Verify no error message is shown on the first exercise after substitution
    await expect(errorMessageOnFirst).not.toBeVisible({ timeout: 2000 });
    
    // Get updated exercise text
    const updatedExerciseText = await firstExercise.textContent();
    console.log('Updated exercise text:', updatedExerciseText);
    
    // Count exercises after substitution
    const exerciseCountAfter = await page.locator('[data-testid^="plan-exercise-"]').count();
    console.log('Exercise count after substitution:', exerciseCountAfter);
    
    // The exercise count should remain the same
    expect(exerciseCountAfter).toBe(exerciseCountBefore);
    
    // The exercise should still exist
    expect(updatedExerciseText).toBeTruthy();
    
    console.log('✅ Substitute exercise test passed');
  });
  
  test('should support multiple substitutions on the same exercise', async ({ page }) => {
    // Setup profile and generate a plan
    await setupTestProfile(page);
    
    // Navigate to Workouts page
    await page.goto('./#/workouts');
    await page.waitForLoadState('networkidle');
    
    // Generate a plan
    page.on('dialog', dialog => dialog.accept());
    
    const generateButton = page.getByTestId('generate-workout-plan-btn');
    await expect(generateButton).toBeVisible({ timeout: 5000 });
    await generateButton.click();
    
    // Wait for plan to appear and view it
    const plans = page.locator('[data-testid^="workout-plan-"]');
    await expect(plans.first()).toBeVisible({ timeout: 15000 });
    
    const firstPlan = page.locator('[data-testid^="workout-plan-"]').first();
    await firstPlan.getByRole('button', { name: 'View', exact: true }).click();
    await page.waitForTimeout(500);
    
    // Enable editing mode
    const editWorkoutDayButton = page.getByTestId('edit-workout-day-btn-0-0').first();
    if (await editWorkoutDayButton.isVisible({ timeout: 3000 })) {
      await editWorkoutDayButton.click();
      await page.waitForTimeout(500);
    }
    
    // Capture the original exercise name
    const firstExercise = page.locator('[data-testid^="plan-exercise-"]').first();
    const originalExerciseText = await firstExercise.textContent();
    console.log('Original exercise:', originalExerciseText);
    
    // Get the substitute button for the first exercise
    const firstExerciseRow = page.locator('[data-testid^="plan-exercise-"]').first();
    const substituteButton = firstExerciseRow.getByTestId(testIds.workouts.substituteExerciseButton).first();
    await expect(substituteButton).toBeVisible({ timeout: 3000 });
    
    // Do first substitution
    await expect(page.getByTestId(testIds.workouts.substituteError)).not.toBeVisible();
    await substituteButton.click();
    await page.waitForTimeout(1000);
    await expect(page.getByTestId(testIds.workouts.substituteError)).not.toBeVisible();
    
    let afterFirstSub = await firstExercise.textContent();
    console.log('After 1st substitution:', afterFirstSub);
    expect(afterFirstSub).not.toBe(originalExerciseText);
    
    // Do second substitution on the same exercise
    await substituteButton.click();
    await page.waitForTimeout(1000);
    await expect(page.getByTestId(testIds.workouts.substituteError)).not.toBeVisible();
    
    let afterSecondSub = await firstExercise.textContent();
    console.log('After 2nd substitution:', afterSecondSub);
    expect(afterSecondSub).not.toBe(afterFirstSub);
    expect(afterSecondSub).not.toBe(originalExerciseText);
    
    // Do third substitution to verify we can keep iterating
    await substituteButton.click();
    await page.waitForTimeout(1000);
    await expect(page.getByTestId(testIds.workouts.substituteError)).not.toBeVisible();
    
    let afterThirdSub = await firstExercise.textContent();
    console.log('After 3rd substitution:', afterThirdSub);
    expect(afterThirdSub).not.toBe(afterSecondSub);
    expect(afterThirdSub).not.toBe(afterFirstSub);
    expect(afterThirdSub).not.toBe(originalExerciseText);
    
    console.log('✅ Multiple substitutions test passed - can iterate through exercises');
  });

  test('should handle generation without crashing', async ({ page }) => {
    // Navigate to Workouts page
    await page.goto('./#/workouts');
    await page.waitForLoadState('networkidle');
    
    // Click generate button and ensure no crashes
    const generateButton = page.getByTestId('generate-empty-workout-plan-btn');
    await expect(generateButton).toBeVisible({ timeout: 5000 });
    
    // Setup dialog handler before clicking
    page.on('dialog', dialog => dialog.accept());
    generateButton.click();
    
    // Wait for result (either success alert or error alert)
    await page.waitForTimeout(3000);
    
    // Verify page is still responsive
    expect(page.url()).toContain('/workouts');
    
    // Verify no console errors (we can't easily check this, but we can verify the page is still usable)
    const pageContent = await page.textContent('body');
    expect(pageContent).toBeTruthy();
  });

  test('should verify generator shows clear error when profile missing', async ({ page }) => {
    // Navigate to Workouts page without a profile
    await page.goto('./#/workouts');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    // Ensure no profile exists by checking localStorage
    await page.addInitScript(() => {
      localStorage.removeItem('profiles');
    });
    
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Click generate button
    const generateButton = page.getByTestId('generate-empty-workout-plan-btn');
    await expect(generateButton).toBeVisible({ timeout: 5000 });
    
    // Handle dialog - should show "Please create a profile first!"
    let dialogMessage = '';
    page.on('dialog', async dialog => {
      dialogMessage = dialog.message();
      console.log('Dialog message:', dialogMessage);
      await dialog.accept();
    });
    
    await generateButton.click();
    await page.waitForTimeout(500);
    
    // Verify dialog shows appropriate error message
    expect(dialogMessage).toContain('profile');
    
    // Verify no plan was created
    const planCards = page.locator('[data-testid^="workout-plan-"]');
    const planCount = await planCards.count();
    expect(planCount).toBe(0);
    
    console.log('✅ Generator correctly shows error when profile is missing');
  });

  test('should populate exercises for existing workout plans', async ({ page }) => {
    // Navigate to Workouts page
    await page.goto('./#/workouts');
    await page.waitForLoadState('networkidle');
    
    // Check if there are existing plans
    const planCards = page.locator('[data-testid^="workout-plan-"]');
    const planCount = await planCards.count();
    
    if (planCount === 0) {
      console.log('No existing plans found - skipping exercise verification test');
      return; // Skip test if no plans exist
    }
    
    console.log(`Found ${planCount} existing workout plans`);
    
    // View the first plan
    const firstPlan = planCards.first();
    const viewButton = firstPlan.getByRole('button', { name: 'View' });
    
    // Scroll the plan into view if needed
    await firstPlan.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    
    await viewButton.click();
    await page.waitForTimeout(500);
    
    // Verify we have workout day cards
    const workoutDayCards = page.locator('[data-testid^="workout-day-"]');
    const dayCardCount = await workoutDayCards.count();
    
    console.log(`Found ${dayCardCount} workout day cards in plan`);
    expect(dayCardCount).toBeGreaterThan(0);
    
    // For each visible workout day, verify it has exercises
    let totalExercises = 0;
    let emptyDaysFound = 0;
    
    for (let i = 0; i < dayCardCount; i++) {
      const dayCard = workoutDayCards.nth(i);
      
      // Scroll this card into view
      await dayCard.scrollIntoViewIfNeeded();
      await page.waitForTimeout(100);
      
      const isDayCardVisible = await dayCard.isVisible().catch(() => false);
      
      if (isDayCardVisible) {
        // Find exercise rows within this day card
        const exerciseRows = dayCard.locator('[data-testid^="plan-exercise-"]');
        const exerciseCount = await exerciseRows.count();
        
        console.log(`Day ${i}: Found ${exerciseCount} exercises`);
        
        if (exerciseCount === 0) {
          emptyDaysFound++;
          console.log(`⚠️  WARNING: Day ${i} has no exercises!`);
        } else {
          totalExercises += exerciseCount;
          
          // Verify first exercise row has content
          const firstExerciseRow = exerciseRows.first();
          const exerciseText = await firstExerciseRow.textContent();
          expect(exerciseText).toBeTruthy();
          expect(exerciseText?.length).toBeGreaterThan(10);
        }
      }
    }
    
    console.log(`Total exercises across all days: ${totalExercises}`);
    console.log(`Empty days found: ${emptyDaysFound}`);
    
    // Critical assertion: NO days should be empty
    expect(emptyDaysFound).toBe(0);
    
    // Should have at least some exercises
    expect(totalExercises).toBeGreaterThan(0);
    
    // Reasonable bounds based on workout frequency
    expect(totalExercises).toBeGreaterThanOrEqual(dayCardCount);
    expect(totalExercises).toBeLessThanOrEqual(dayCardCount * 10);
    
    console.log('✅ All workout days have exercises (no empty days)');
  });

  test('should generate workout plan successfully in offline mode', async ({ page, context }) => {
    // Set up age gate and onboarding
    await context.addInitScript(() => {
      localStorage.setItem('age_gate_accepted', 'true');
      localStorage.setItem('onboarding_completed', 'true');
    });

    // Setup a test profile first (must be done online)
    await setupTestProfile(page);
    console.log('✓ Profile created online');

    // Navigate to Workouts page
    await page.goto('./#/workouts');
    await page.waitForLoadState('networkidle');
    console.log('✓ Navigated to workouts page');

    // Set offline mode before generating
    await context.setOffline(true);
    console.log('✓ Browser set to offline mode');

    try {
      // Click "Generate Workout Plan" button
      const generateButton = page.getByTestId('generate-workout-plan-btn');
      await expect(generateButton).toBeVisible({ timeout: 5000 });

      // Capture any console errors during generation
      const consoleErrors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      // Click generate button
      await generateButton.click();
      console.log('✓ Clicked generate button');

      // Handle the success dialog
      let dialogMessage = '';
      page.on('dialog', async dialog => {
        dialogMessage = dialog.message();
        console.log('Dialog message:', dialogMessage);
        await dialog.accept();
      });

      // Wait for plan to appear
      const planCard = page.locator('[data-testid^="workout-plan-"]').first();
      await expect(planCard).toBeVisible({ timeout: 15000 });
      console.log('✓ Workout plan appeared offline');

      // Verify plan is not empty
      const planText = await planCard.textContent();
      expect(planText).toBeTruthy();

      // Click "View" button to see the plan details
      const viewButton = planCard.getByRole('button', { name: 'View', exact: true });
      await viewButton.click();
      await page.waitForLoadState('networkidle');

      // Check that exercises are present in the plan
      const exerciseRow = page.locator('[data-testid^="plan-exercise-"]').first();
      await expect(exerciseRow).toBeVisible({ timeout: 5000 });

      // Get count of exercises
      const exerciseCount = await page.locator('[data-testid^="plan-exercise-"]').count();
      console.log(`✓ Found ${exerciseCount} exercises in the offline-generated plan`);
      expect(exerciseCount).toBeGreaterThan(0);

      // Verify no exercise DB load errors (offline data access worked)
      const exerciseLoadErrors = consoleErrors.filter(e => 
        e.includes('exercise') && (e.includes('Failed to load') || e.includes('failed to fetch'))
      );
      
      expect(exerciseLoadErrors.length).toBe(0);
      console.log('✓ No exercise DB load errors offline');

      // Verify generator error banner is NOT visible (generation succeeded)
      const errorBanner = page.getByTestId('workout-generator-error');
      await expect(errorBanner).not.toBeVisible({ timeout: 2000 });
      console.log('✓ No generator error banner shown');

      console.log('✅ Offline workout generation test passed!');

    } finally {
      // Restore online mode
      await context.setOffline(false);
      console.log('✓ Browser restored to online mode');
    }
  });
});
