import { Page } from '@playwright/test';

/**
 * Setup helper - creates a minimal valid profile for E2E tests
 * This isolates tests from profile dependencies and makes them self-sufficient
 */
export async function setupTestProfile(page: Page) {
  // Navigate to profile page
  await page.goto('./#/profile');
  await page.waitForLoadState('networkidle');
  
  // Check if profile already exists (has current weight/height visible)
  const hasExistingProfile = await page.locator('.font-medium').filter({ hasText: /kg|lbs/i }).isVisible().catch(() => false);
  
  if (hasExistingProfile) {
    console.log('Profile already exists, skipping creation');
    return;
  }
  
  // Click Create Profile button
  await page.getByRole('button', { name: 'Create Profile' }).click();
  await page.waitForLoadState('networkidle');
  
  // Set units to metric
  await page.getByTestId('profile-units-select').selectOption('metric');
  
  // Select essential equipment that works reliably
  // Limited set to avoid UI sidebar blocking issues with checkboxes
  await page.getByTestId('equipment-bodyweight').check();
  await page.getByTestId('equipment-barbell').check();
  await page.getByTestId('equipment-dumbbells').check();
  await page.waitForTimeout(300);
  
  // Set basic profile fields
  await page.getByPlaceholder('100-250').fill('180');  // height in cm
  await page.getByPlaceholder('30-300').fill('80');    // weight in kg
  await page.getByTestId('profile-age-input').fill('30');
  await page.getByTestId('profile-sex-select').selectOption('male');
  await page.getByTestId('profile-activity-level-select').selectOption('moderate');
  await page.getByTestId('profile-experience-level-select').selectOption('intermediate');
  
  // Select workout schedule (3 days per week)
  await page.getByTestId('schedule-monday').check();
  await page.getByTestId('schedule-wednesday').check();
  await page.getByTestId('schedule-friday').check();
  
  // Save profile
  await page.getByRole('button', { name: 'Save Profile' }).click();
  
  // Wait for save to complete
  await page.waitForTimeout(500);
  
  console.log('Test profile created successfully');
}