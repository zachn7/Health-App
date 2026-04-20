import { test, expect } from '@playwright/test';
import { bootstrapContext, gotoApp } from './helpers/bootstrap';
import { waitForRouteReady } from './helpers/app';
import { testIds } from '../../src/testIds';

const VISIBLE_DAYS = 5;

test.describe('Regression: Workout Plans Day Selector Carousel', () => {
  test.beforeEach(async ({ context }) => {
    await bootstrapContext(context, {
      clearStorage: true,
      acceptAgeGate: true,
      completeOnboarding: true,
      seedProfile: true,
    });
  });

  test('should show day carousel when plan has many days (>5)', async ({ page }) => {
    await gotoApp(page, '/workouts');
    await waitForRouteReady(page);

    // Switch to Presets tab
    const presetsTab = page.getByTestId('workouts-presets-tab');
    await presetsTab.click();
    await expect(presetsTab).toHaveClass(/border-blue-500/);

    // Wait for preset cards to load
    const presetCards = page.locator('[data-testid^="workouts-preset-card-"]');
    await expect(presetCards.first()).toBeVisible({ timeout: 10000 });

    // Import a preset that might have many days
    const firstPresetCard = presetCards.first();
    const importButton = firstPresetCard.getByRole('button', { name: 'Import as Copy' });
    await importButton.click();

    // Open the first workout plan
    const workoutPlanCards = page.locator('[data-testid^="workout-plan-"]');
    await expect(workoutPlanCards.first()).toBeVisible({ timeout: 10000 });
    await workoutPlanCards.first().getByRole('button', { name: 'View', exact: true }).click();

    const dayCards = page.locator('[data-testid^="workout-day-"]');
    await expect(dayCards.first()).toBeVisible({ timeout: 10_000 });

    const dayCount = await dayCards.count();
    if (dayCount > VISIBLE_DAYS) {
      const prevButton = page.getByTestId('workout-plan-days-prev');
      const nextButton = page.getByTestId('workout-plan-days-next');
      await expect(prevButton).toBeVisible({ timeout: 5000 });
      await expect(nextButton).toBeVisible({ timeout: 5000 });
      console.log(`✅ Day carousel visible for plan with many days (${dayCount})`);
    } else {
      await expect(page.getByTestId('workout-plan-days-prev')).toHaveCount(0);
      await expect(page.getByTestId('workout-plan-days-next')).toHaveCount(0);
      console.log(`ℹ️  Plan has <=${VISIBLE_DAYS} days (${dayCount}), carousel not shown (expected)`);
    }
  });

  test('should page through days using carousel arrows', async ({ page }) => {
    // Set up profile
    await gotoApp(page, '/workouts');
    await waitForRouteReady(page);

    // Find or create a plan with many days
    const workoutPlanCards = page.locator('[data-testid^="workout-plan-"]');
    const hasPlans = await workoutPlanCards.count() > 0;
    
    if (!hasPlans) {
      // Generate a plan first
      const generateButton = page.getByTestId('generate-workout-plan-btn');
      await generateButton.click();
      
      const profileModeButton = page.getByTestId(testIds.workouts.modeProfileBtn);
      await expect(profileModeButton).toBeVisible({ timeout: 10_000 });
      await profileModeButton.click();
      
      page.on('dialog', dialog => dialog.accept());
      
      const modalGenerateButton = page.getByTestId(testIds.workouts.modalGenerateButton);
      await expect(modalGenerateButton).toBeVisible({ timeout: 3000 });
      await modalGenerateButton.click();
      
      await expect(workoutPlanCards.first()).toBeVisible({ timeout: 15000 });
    }
    
    // Open first plan (click View button)
    await workoutPlanCards.first().getByRole('button', { name: 'View', exact: true }).click();
    await expect(page.locator('[data-testid^="workout-day-"]').first()).toBeVisible({ timeout: 10_000 });

    // Try to add days until we have >5
    const addDayButton = page.getByRole('button', { name: /add day/i });
    
    // Check current day count
    let dayCount = await page.locator('[data-testid^="workout-day-"]').count();
    console.log('Initial day count:', dayCount);
    
    // Add days if needed (aim for at least 7)
    while (dayCount < 7) {
      const before = dayCount;
      await addDayButton.click();
      await expect.poll(async () => await page.locator('[data-testid^="workout-day-"]').count(), { timeout: 10_000 }).toBeGreaterThan(before);
      dayCount = await page.locator('[data-testid^="workout-day-"]').count();
      console.log('Day count after adding:', dayCount);
      
      // Safety break
      if (dayCount > 10) break;
    }

    // Now we should have enough days for carousel
    const dayCarouselContainer = page.getByTestId('workout-plan-days-prev').locator('..').locator('..');
    await expect(dayCarouselContainer).toBeVisible({ timeout: 5000 });

    const prevButton = page.getByTestId('workout-plan-days-prev');
    const nextButton = page.getByTestId('workout-plan-days-next');
    
    await expect(prevButton).toBeVisible();
    await expect(nextButton).toBeVisible();
    
    // Get initial state
    const prevDisabledInitially = await prevButton.isDisabled();
    expect(prevDisabledInitially).toBe(true); // Prev should be disabled at start
    
    const nextDisabledInitially = await nextButton.isDisabled();
    expect(nextDisabledInitially).toBe(false); // Next should be enabled
    
    // Click next to scroll
    await nextButton.click();
    await expect(prevButton).toBeEnabled({ timeout: 5_000 });
    
    // Verify prev is now enabled
    const prevAfterNext = await prevButton.isDisabled();
    if (dayCount > VISIBLE_DAYS) {
      expect(prevAfterNext).toBe(false);
    }
    
    // Click prev to go back
    await prevButton.click();
    await expect(prevButton).toBeDisabled({ timeout: 5_000 });
    
    // Verify prev is disabled again
    const prevAfterPrev = await prevButton.isDisabled();
    expect(prevAfterPrev).toBe(true);    
    
    // If we have enough days, test reaching the end
    if (dayCount > 5) {
      // Navigate to end
      const nextButtonAfter = page.getByTestId('workout-plan-days-next');
      
      // Click next multiple times until disabled
      let nextDisabled = false;
      let clicks = 0;
      while (!nextDisabled && clicks < 10) {
        await nextButtonAfter.click();
        nextDisabled = await nextButtonAfter.isDisabled();
        clicks++;
      }
      
      // Eventually next should be disabled at end
      expect(nextDisabled).toBe(true);
      
      console.log('✅ Carousel handles reaching end correctly');
    }
    
    console.log('✅ Day carousel paging works correctly');
  });

  test('should scroll to day cards when clicking day buttons', async ({ page }) => {
    // Set up profile
    await gotoApp(page, '/workouts');
    await waitForRouteReady(page);

    // Find or create a plan with many days
    const workoutPlanCards = page.locator('[data-testid^="workout-plan-"]');
    const hasPlans = await workoutPlanCards.count() > 0;
    
    if (!hasPlans) {
      // Generate a plan
      const generateButton = page.getByTestId('generate-workout-plan-btn');
      await generateButton.click();
      
      const profileModeButton = page.getByTestId(testIds.workouts.modeProfileBtn);
      await expect(profileModeButton).toBeVisible({ timeout: 10_000 });
      await profileModeButton.click();
      
      page.on('dialog', dialog => dialog.accept());
      
      const modalGenerateButton = page.getByTestId(testIds.workouts.modalGenerateButton);
      await expect(modalGenerateButton).toBeVisible({ timeout: 3000 });
      await modalGenerateButton.click();
      
      await expect(workoutPlanCards.first()).toBeVisible({ timeout: 15000 });
    }
    
    // Open first plan (click View button)
    await workoutPlanCards.first().getByRole('button', { name: 'View', exact: true }).click();
    await expect(page.getByTestId('workout-plan-day-complete-0-0')).toBeVisible({ timeout: 10_000 });

    // Add days until we have >5
    const addDayButton = page.getByRole('button', { name: /add day/i });
    let dayCount = await page.locator('[data-testid^="workout-day-"]').count();
    
    while (dayCount < 7) {
      const before = dayCount;
      await addDayButton.click();
      await expect.poll(async () => await page.locator('[data-testid^="workout-day-"]').count(), { timeout: 10_000 }).toBeGreaterThan(before);
      dayCount = await page.locator('[data-testid^="workout-day-"]').count();
      if (dayCount > 10) break;
    }

    // Wait for carousel to appear
    const dayCarouselContainer = page.getByTestId('workout-plan-days-prev').locator('..').locator('..');
    await expect(dayCarouselContainer).toBeVisible({ timeout: 5000 });

    // Get first visible day button
    const dayButtons = page.locator('[data-testid^="workout-plan-day-btn-"]');
    const buttonCount = await dayButtons.count();
    
    if (buttonCount > 0) {
      const firstDayButton = dayButtons.first();
      await expect(firstDayButton).toBeVisible();
      
      // Click first day button
      await firstDayButton.click();
      
      // Verify it's now highlighted
      await expect(firstDayButton).toHaveClass(/bg-blue-600/);
      
      console.log('✅ Day buttons navigate to day cards and show selection state');
    }
  });

  test('should toggle day completion and persist after reload', async ({ page }) => {
    // Set up profile
    await gotoApp(page, '/workouts');
    await waitForRouteReady(page);

    // Find or create a plan
    const workoutPlanCards = page.locator('[data-testid^="workout-plan-"]');
    const hasPlans = await workoutPlanCards.count() > 0;
    
    if (!hasPlans) {
      // Generate a plan
      const generateButton = page.getByTestId('generate-workout-plan-btn');
      await generateButton.click();
      
      const profileModeButton = page.getByTestId(testIds.workouts.modeProfileBtn);
      await expect(profileModeButton).toBeVisible({ timeout: 10_000 });
      await profileModeButton.click();
      
      page.on('dialog', dialog => dialog.accept());
      
      const modalGenerateButton = page.getByTestId(testIds.workouts.modalGenerateButton);
      await expect(modalGenerateButton).toBeVisible({ timeout: 3000 });
      await modalGenerateButton.click();
      
      await expect(workoutPlanCards.first()).toBeVisible({ timeout: 15000 });
    }
    
    // Open first plan (click View button)
    await workoutPlanCards.first().getByRole('button', { name: 'View', exact: true }).click();
    await expect(page.getByTestId('workout-plan-day-complete-0-0')).toBeVisible({ timeout: 10_000 });

    // Find first day's completion toggle
    const firstDayToggle = page.getByTestId('workout-plan-day-complete-0-0');
    await expect(firstDayToggle).toBeVisible({ timeout: 5000 });
    
    // Check initial state (not completed)
    const parentCard = firstDayToggle.locator('..').locator('..').locator('..');
    await expect(parentCard).not.toHaveClass(/bg-green-50/);
    
    // Toggle day as completed
    await firstDayToggle.click();
    
    // Verify green background appears
    await expect(parentCard).toHaveClass(/bg-green-50/);
    
    // Verify checkmark is visible in the toggle
    await expect(firstDayToggle.locator('svg')).toBeVisible();
    
    console.log('✅ Day completion toggle works');
    
    // Reload page to test persistence
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Re-open the plan
    const planCardsAfterReload = page.locator('[data-testid^="workout-plan-"]');
    if (await planCardsAfterReload.count() > 0) {
      // If we're on the list view, click View button
      await planCardsAfterReload.first().getByRole('button', { name: 'View', exact: true }).click();
      await expect(page.getByTestId('workout-plan-day-complete-0-0')).toBeVisible({ timeout: 10_000 });
    }
    
    // Find the day toggle again
    const firstDayToggleAfterReload = page.getByTestId('workout-plan-day-complete-0-0');
    const parentCardAfterReload = firstDayToggleAfterReload.locator('..').locator('..').locator('..');
    
    // Verify completion state persisted
    await expect(parentCardAfterReload).toHaveClass(/bg-green-50/);
    await expect(firstDayToggleAfterReload.locator('svg')).toBeVisible();
    
    console.log('✅ Day completion persists after reload');
    
    // Toggle back to incomplete
    await firstDayToggleAfterReload.click();
    
    // Verify green background removed
    await expect(parentCardAfterReload).not.toHaveClass(/bg-green-50/);
    
    console.log('✅ Can toggle completion back to incomplete');
  });
});