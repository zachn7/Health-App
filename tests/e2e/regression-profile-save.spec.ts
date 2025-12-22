import { test, expect } from '@playwright/test';

test.describe('Regression: Profile Save -> Dashboard Update (R01)', () => {
  test.beforeEach(async ({ page }) => {
    // Start fresh and navigate to profile
    await page.goto('about:blank');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
      // Set age gate to pass
      localStorage.setItem('age_gate_accepted', 'true');
      localStorage.setItem('age_gate_timestamp', new Date().toISOString());
    });
    await page.goto('./#/profile');
  });

  test('should update dashboard immediately after saving profile', async ({ page }) => {
    // Should need to create profile first
    await expect(page.getByText('No Profile Found')).toBeVisible();
    await page.getByRole('button', { name: 'Create Profile' }).click();
    
    // Fill out profile form
    await page.getByLabel('Age').fill('25');
    await page.getByLabel('Sex').selectOption('male');
    await page.getByLabel('Activity Level').selectOption('moderate');
    await page.getByLabel('Experience Level').selectOption('beginner');
    
    // Fill health metrics
    await page.getByPlaceholder(/100.*250/).fill('175'); // Height in cm
    await page.getByPlaceholder(/30.*300/).fill('75'); // Weight in kg
    
    // Select equipment and workout day
    await page.getByLabel('bodyweight').check();
    await page.getByLabel('monday').check();
    
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
    await page.getByLabel('Age').fill('30');
    await page.getByLabel('Sex').selectOption('female');
    await page.getByLabel('Activity Level').selectOption('active');
    await page.getByLabel('Experience Level').selectOption('intermediate');
    await page.getByPlaceholder(/100.*250/).fill('165');
    await page.getByPlaceholder(/30.*300/).fill('60');
    await page.getByLabel('yoga').check();
    await page.getByLabel('wednesday').check();
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
    await page.getByLabel('Age').fill('25');
    await page.getByLabel('Sex').selectOption('male');
    await page.getByLabel('Activity Level').selectOption('moderate');
    await page.getByLabel('Experience Level').selectOption('beginner');
    await page.getByPlaceholder(/100.*250/).fill('175');
    await page.getByPlaceholder(/30.*300/).fill('75');
    await page.getByLabel('bodyweight').check();
    await page.getByLabel('monday').check();
    await page.getByRole('button', { name: 'Save Profile' }).click();
    
    // Go to dashboard to confirm initial save
    await page.goto('./#/dashboard');
    await page.waitForLoadState();
    await expect(page.getByText(/25.*years.*old/)).toBeVisible();
    
    // Go back to profile and update
    await page.goto('./#/profile');
    await page.waitForLoadState();
    
    // Update the age
    await page.getByLabel('Age').fill('26');
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