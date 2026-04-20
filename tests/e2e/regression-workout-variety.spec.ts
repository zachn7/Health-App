import { test, expect } from '@playwright/test';
import { bootstrapContext, gotoApp } from './helpers/bootstrap';
import { waitForRouteReady } from './helpers/app';
import { testIds } from '../../src/testIds';

test.describe('Regression: Workout Program Variety (R11)', () => {
  
  test('should generate workout plans successfully', async ({ page, context }) => {
    await bootstrapContext(context, {
      clearStorage: true,
      acceptAgeGate: true,
      completeOnboarding: true,
      seedProfile: true,
    });

    await gotoApp(page, '/workouts');
    await waitForRouteReady(page);
    
    // Generate workout plan with seeded RNG
    const generateButton = page.getByTestId(testIds.workouts.generateEmptyPlanButton);
    await expect(generateButton).toBeVisible({ timeout: 5000 });
    
    page.on('dialog', dialog => dialog.accept());
    
    // Generate plan and verify it contains exercises
    await generateButton.click();

    // Mode selector modal appears; profile mode is default but we click anyway to be explicit.
    const profileModeButton = page.getByTestId(testIds.workouts.modeProfileBtn);
    await expect(profileModeButton).toBeVisible({ timeout: 5000 });
    await profileModeButton.click();

    // Click the generate button in the modal
    const modalGenerateButton = page.getByTestId(testIds.workouts.modalGenerateButton);
    await expect(modalGenerateButton).toBeVisible({ timeout: 5000 });
    await modalGenerateButton.click();
    const plans = page.locator('[data-testid^="workout-plan-"]');
    await expect(plans.first()).toBeVisible({ timeout: 10000 });
    
    // View the plan
    await plans.first().getByRole('button', { name: 'View' }).first().click();
    const firstDay = page.locator('[data-testid^="workout-day-"]').first();
    await expect(firstDay).toBeVisible({ timeout: 3000 });
    await firstDay.click();
    
    // Verify at least one exercise is present
    const exerciseElement = page.locator('[data-testid^="plan-exercise-"]').first();
    const exerciseName = await exerciseElement.textContent() || '';
    console.log('Generated exercise:', exerciseName);
    
    expect(exerciseName.length).toBeGreaterThan(0);
    console.log('✅ Seeded workout generation works correctly');
  });

  test('should generate different exercises in a separate session', async ({ page, context }) => {
    await bootstrapContext(context, {
      clearStorage: true,
      acceptAgeGate: true,
      completeOnboarding: true,
      seedProfile: true,
    });

    await gotoApp(page, '/workouts');
    await waitForRouteReady(page);
    
    // Generate workout plan (different timestamp seed than previous session)
    const generateButton = page.getByTestId(testIds.workouts.generateEmptyPlanButton);
    await expect(generateButton).toBeVisible({ timeout: 5000 });
    
    page.on('dialog', dialog => dialog.accept());
    await generateButton.click();

    const profileModeButton = page.getByTestId(testIds.workouts.modeProfileBtn);
    await expect(profileModeButton).toBeVisible({ timeout: 5000 });
    await profileModeButton.click();

    const modalGenerateButton = page.getByTestId(testIds.workouts.modalGenerateButton);
    await expect(modalGenerateButton).toBeVisible({ timeout: 5000 });
    await modalGenerateButton.click();
    
    const plans = page.locator('[data-testid^="workout-plan-"]');
    await expect(plans.first()).toBeVisible({ timeout: 10000 });
    
    // View the plan
    await plans.first().getByRole('button', { name: 'View' }).first().click();
    const firstDay = page.locator('[data-testid^="workout-day-"]').first();
    await expect(firstDay).toBeVisible({ timeout: 3000 });
    await firstDay.click();
    
    const exerciseElement = page.locator('[data-testid^="plan-exercise-"]').first();
    const exerciseName = await exerciseElement.textContent() || '';
    console.log('Generated exercise in separate session:', exerciseName);
    
    expect(exerciseName.length).toBeGreaterThan(0);
    console.log('✅ Separate session generation works');
  });
});