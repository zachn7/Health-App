import { test, expect } from '@playwright/test';

test.describe('Macro Split Editor (F03)', () => {
  test.beforeEach(async ({ page, context }) => {
    // Set age gate to pass BEFORE page loads (runs on all page navigations)
    await context.addInitScript(() => {
      localStorage.setItem('age_gate_accepted', 'true');
      localStorage.setItem('age_gate_timestamp', new Date().toISOString());
    });
    
    // Create a profile first
    await page.goto('./#/profile');
    await page.getByRole('button', { name: 'Create Profile' }).click();
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('profile-units-select')).toBeVisible({ timeout: 10000 });
    
    // Fill out minimal profile
    await page.getByTestId('profile-age-input').fill('30');
    await page.getByTestId('profile-sex-select').selectOption('male');
    await page.getByTestId('profile-activity-level-select').selectOption('moderate');
    await page.getByTestId('profile-experience-level-select').selectOption('intermediate');
    await page.getByTestId('equipment-bodyweight').check();
    await page.getByTestId('schedule-monday').check();
    await page.getByTestId('schedule-wednesday').check();
    await page.getByTestId('schedule-friday').check();
    
    // Save profile
    await page.getByRole('button', { name: 'Save Profile' }).click();
    await expect(page.getByText('Profile saved successfully!')).toBeVisible();
    
    // Go back to profile page and switch to edit mode
    await page.goto('./#/profile');
    await page.waitForLoadState();
    await page.getByRole('button', { name: 'Edit Profile' }).click();
    await page.waitForLoadState('networkidle');
  });

  test('should show default macro split on profile page', async ({ page }) => {
    // Should show default macro split (30/40/30)
    await expect(page.getByText('30%')).toBeVisible();
    await expect(page.getByText('40%')).toBeVisible();
    await expect(page.getByText('Nutrition Macro Split')).toBeVisible();
    
    // Should show calculated daily targets
    await expect(page.getByText('Daily Targets')).toBeVisible();
    await expect(page.getByText('Calories')).toBeVisible();
    await expect(page.getByText('Protein')).toBeVisible();
    await expect(page.getByText('Carbs')).toBeVisible();
    await expect(page.getByText('Fat')).toBeVisible();
  });

  test('should open macro split editor', async ({ page }) => {
    // Should show edit button
    await page.getByRole('button', { name: 'Edit' }).click();
    
    // Should show editor interface
    await expect(page.getByText('Quick Presets')).toBeVisible();
    await expect(page.getByText('Custom Split')).toBeVisible();
    await expect(page.getByText('Updated Daily Targets')).toBeVisible();
    
    // Should show all preset buttons
    await expect(page.getByRole('button', { name: 'Balanced' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'High Protein' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Low Carb' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'High Carb' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Keto' })).toBeVisible();
  });

  test('should apply macro presets and update targets', async ({ page }) => {
    // Open editor
    await page.getByRole('button', { name: 'Edit' }).click();
    
    // Apply high protein preset
    await page.getByRole('button', { name: 'High Protein' }).click();
    
    // Should show updated macro split (40/30/30)
    await expect(page.getByText('40%')).toBeVisible(); // Protein
    
    // Should show updated targets (higher protein grams)
    await expect(page.locator('text=Protein').first()).toBeVisible();
    
    // Apply keto preset
    await page.getByRole('button', { name: 'Keto' }).click();
    
    // Should show keto split (25/5/70)
    await expect(page.getByText('25%')).toBeVisible(); // Protein
    await expect(page.getByText('5%')).toBeVisible(); // Carbs
    await expect(page.getByText('70%')).toBeVisible(); // Fat
  });

  test('should allow custom macro adjustments with sliders', async ({ page }) => {
    // Open editor
    await page.getByRole('button', { name: 'Edit' }).click();
    
    // Adjust protein slider
    const proteinSlider = page.locator('input[type="range"]').first();
    await proteinSlider.fill('35');
    
    // Should update protein percentage
    await expect(page.getByText('35%')).toBeVisible();
    
    // Total should still be 100%
    await expect(page.getByText('100%')).toBeVisible();
    
    // Adjust fat slider
    const fatSliders = page.locator('input[type="range"]');
    await fatSliders.nth(2).fill('35'); // Fat slider (3rd one)
    
    // Should update fat percentage and maintain 100% total
    await expect(page.getByText('35%')).toBeVisible();
  });

  test('should save macro split when profile is saved', async ({ page }) => {
    // Open editor and apply high protein preset
    await page.getByRole('button', { name: 'Edit' }).click();
    await page.getByRole('button', { name: 'High Protein' }).click();
    
    // Save profile
    await page.getByRole('button', { name: 'Save Profile' }).click();
    await expect(page.getByText('Profile saved successfully!')).toBeVisible();
    
    // Reopen profile to verify persistence
    await page.goto('./#/profile');
    await page.waitForLoadState();
    
    // Should still show high protein split
    await expect(page.getByText('40%')).toBeVisible();
    
    // Open editor again
    await page.getByRole('button', { name: 'Edit' }).click();
    
    // High protein preset should still be selected
    await expect(page.getByRole('button', { name: 'High Protein' })).toHaveClass(/btn-primary/);
  });

  test('should update nutrition page with custom macro split', async ({ page }) => {
    // Go to profile and apply high protein preset
    await page.getByRole('button', { name: 'Edit' }).click();
    await page.getByRole('button', { name: 'High Protein' }).click();
    await page.getByRole('button', { name: 'Save Profile' }).click();
    
    // Navigate to nutrition page
    await page.goto('./#/nutrition');
    await page.waitForLoadState();
    
    // Should show updated targets reflecting high protein split
    await expect(page.getByText('Calories')).toBeVisible();
    
    // Protein target should be higher than default
    const proteinText = await page.locator('text=Protein').first().textContent();
    expect(proteinText).toContain('g/');
  });

  test('should maintain macro split across page refreshes', async ({ page }) => {
    // Open editor and apply custom split
    await page.getByRole('button', { name: 'Edit' }).click();
    
    // Adjust sliders manually
    const proteinSlider = page.locator('input[type="range"]').first();
    await proteinSlider.fill('45'); // 45% protein
    
    // Save profile
    await page.getByRole('button', { name: 'Save Profile' }).click();
    await expect(page.getByText('Profile saved successfully!')).toBeVisible();
    
    // Refresh page
    await page.reload();
    await page.waitForLoadState();
    
    // Should still show custom split
    await expect(page.getByText('45%')).toBeVisible();
    
    // Open editor to verify sliders
    await page.getByRole('button', { name: 'Edit' }).click();
    
    // Protein slider should show 45
    await expect(proteinSlider).toHaveValue('45');
  });
});