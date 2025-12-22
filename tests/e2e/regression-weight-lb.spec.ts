import { test, expect } from '@playwright/test';

test.describe('Regression: Weight Log LB Persistence (R03)', () => {
  test.beforeEach(async ({ page }) => {
    // Start fresh and set up test environment
    await page.goto('about:blank');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
      // Set age gate to pass
      localStorage.setItem('age_gate_accepted', 'true');
      localStorage.setItem('age_gate_timestamp', new Date().toISOString());
    });
    
    // Navigate to progress page for weight logging
    await page.goto('./#/progress');
    await page.waitForLoadState();
  });

  test('should create profile with imperial units first', async ({ page }) => {
    // Need to create a profile with imperial units
    await page.goto('./#/profile');
    await expect(page.getByText('No Profile Found')).toBeVisible();
    await page.getByRole('button', { name: 'Create Profile' }).click();
    
    // Switch to imperial units
    await page.getByLabel('Units').selectOption('imperial');
    
    // Fill out profile in imperial
    await page.getByPlaceholder('Feet').fill('5');
    await page.getByPlaceholder('Inches').fill('9');
    await page.getByPlaceholder(/66.*661/).fill('165.3'); // 75 kg equivalent
    await page.getByLabel('Age').fill('25');
    await page.getByLabel('Sex').selectOption('male');
    await page.getByLabel('Activity Level').selectOption('moderate');
    await page.getByLabel('Experience Level').selectOption('beginner');
    await page.getByLabel('bodyweight').check();
    await page.getByLabel('monday').check();
    
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
    await page.getByLabel('Units').selectOption('imperial');
    await page.getByPlaceholder('Feet').fill('5');
    await page.getByPlaceholder('Inches').fill('9');
    await page.getByPlaceholder(/66.*661/).fill('165.3');
    await page.getByLabel('Age').fill('25');
    await page.getByLabel('Sex').selectOption('male');
    await page.getByLabel('Activity Level').selectOption('moderate');
    await page.getByLabel('Experience Level').selectOption('beginner');
    await page.getByLabel('bodyweight').check();
    await page.getByLabel('monday').check();
    await page.getByRole('button', { name: 'Save Profile' }).click();
    
    // Navigate to progress
    await page.goto('./#/progress');
    await page.waitForLoadState();
    
    // Check that weight input shows pounds (lbs)
    await expect(page.getByPlaceholder(/lbs?|pounds/i)).toBeVisible();
    await expect(page.getByText(/lbs?|pounds/i)).toBeVisible();
  });

  test('should log weight in pounds and persist correctly', async ({ page }) => {
    // Set up imperial profile
    await page.goto('./#/profile');
    await page.getByRole('button', { name: 'Create Profile' }).click();
    await page.getByLabel('Units').selectOption('imperial');
    await page.getByPlaceholder('Feet').fill('5');
    await page.getByPlaceholder('Inches').fill('9');
    await page.getByPlaceholder(/66.*661/).fill('165.3');
    await page.getByLabel('Age').fill('25');
    await page.getByLabel('Sex').selectOption('male');
    await page.getByLabel('Activity Level').selectOption('moderate');
    await page.getByLabel('Experience Level').selectOption('beginner');
    await page.getByLabel('bodyweight').check();
    await page.getByLabel('monday').check();
    await page.getByRole('button', { name: 'Save Profile' }).click();
    
    // Navigate to progress page
    await page.goto('./#/progress');
    await page.waitForLoadState();
    
    // Log weight in pounds
    await page.getByPlaceholder(/lbs?|pounds/i).fill('170.5');
    
    // Set date to today
    const today = new Date().toISOString().split('T')[0];
    await page.getByLabel(/date/i).fill(today);
    
    // Save the weight entry
    await page.getByRole('button', { name: /Log Weight|Save Weight|Add Weight/ }).click();
    
    // Should show success message
    await expect(page.getByText(/weight.*log|saved|added/i)).toBeVisible();
    
    // Should show the logged weight in the list/graph
    await expect(page.getByText(/170.5/)).toBeVisible();
    await expect(page.getByText(/lbs?|pounds/i)).toBeVisible();
  });

  test('should persist weight entries across page refreshes', async ({ page }) => {
    // Set up imperial profile and log weight
    await page.goto('./#/profile');
    await page.getByRole('button', { name: 'Create Profile' }).click();
    await page.getByLabel('Units').selectOption('imperial');
    await page.getByPlaceholder('Feet').fill('6');
    await page.getByPlaceholder('Inches').fill('0');
    await page.getByPlaceholder(/66.*661/).fill('180');
    await page.getByLabel('Age').fill('30');
    await page.getByLabel('Sex').selectOption('male');
    await page.getByLabel('Activity Level').selectOption('moderate');
    await page.getByLabel('Experience Level').selectOption('beginner');
    await page.getByLabel('bodyweight').check();
    await page.getByLabel('monday').check();
    await page.getByRole('button', { name: 'Save Profile' }).click();
    
    await page.goto('./#/progress');
    await page.waitForLoadState();
    
    // Log first weight
    await page.getByPlaceholder(/lbs?|pounds/i).fill('175.0');
    const today = new Date().toISOString().split('T')[0];
    await page.getByLabel(/date/i).fill(today);
    await page.getByRole('button', { name: /Log Weight|Save Weight|Add Weight/ }).click();
    await expect(page.getByText(/175.0/)).toBeVisible();
    
    // Log second weight (different day)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    await page.getByPlaceholder(/lbs?|pounds/i).fill('174.5');
    await page.getByLabel(/date/i).fill(yesterday);
    await page.getByRole('button', { name: /Log Weight|Save Weight|Add Weight/ }).click();
    await expect(page.getByText(/174.5/)).toBeVisible();
    
    // Refresh the page
    await page.reload();
    await page.waitForLoadState();
    
    // Both weight entries should still be there and in pounds
    await expect(page.getByText(/175.0/)).toBeVisible();
    await expect(page.getByText(/174.5/)).toBeVisible();
    await expect(page.getByText(/lbs?|pounds/i)).toBeVisible();
  });

  test('should not convert imperial weight entries to kg', async ({ page }) => {
    // Set up imperial profile
    await page.goto('./#/profile');
    await page.getByRole('button', { name: 'Create Profile' }).click();
    await page.getByLabel('Units').selectOption('imperial');
    await page.getByPlaceholder('Feet').fill('5');
    await page.getByPlaceholder('Inches').fill('10');
    await page.getByPlaceholder(/66.*661/).fill('150');
    await page.getByLabel('Age').fill('28');
    await page.getByLabel('Sex').selectOption('female');
    await page.getByLabel('Activity Level').selectOption('active');
    await page.getByLabel('Experience Level').selectOption('intermediate');
    await page.getByLabel('yoga').check();
    await page.getByLabel('wednesday').check();
    await page.getByRole('button', { name: 'Save Profile' }).click();
    
    // Navigate to progress and log weight
    await page.goto('./#/progress');
    await page.waitForLoadState();
    
    await page.getByPlaceholder(/lbs?|pounds/i).fill('160.8');
    const today = new Date().toISOString().split('T')[0];
    await page.getByLabel(/date/i).fill(today);
    await page.getByRole('button', { name: /Log Weight|Save Weight|Add Weight/ }).click();
    
    // Should show the exact value in lbs, not converted to kg
    await expect(page.getByText(/160.8/)).toBeVisible();
    await expect(page.getByText(/lbs?|pounds/i)).toBeVisible();
    
    // Should NOT show converted kg values
    await expect(page.getByText(/kg|kilogram/i)).not.toBeVisible();
    await expect(page.getByText(/72.9/)).not.toBeVisible(); // ~160.8 lbs in kg
  });

  test('should maintain imperial units preference in weight section', async ({ page }) => {
    // Create profile with imperial units
    await page.goto('./#'+'/profile');
    await page.getByRole('button', { name: 'Create Profile' }).click();
    await page.getByLabel('Units').selectOption('imperial');
    await page.getByPlaceholder('Feet').fill('5');
    await page.getByPlaceholder('Inches').fill('7');
    await page.getByPlaceholder(/66.*661/).fill('155');
    await page.getByLabel('Age').fill('35');
    await page.getByLabel('Sex').selectOption('male');
    await page.getByLabel('Activity Level').selectOption('moderate');
    await page.getByLabel('Experience Level').selectOption('advanced');
    await page.getByLabel('bodyweight').check();
    await page.getByLabel('friday').check();
    await page.getByRole('button', { name: 'Save Profile' }).click();
    
    // Navigate between pages and return to progress
    await page.goto('./#'+'/dashboard');
    await page.waitForLoadState();
    await page.goto('./#'+'/workouts');
    await page.waitForLoadState();
    await page.goto('./#/progress');
    await page.waitForLoadState();
    
    // Should still show imperial units for weight
    await expect(page.getByPlaceholder(/lbs?|pounds/i)).toBeVisible();
    await expect(page.getByText(/lbs?|pounds/i)).toBeVisible();
    await expect(page.getByPlaceholder(/kg|kilogram/i)).not.toBeVisible();
  });
});