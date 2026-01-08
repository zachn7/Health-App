import { test, expect } from '@playwright/test';

test.describe('Regression: Profile Save -> Dashboard Update (R01)', () => {
  
  test('should update dashboard immediately when profile is saved', async ({ page, context }) => {
    // Set age gate to pass BEFORE page loads (runs on all page navigations)
    await context.addInitScript(() => {
      localStorage.setItem('age_gate_accepted', 'true');
      localStorage.setItem('age_gate_timestamp', new Date().toISOString());
    });
    
    // Navigate to profile and create a profile
    await page.goto('./#/profile');
    await expect(page.getByText('No Profile Found')).toBeVisible();
    await page.getByRole('button', { name: 'Create Profile' }).click();
    
    // Fill out profile
    await page.getByTestId('profile-age-input').fill('25');
    await page.getByTestId('profile-sex-select').selectOption('male');
    await page.getByTestId('profile-activity-level-select').selectOption('moderate');
    await page.getByTestId('profile-experience-level-select').selectOption('beginner');
    await page.getByTestId('equipment-bodyweight').check();
    await page.getByTestId('schedule-monday').check();
    await page.getByRole('button', { name: 'Save Profile' }).click();
    
    // Should save profile and navigate to dashboard
    await expect(page.getByText('Profile saved successfully!')).toBeVisible();
    
    // Navigate to dashboard (wait for potential redirect)
    await page.waitForTimeout(1500);
    await page.goto('./#/dashboard');
    await page.waitForLoadState();
    
    // Dashboard should show profile information, not onboarding state
    await expect(page.getByText('Complete your profile first')).not.toBeVisible();
    await expect(page.getByText('Profile Overview')).toBeVisible();
    await expect(page.getByText('Activity Level:')).toBeVisible();
    await expect(page.getByText('moderate')).toBeVisible();
  });
  test.beforeEach(async ({ page, context }) => {
    // Set age gate to pass BEFORE page loads (runs on all page navigations)
    await context.addInitScript(() => {
      localStorage.setItem('age_gate_accepted', 'true');
      localStorage.setItem('age_gate_timestamp', new Date().toISOString());
    });
    
    // Navigate to profile
    await page.goto('./#/profile');
  });

  test('should update dashboard immediately after saving profile', async ({ page }) => {
    // Should need to create profile first
    await expect(page.getByText('No Profile Found')).toBeVisible();
    await page.getByRole('button', { name: 'Create Profile' }).click();
    
    // Fill out profile form
    await page.getByTestId('profile-age-input').fill('25');
    await page.getByTestId('profile-sex-select').selectOption('male');
    await page.getByTestId('profile-activity-level-select').selectOption('moderate');
    await page.getByTestId('profile-experience-level-select').selectOption('beginner');
    
    // Fill health metrics
    await page.getByPlaceholder(/100.*250/).fill('175'); // Height in cm
    await page.getByPlaceholder(/30.*300/).fill('75'); // Weight in kg
    
    // Select equipment and workout day
    await page.getByTestId('equipment-bodyweight').check();
    await page.getByTestId('schedule-monday').check();
    
    // Save profile
    await page.getByRole('button', { name: 'Save Profile' }).click();
    
    // Should show success message
    await expect(page.getByText('Profile saved successfully!')).toBeVisible();
    
    // Navigate to dashboard
    await page.goto('./#/dashboard');
    await page.waitForLoadState();
    
    // Dashboard should immediately show profile information
    await expect(page.getByText(/Welcome back/)).toBeVisible();
    await expect(page.getByText(/25.*years.*old/)).toBeVisible();
    await expect(page.getByText(/175.*cm/)).toBeVisible();
    await expect(page.getByText(/75.*kg/)).toBeVisible();
    
    // Should no longer show "No Profile Found" type messaging
    await expect(page.getByText('Create Profile')).not.toBeVisible();
  });

  test('should persist profile changes across page refreshes', async ({ page }) => {
    // Create and save profile
    await page.getByRole('button', { name: 'Create Profile' }).click();
    await page.getByTestId('profile-age-input').fill('30');
    await page.getByTestId('profile-sex-select').selectOption('female');
    await page.getByTestId('profile-activity-level-select').selectOption('active');
    await page.getByTestId('profile-experience-level-select').selectOption('intermediate');
    await page.getByPlaceholder(/100.*250/).fill('165');
    await page.getByPlaceholder(/30.*300/).fill('60');
    await page.getByTestId('equipment-bodyweight').check();
    await page.getByTestId('schedule-wednesday').check();
    await page.getByRole('button', { name: 'Save Profile' }).click();
    await expect(page.getByText('Profile saved successfully!')).toBeVisible();
    
    // Refresh the page
    await page.reload();
    await page.waitForLoadState();
    
    // Navigate to dashboard
    await page.goto('./#/dashboard');
    await page.waitForLoadState();
    
    // Profile should still be there with correct data
    await expect(page.getByText(/30.*years.*old/)).toBeVisible();
    await expect(page.getByText(/165.*cm/)).toBeVisible();
    await expect(page.getByText(/60.*kg/)).toBeVisible();
    await expect(page.getByText('female')).toBeVisible();
  });

  test('should update dashboard without requiring manual refresh', async ({ page }) => {
    // Create initial profile
    await page.getByRole('button', { name: 'Create Profile' }).click();
    await page.getByTestId('profile-age-input').fill('25');
    await page.getByTestId('profile-sex-select').selectOption('male');
    await page.getByTestId('profile-activity-level-select').selectOption('moderate');
    await page.getByTestId('profile-experience-level-select').selectOption('beginner');
    await page.getByPlaceholder(/100.*250/).fill('175');
    await page.getByPlaceholder(/30.*300/).fill('75');
    await page.getByTestId('equipment-bodyweight').check();
    await page.getByTestId('schedule-monday').check();
    await page.getByRole('button', { name: 'Save Profile' }).click();
    
    // Go to dashboard to confirm initial save
    await page.goto('./#/dashboard');
    await page.waitForLoadState();
    await expect(page.getByText(/25.*years.*old/)).toBeVisible();
    
    // Go back to profile and update
    await page.goto('./#/profile');
    await page.waitForLoadState();
    
    // Update the age
    await page.getByTestId('profile-age-input').fill('26');
    await page.getByRole('button', { name: 'Save Profile' }).click();
    await expect(page.getByText('Profile saved successfully!')).toBeVisible();
    
    // Go back to dashboard - should immediately show updated age
    await page.goto('./#/dashboard');
    await page.waitForLoadState();
    
    // Should show updated age without refresh
    await expect(page.getByText(/26.*years.*old/)).toBeVisible();
    await expect(page.getByText(/25.*years.*old/)).not.toBeVisible();
  });
});