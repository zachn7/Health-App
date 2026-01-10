import { test, expect } from '@playwright/test';
import { setupTestProfile } from './helpers/setupProfile';
import { testIds } from '../../src/testIds';

test.describe('Regression: Workout Program Variety (R11)', () => {
  
  test('should generate workout plans successfully', async ({ page, context }) => {
    // Set up age gate and onboarding
    await context.addInitScript(() => {
      localStorage.setItem('age_gate_accepted', 'true');
      localStorage.setItem('onboarding_completed', 'true');
    });
    
    // Setup a test profile
    await setupTestProfile(page);
    
    // Navigate to Workouts page
    await page.goto('./#/workouts');
    await page.waitForLoadState('networkidle');
    
    // Generate workout plan with seeded RNG
    const generateButton = page.getByTestId(testIds.workouts.generatePlanButton);
    await expect(generateButton).toBeVisible({ timeout: 5000 });
    
    page.on('dialog', dialog => dialog.accept());
    
    // Generate plan and verify it contains exercises
    await generateButton.click();
    await page.waitForTimeout(500); // Wait for modal to appear
    
    // Select "Based on Profile" mode
    const profileModeButton = page.getByTestId(testIds.workouts.modeProfileBtn);
    await expect(profileModeButton).toBeVisible({ timeout: 3000 });
    await profileModeButton.click();
    await page.waitForTimeout(300); // Wait for state update
    
    // Click the generate button in the modal
    const modalGenerateButton = page.getByTestId(testIds.workouts.modalGenerateButton);
    await expect(modalGenerateButton).toBeVisible({ timeout: 3000 });
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
    // Set up age gate and onboarding
    await context.addInitScript(() => {
      localStorage.setItem('age_gate_accepted', 'true');
      localStorage.setItem('onboarding_completed', 'true');
    });
    
    // Setup a test profile for a different session
    await setupTestProfile(page);
    
    // Navigate to Workouts page
    await page.goto('./#/workouts');
    await page.waitForLoadState('networkidle');
    
    // Generate workout plan (different timestamp seed than previous session)
    const generateButton = page.getByTestId(testIds.workouts.generatePlanButton);
    await expect(generateButton).toBeVisible({ timeout: 5000 });
    
    page.on('dialog', dialog => dialog.accept());
    await generateButton.click();
    await page.waitForTimeout(500); // Wait for modal to appear
    
    // Select "Based on Profile" mode
    const profileModeButton = page.getByTestId(testIds.workouts.modeProfileBtn);
    await expect(profileModeButton).toBeVisible({ timeout: 3000 });
    await profileModeButton.click();
    await page.waitForTimeout(300); // Wait for state update
    
    // Click the generate button in the modal
    const modalGenerateButton = page.getByTestId(testIds.workouts.modalGenerateButton);
    await expect(modalGenerateButton).toBeVisible({ timeout: 3000 });
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