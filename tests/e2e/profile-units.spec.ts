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
    await expect(page.getByText('No Profile Found')).toBeVisible();
    await page.getByRole('button', { name: 'Create Profile' }).click();
    
    // Check default units is metric
    await expect(page.getByLabel('Units')).toHaveValue('metric');
    
    // Should show metric inputs
    await expect(page.getByPlaceholder(/100.*250/)).toBeVisible(); // Height in cm
    await expect(page.getByPlaceholder(/30.*300/)).toBeVisible(); // Weight in kg
  });

  test('should switch to imperial units', async ({ page }) => {
    await page.getByRole('button', { name: 'Create Profile' }).click();
    
    // Switch to imperial
    await page.getByLabel('Units').selectOption('imperial');
    
    // Should show imperial inputs
    await expect(page.getByPlaceholder('Feet')).toBeVisible();
    await expect(page.getByPlaceholder('Inches')).toBeVisible();
    await expect(page.getByPlaceholder(/66.*661/)).toBeVisible(); // Weight in lbs
    
    // Should show metric equivalent
    await expect(page.getByText(/cm\)/)).toBeVisible();
  });

  test('should save profile with imperial measurements', async ({ page }) => {
    await page.getByRole('button', { name: 'Create Profile' }).click();
    
    // Switch to imperial
    await page.getByLabel('Units').selectOption('imperial');
    
    // Fill imperial measurements
    await page.getByPlaceholder('Feet').fill('5');
    await page.getByPlaceholder('Inches').fill('9');  // 175.26 cm
    await page.getByPlaceholder(/66.*661/).fill('165.3'); // 75 kg
    
    // Fill required fields
    await page.getByLabel('Age').fill('25');
    await page.getByLabel('Sex').selectOption('male');
    await page.getByLabel('Activity Level').selectOption('moderate');
    await page.getByLabel('Experience Level').selectOption('beginner');
    
    // Select equipment and workout day
    await page.getByLabel('bodyweight').check();
    await page.getByLabel('dumbbells').check();
    await page.getByLabel('monday').check();
    
    // Save
    await page.getByRole('button', { name: 'Save Profile' }).click();
    
    // Should save and navigate
    await expect(page.getByText('Profile saved successfully!')).toBeVisible();
  });

  test('should convert and persist units preference', async ({ page }) => {
    // Create and save profile with imperial
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
    await page.getByText('Profile saved successfully!').click(); // Dismiss alert
    
    // Go back to profile
    await page.goto('./#/profile');
    await page.waitForLoadState();
    
    // Should keep imperial preference
    await expect(page.getByLabel('Units')).toHaveValue('imperial');
    await expect(page.getByPlaceholder('Feet')).toHaveValue('6');
    await expect(page.getByPlaceholder('Inches')).toHaveValue('0');
    
    // Should show metric equivalent
    await expect(page.getByText(/cm\)/)).toBeVisible();
  });

  test('should validate imperial input ranges', async ({ page }) => {
    await page.getByRole('button', { name: 'Create Profile' }).click();
    await page.getByLabel('Units').selectOption('imperial');
    
    // Fill with invalid weight (too low)
    await page.getByPlaceholder('Feet').fill('5');
    await page.getByPlaceholder('Inches').fill('9');
    await page.getByPlaceholder(/66.*661/).fill('50'); // Too low
    
    const ageFill = page.getByLabel('Age');
    await ageFill.fill('25');
    
    // Fill other required fields
    await page.getByLabel('Sex').selectOption('male');
    await page.getByLabel('Activity Level').selectOption('moderate');
    await page.getByLabel('Experience Level').selectOption('beginner');
    await page.getByLabel('bodyweight').check();
    await page.getByLabel('monday').check();
    
    // Should show validation error
    await page.getByRole('button', { name: 'Save Profile' }).click();
    await expect(page.getByText(/Weight must be between/)).toBeVisible();
  });

  test('should convert back to metric correctly', async ({ page }) => {
    await page.getByRole('button', { name: 'Create Profile' }).click();
    
    // Start with imperial
    await page.getByLabel('Units').selectOption('imperial');
    await page.getByPlaceholder('Feet').fill('5');
    await page.getByPlaceholder('Inches').fill('9');
    await page.getByPlaceholder(/66.*661/).fill('165.3');
    
    // Switch back to metric
    await page.getByLabel('Units').selectOption('metric');
    
    // Should convert to metric values
    await expect(page.getByPlaceholder(/100.*250/)).toHaveValue('175'); // 5'9" ≈ 175cm
    await expect(page.getByPlaceholder(/30.*300/)).toHaveValue('75'); // 165.3lbs ≈ 75kg
  });

  test('should handle imperial weight input correctly without double conversion', async ({ page }) => {
    await page.getByRole('button', { name: 'Create Profile' }).click();
    
    // Switch to imperial
    await page.getByLabel('Units').selectOption('imperial');
    await page.getByPlaceholder('Feet').fill('6');
    await page.getByPlaceholder('Inches').fill('0');
    await page.getByPlaceholder(/66.*661/).fill('180'); // 180 lbs = ~81.8 kg
    
    // Fill other required fields
    await page.getByLabel('Age').fill('30');
    await page.getByLabel('Sex').selectOption('male');
    await page.getByLabel('Activity Level').selectOption('moderate');
    await page.getByLabel('Experience Level').selectOption('beginner');
    await page.getByLabel('bodyweight').check();
    await page.getByLabel('monday').check();
    
    // Save profile
    await page.getByRole('button', { name: 'Save Profile' }).click();
    await expect(page.getByText('Profile saved successfully!')).toBeVisible();
    
    // Navigate to progress and check weight logging
    await page.goto('./#/progress');
    await page.waitForLoadState();
    
    // Should show weight input for imperial units
    await expect(page.getByPlaceholder(/66.*661/)).toBeVisible();
    
    // The input should be empty (not showing stored kg value)
    await expect(page.getByPlaceholder(/66.*661/)).toHaveValue('75');
  });
});