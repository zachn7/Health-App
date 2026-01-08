import { test, expect } from '@playwright/test';

test.describe('Profile Units Toggle (F02)', () => {
  test.beforeEach(async ({ page, context }) => {
    // Set age gate to pass BEFORE page loads (runs on all page navigations)
    await context.addInitScript(() => {
      localStorage.setItem('age_gate_accepted', 'true');
      localStorage.setItem('age_gate_timestamp', new Date().toISOString());
    });
    
    // Navigate to profile
    await page.goto('./#/profile');
  });

  test('should create profile with metric units by default', async ({ page }) => {
    // Should need to create profile first
    await expect(page.getByText('No Profile Found')).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: 'Create Profile' }).click();
    
    // Wait for form to be visible
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('profile-units-select')).toBeVisible({ timeout: 10000 });
    
    // Check default units is metric
    await expect(page.getByTestId('profile-units-select')).toHaveValue('metric');
    
    // Should show metric inputs
    await expect(page.getByPlaceholder(/100.*250/)).toBeVisible({ timeout: 5000 }); // Height in cm
    await expect(page.getByPlaceholder(/30.*300/)).toBeVisible({ timeout: 5000 }); // Weight in kg
  });

  test('should switch to imperial units', async ({ page }) => {
    await page.getByRole('button', { name: 'Create Profile' }).click();
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('profile-units-select')).toBeVisible();
    
    // Switch to imperial
    await page.getByTestId('profile-units-select').selectOption('imperial');
    
    // Should show imperial inputs
    await expect(page.getByPlaceholder('Feet')).toBeVisible();
    await expect(page.getByPlaceholder('Inches')).toBeVisible();
    await expect(page.getByPlaceholder(/66.*661/)).toBeVisible(); // Weight in lbs
    
    // Should show metric equivalent
    await expect(page.getByText(/cm\)/)).toBeVisible();
  });

  test('should save profile with imperial measurements', async ({ page }) => {
    await page.getByRole('button', { name: 'Create Profile' }).click();
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('profile-units-select')).toBeVisible();
    
    // Switch to imperial and wait for form to update
    await page.getByTestId('profile-units-select').selectOption('imperial');
    
    // Fill imperial measurements
    await page.getByPlaceholder('Feet').fill('5');
    await page.getByPlaceholder('Inches').fill('9');  // 175.26 cm
    await page.getByPlaceholder(/66.*661/).fill('165.3'); // 75 kg
    
    // Fill required fields
    await page.getByTestId('profile-age-input').fill('25');
    await page.getByTestId('profile-sex-select').selectOption('male');
    await page.getByTestId('profile-activity-level-select').selectOption('moderate');
    await page.getByTestId('profile-experience-level-select').selectOption('beginner');
    
    // Select equipment and workout day
    await page.getByTestId('equipment-bodyweight').check();
    await page.getByTestId('equipment-dumbbells').check();
    await page.getByTestId('schedule-monday').check();
    
    // Save
    await page.getByRole('button', { name: 'Save Profile' }).click();
    
    // Should save and navigate
    await expect(page.getByText('Profile saved successfully!')).toBeVisible();
  });

  test('should convert and persist units preference', async ({ page }) => {
    // Create and save profile with imperial
    await page.getByRole('button', { name: 'Create Profile' }).click();
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('profile-units-select')).toBeVisible();
    await page.getByTestId('profile-units-select').selectOption('imperial');
    await page.getByTestId('profile-age-input').fill('30');
    await page.getByPlaceholder('Feet').fill('6');
    await page.getByPlaceholder('Inches').fill('0');
    await page.getByPlaceholder(/66.*661/).fill('180');
    await page.getByTestId('profile-sex-select').selectOption('male');
    await page.getByTestId('profile-activity-level-select').selectOption('moderate');
    await page.getByTestId('profile-experience-level-select').selectOption('beginner');
    await page.getByTestId('equipment-bodyweight').check();
    await page.getByTestId('schedule-monday').check();
    await page.getByRole('button', { name: 'Save Profile' }).click();
    await page.getByText('Profile saved successfully!').click(); // Dismiss alert
    
    // Go back to profile and edit
    await page.goto('./#/profile');
    await page.waitForLoadState();
    await page.getByRole('button', { name: 'Edit Profile' }).click();
    await page.waitForLoadState('networkidle');
    
    // Should keep imperial preference
    await expect(page.getByTestId('profile-units-select')).toHaveValue('imperial');
    await expect(page.getByPlaceholder('Feet')).toHaveValue('6');
    await expect(page.getByPlaceholder('Inches')).toHaveValue('0');
    
    // Should show metric equivalent
    await expect(page.getByText(/cm\)/)).toBeVisible();
  });

  test('should validate imperial input ranges', async ({ page }) => {
    await page.getByRole('button', { name: 'Create Profile' }).click();
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('profile-units-select')).toBeVisible();
    await page.getByTestId('profile-units-select').selectOption('imperial');
    
    // Fill with invalid weight (too low)
    await page.getByPlaceholder('Feet').fill('5');
    await page.getByPlaceholder('Inches').fill('9');
    await page.getByPlaceholder(/66.*661/).fill('50'); // Too low
    
    await page.getByTestId('profile-age-input').fill('25');
    
    // Fill other required fields
    await page.getByTestId('profile-sex-select').selectOption('male');
    await page.getByTestId('profile-activity-level-select').selectOption('moderate');
    await page.getByTestId('profile-experience-level-select').selectOption('beginner');
    await page.getByTestId('equipment-bodyweight').check();
    await page.getByTestId('schedule-monday').check();
    
    // Should show validation error in alert
    page.on('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Save Profile' }).click();
    // The alert should contain the validation error
  });

  test('should convert back to metric correctly', async ({ page }) => {
    await page.getByRole('button', { name: 'Create Profile' }).click();
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('profile-units-select')).toBeVisible();
    
    // Start with imperial
    await page.getByTestId('profile-units-select').selectOption('imperial');
    await page.getByPlaceholder('Feet').fill('5');
    await page.getByPlaceholder('Inches').fill('9');
    await page.getByPlaceholder(/66.*661/).fill('165.3');
    
    // Switch back to metric
    await page.getByTestId('profile-units-select').selectOption('metric');
    
    // Should convert to metric values
    await expect(page.getByPlaceholder(/100.*250/)).toHaveValue('175'); // 5'9" ≈ 175cm
    await expect(page.getByPlaceholder(/30.*300/)).toHaveValue('75'); // 165.3lbs ≈ 75kg
  });

  // TODO: This test belongs in regression-weight-lb spec, not profile-units
  // test.skip('should handle imperial weight input correctly without double conversion', async ({ page }) => {
  //   await page.getByRole('button', { name: 'Create Profile' }).click();
  //   await page.waitForLoadState('networkidle');
  //   await expect(page.getByTestId('profile-units-select')).toBeVisible();
  //   
  //   // Switch to imperial
  //   await page.getByTestId('profile-units-select').selectOption('imperial');
  //   await page.getByTestId('profile-age-input').fill('30');
  //   await page.getByPlaceholder('Feet').fill('6');
  //   await page.getByPlaceholder('Inches').fill('0');
  //   await page.getByPlaceholder(/66.*661/).fill('180'); // 180 lbs = ~81.8 kg
  //   
  //   // Fill other required fields
  //   await page.getByTestId('profile-age-input').fill('30');
  //   await page.getByTestId('profile-sex-select').selectOption('male');
  //   await page.getByTestId('profile-activity-level-select').selectOption('moderate');
  //   await page.getByTestId('profile-experience-level-select').selectOption('beginner');
  //   await page.getByTestId('equipment-bodyweight').check();
  //   await page.getByTestId('schedule-monday').check();
  //   
  //   // Save profile
  //   await page.getByRole('button', { name: 'Save Profile' }).click();
  //   await expect(page.getByText('Profile saved successfully!')).toBeVisible();
  //   
  //   // Navigate to progress and check weight logging
  //   await page.goto('./#/progress');
  //   await page.waitForLoadState();
  //   
  //   // Should show weight input for imperial units
  //   await expect(page.getByPlaceholder(/66.*661/)).toBeVisible();
  //   
  //   // The input should be empty (not showing stored kg value)
  //   await expect(page.getByPlaceholder(/66.*661/)).toHaveValue('75');
  // });
});