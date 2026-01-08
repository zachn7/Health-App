import { test, expect } from '@playwright/test';

test.describe('Regression: Weight Log LB Persistence (R03)', () => {
  test.beforeEach(async ({ page, context }) => {
    // Set age gate to pass BEFORE page loads (runs on all page navigations)
    await context.addInitScript(() => {
      localStorage.setItem('age_gate_accepted', 'true');
      localStorage.setItem('age_gate_timestamp', new Date().toISOString());
    });
  });

  test('should create profile with imperial units first', async ({ page }) => {
    // Need to create a profile with imperial units
    await page.goto('./#/profile');
    await expect(page.getByText('No Profile Found')).toBeVisible();
    await page.getByRole('button', { name: 'Create Profile' }).click();
    
    // Switch to imperial units
    await page.getByTestId('profile-units-select').selectOption('imperial');
    
    // Fill out profile in imperial
    await page.getByPlaceholder('Feet').fill('5');
    await page.getByPlaceholder('Inches').fill('9');
    await page.getByPlaceholder(/66.*661/).fill('165.3'); // 75 kg equivalent
    await page.getByTestId('profile-age-input').fill('25');
    await page.getByTestId('profile-sex-select').selectOption('male');
    await page.getByTestId('profile-activity-level-select').selectOption('moderate');
    await page.getByTestId('profile-experience-level-select').selectOption('beginner');
    await page.getByTestId('equipment-bodyweight').check();
    await page.getByTestId('schedule-monday').check();
    
    await page.getByRole('button', { name: 'Save Profile' }).click();
    await expect(page.getByText('Profile saved successfully!')).toBeVisible();
    
    // Go to progress page
    await page.goto('./#/progress');
    await page.waitForLoadState();
  });

  test('should display weight input in pounds when using imperial units', async ({ page }) => {
    // Create imperial profile first
    await page.goto('./#/profile');
    await page.getByRole('button', { name: 'Create Profile' }).click();
    await page.getByTestId('profile-units-select').selectOption('imperial');
    await page.getByPlaceholder('Feet').fill('5');
    await page.getByPlaceholder('Inches').fill('9');
    await page.getByPlaceholder(/66.*661/).fill('165.3');
    await page.getByTestId('profile-age-input').fill('25');
    await page.getByTestId('profile-sex-select').selectOption('male');
    await page.getByTestId('profile-activity-level-select').selectOption('moderate');
    await page.getByTestId('profile-experience-level-select').selectOption('beginner');
    await page.getByTestId('equipment-bodyweight').check();
    await page.getByTestId('schedule-monday').check();
    await page.getByRole('button', { name: 'Save Profile' }).click();
    
    // Navigate to progress
    await page.goto('./#/progress');
    await page.waitForLoadState();
    
    // Open weight log form
    await page.getByRole('button', { name: 'Log Weight' }).click();
    await page.waitForLoadState();
    
    // Check that weight input shows pounds (lb) in the label
    await expect(page.getByTestId('weight-unit-label')).toContainText('lb');
    await expect(page.getByTestId('weight-input')).toBeVisible();
  });

  test('should log weight in pounds and persist correctly', async ({ page }) => {
    // Set up imperial profile
    await page.goto('./#/profile');
    await page.getByRole('button', { name: 'Create Profile' }).click();
    await page.getByTestId('profile-units-select').selectOption('imperial');
    await page.getByPlaceholder('Feet').fill('5');
    await page.getByPlaceholder('Inches').fill('9');
    await page.getByPlaceholder(/66.*661/).fill('165.3');
    await page.getByTestId('profile-age-input').fill('25');
    await page.getByTestId('profile-sex-select').selectOption('male');
    await page.getByTestId('profile-activity-level-select').selectOption('moderate');
    await page.getByTestId('profile-experience-level-select').selectOption('beginner');
    await page.getByTestId('equipment-bodyweight').check();
    await page.getByTestId('schedule-monday').check();
    await page.getByRole('button', { name: 'Save Profile' }).click();
    
    // Navigate to progress page
    await page.goto('./#/progress');
    await page.waitForLoadState();
    
    // Open weight log form
    await page.getByRole('button', { name: 'Log Weight' }).click();
    await page.waitForLoadState();
    
    // Log weight in pounds
    await page.getByTestId('weight-input').fill('170.5');
    
    // Save the weight entry
    await page.getByTestId('save-weight-button').click();
    
    // Should show the logged weight in the list/graph
    await expect(page.getByTestId('current-weight-display')).toContainText('170.5');
  });

  test('should persist weight entries across page refreshes', async ({ page }) => {
    // Set up imperial profile and log weight
    await page.goto('./#/profile');
    await page.getByRole('button', { name: 'Create Profile' }).click();
    await page.getByTestId('profile-units-select').selectOption('imperial');
    await page.getByPlaceholder('Feet').fill('6');
    await page.getByPlaceholder('Inches').fill('0');
    await page.getByPlaceholder(/66.*661/).fill('180');
    await page.getByTestId('profile-age-input').fill('30');
    await page.getByTestId('profile-sex-select').selectOption('male');
    await page.getByTestId('profile-activity-level-select').selectOption('moderate');
    await page.getByTestId('profile-experience-level-select').selectOption('beginner');
    await page.getByTestId('equipment-bodyweight').check();
    await page.getByTestId('schedule-monday').check();
    await page.getByRole('button', { name: 'Save Profile' }).click();
    
    await page.goto('./#/progress');
    await page.waitForLoadState();
    
    // Log first weight
    await page.getByRole('button', { name: 'Log Weight' }).click();
    await page.waitForLoadState();
    await page.getByTestId('weight-input').fill('175.0');
    await page.getByTestId('save-weight-button').click();
    await expect(page.getByTestId('current-weight-display')).toContainText('175.0');
    
    // Navigate to previous day and log second weight
    await page.getByRole('button').filter({ hasText: '←' }).or(page.getByTestId('prev-day-button')).click();
    await page.getByRole('button', { name: 'Log Weight' }).click();
    await page.waitForLoadState();
    await page.getByTestId('weight-input').fill('174.5');
    await page.getByTestId('save-weight-button').click();
    
    // Brief wait for save to complete
    await page.waitForTimeout(500);
    
    // Go back to today
    await page.getByRole('button').filter({ hasText: '→' }).or(page.getByTestId('next-day-button')).click();
    
    // Refresh the page
    await page.reload();
    await page.waitForLoadState();
    
    // Both weight entries should still be there and in pounds
    await expect(page.getByTestId('current-weight-display')).toContainText('175.0');
  });

  test('should not convert imperial weight entries to kg', async ({ page }) => {
    // Set up imperial profile
    await page.goto('./#/profile');
    await page.getByRole('button', { name: 'Create Profile' }).click();
    await page.getByTestId('profile-units-select').selectOption('imperial');
    await page.getByPlaceholder('Feet').fill('5');
    await page.getByPlaceholder('Inches').fill('10');
    await page.getByPlaceholder(/66.*661/).fill('150');
    await page.getByTestId('profile-age-input').fill('28');
    await page.getByTestId('profile-sex-select').selectOption('female');
    await page.getByTestId('profile-activity-level-select').selectOption('active');
    await page.getByTestId('profile-experience-level-select').selectOption('intermediate');
    await page.getByTestId('equipment-bodyweight').check();
    await page.getByTestId('schedule-wednesday').check();
    await page.getByRole('button', { name: 'Save Profile' }).click();
    
    // Navigate to progress and log weight
    await page.goto('./#/progress');
    await page.waitForLoadState();
    
    // Open weight log form
    await page.getByRole('button', { name: 'Log Weight' }).click();
    await page.waitForLoadState();
    
    await page.getByTestId('weight-input').fill('160.8');
    await page.getByTestId('save-weight-button').click();
    
    // Should show the exact value in lbs, not converted to kg
    await expect(page.getByTestId('current-weight-display')).toContainText('160.8');
  });

  test('should log weight twice on same day and overwrite existing entry', async ({ page }) => {
    // Set up imperial profile
    await page.goto('./#/profile');
    await page.getByRole('button', { name: 'Create Profile' }).click();
    await page.getByTestId('profile-units-select').selectOption('imperial');
    await page.getByPlaceholder('Feet').fill('5');
    await page.getByPlaceholder('Inches').fill('10');
    await page.getByPlaceholder(/66.*661/).fill('150');
    await page.getByTestId('profile-age-input').fill('28');
    await page.getByTestId('profile-sex-select').selectOption('female');
    await page.getByTestId('profile-activity-level-select').selectOption('active');
    await page.getByTestId('profile-experience-level-select').selectOption('intermediate');
    await page.getByTestId('equipment-bodyweight').check();
    await page.getByTestId('schedule-wednesday').check();
    await page.getByRole('button', { name: 'Save Profile' }).click();
    
    // Navigate to progress page
    await page.goto('./#/progress');
    await page.waitForLoadState();
    
    // Open weight log form and log first weight
    await page.getByRole('button', { name: 'Log Weight' }).click();
    await page.waitForLoadState();
    await page.getByTestId('weight-input').fill('160.8');
    await page.getByTestId('save-weight-button').click();
    await expect(page.getByTestId('current-weight-display')).toContainText('160.8');
    
    // Log second weight on the same day - need to reopen form
    await page.getByRole('button', { name: 'Log Weight' }).click();
    await page.waitForLoadState();
    await page.getByTestId('weight-input').fill('161.2');
    await page.getByTestId('save-weight-button').click();
    
    // Should show the second weight (overwritten)
    await expect(page.getByTestId('current-weight-display')).toContainText('161.2');
  });

  test('should maintain imperial units preference in weight section', async ({ page }) => {
    // Create profile with imperial units
    await page.goto('./#/profile');
    await page.getByRole('button', { name: 'Create Profile' }).click();
    await page.getByTestId('profile-units-select').selectOption('imperial');
    await page.getByPlaceholder('Feet').fill('5');
    await page.getByPlaceholder('Inches').fill('7');
    await page.getByPlaceholder(/66.*661/).fill('155');
    await page.getByTestId('profile-age-input').fill('35');
    await page.getByTestId('profile-sex-select').selectOption('male');
    await page.getByTestId('profile-activity-level-select').selectOption('moderate');
    await page.getByTestId('profile-experience-level-select').selectOption('advanced');
    await page.getByTestId('equipment-bodyweight').check();
    await page.getByTestId('schedule-friday').check();
    await page.getByRole('button', { name: 'Save Profile' }).click();
    
    // Navigate between pages and return to progress
    await page.goto('./#/dashboard');
    await page.waitForLoadState();
    await page.goto('./#/workouts');
    await page.waitForLoadState();
    await page.goto('./#/progress');
    await page.waitForLoadState();
    
    // Open weight log form
    await page.getByRole('button', { name: 'Log Weight' }).click();
    await page.waitForLoadState();
    
    // Should still show imperial units for weight
    await expect(page.getByTestId('weight-input')).toBeVisible();
    await expect(page.getByTestId('weight-unit-label')).toContainText('lb');
  });
});