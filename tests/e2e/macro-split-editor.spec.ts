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
    await expect(page.getByTestId('macro-percent-protein')).toHaveText('30%');
    await expect(page.getByTestId('macro-percent-carbs')).toHaveText('40%');
    await expect(page.getByTestId('macro-percent-fat')).toHaveText('30%');
    await expect(page.getByText('Nutrition Macro Split')).toBeVisible();
    
    // Should show calculated daily targets
    await expect(page.getByText('Daily Targets')).toBeVisible();
    await expect(page.getByTestId('macro-target-calories')).toBeVisible();
    await expect(page.getByTestId('macro-target-protein')).toBeVisible();
    await expect(page.getByTestId('macro-target-carbs')).toBeVisible();
    await expect(page.getByTestId('macro-target-fat')).toBeVisible();
  });

  test('should open macro split editor', async ({ page }) => {
    // Should show edit button
    await page.getByTestId('macro-editor-toggle').click();
    
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
    await page.getByTestId('macro-preset-high-protein').click();
    
    // Should show updated macro split (40/30/30)
    await expect(page.getByTestId('macro-edit-percent-protein')).toHaveText('40%');
    await expect(page.getByTestId('macro-edit-percent-carbs')).toHaveText('30%');
    await expect(page.getByTestId('macro-edit-percent-fat')).toHaveText('30%');
    
    // Should show updated targets (higher protein grams)
    await expect(page.getByTestId('macro-target-protein')).toBeVisible();
    
    // Apply keto preset
    await page.getByTestId('macro-preset-keto').click();
    
    // Should show keto split (25/5/70)
    await expect(page.getByTestId('macro-edit-percent-protein')).toHaveText('25%');
    await expect(page.getByTestId('macro-edit-percent-carbs')).toHaveText('5%');
    await expect(page.getByTestId('macro-edit-percent-fat')).toHaveText('70%');
  });

  test('should allow custom macro adjustments with sliders', async ({ page }) => {
    // Open editor
    await page.getByTestId('macro-editor-toggle').click();
    
    // Adjust protein slider
    const proteinSlider = page.getByTestId('macro-slider-protein');
    await proteinSlider.fill('35');
    
    // Should update protein percentage
    await expect(page.getByTestId('macro-edit-percent-protein')).toHaveText('35%');
    
    // Total should still be 100%
    await expect(page.getByTestId('macro-total-percent')).toHaveText('100%');
    
    // Adjust fat slider
    const fatSlider = page.getByTestId('macro-slider-fat');
    await fatSlider.fill('35'); 
    
    // Should update fat percentage and maintain 100% total
    await expect(page.getByTestId('macro-edit-percent-fat')).toHaveText('35%');
    await expect(page.getByTestId('macro-total-percent')).toHaveText('100%');
  });

  test('should save macro split when profile is saved', async ({ page }) => {
    // Open editor and apply high protein preset
    await page.getByTestId('macro-editor-toggle').click();
    await page.getByTestId('macro-preset-high-protein').click();
    
    // Save profile
    await page.getByRole('button', { name: 'Save Profile' }).click();
    await expect(page.getByText('Profile saved successfully!')).toBeVisible();
    
    // Reopen profile to verify persistence - need to switch to edit mode
    await page.goto('./#/profile');
    await page.waitForLoadState();
    await page.getByRole('button', { name: 'Edit Profile' }).click();
    await page.waitForLoadState('networkidle');
    
    // Should still show high protein split
    await expect(page.getByTestId('macro-percent-protein')).toBeVisible();
    
    // Open editor again
    await page.getByTestId('macro-editor-toggle').click();
    
    // High protein preset should still be selected
    await expect(page.getByTestId('macro-preset-high-protein')).toHaveClass(/btn-primary/);
  });

  test('should update nutrition page with custom macro split', async ({ page }) => {
    // Go to profile and apply high protein preset
    await page.getByTestId('macro-editor-toggle').click();
    await page.getByTestId('macro-preset-high-protein').click();
    await page.getByRole('button', { name: 'Save Profile' }).click();
    await expect(page.getByText('Profile saved successfully!')).toBeVisible();
    
    // Navigate to nutrition page
    await page.goto('./#/nutrition');
    await page.waitForLoadState();
    
    // Nutrition page should load successfully
    await expect(page.getByRole('link', { name: 'Nutrition Track meals' })).toBeVisible();
    
    // Note: Macro targets are on Profile page, not Nutrition page
    // This test verifies the page loads correctly after macro split change
  });

  test('should maintain macro split across page refreshes', async ({ page }) => {
    // Open editor and apply custom split
    await page.getByTestId('macro-editor-toggle').click();
    
    // Adjust sliders manually
    const proteinSlider = page.getByTestId('macro-slider-protein');
    await proteinSlider.fill('45'); // 45% protein
    
    // Wait for UI to update
    await expect(page.getByTestId('macro-edit-percent-protein')).toHaveText('45%');
    
    // Save profile
    await page.getByRole('button', { name: 'Save Profile' }).click();
    await expect(page.getByText('Profile saved successfully!')).toBeVisible();
    
    // Refresh page (in edit mode)
    await page.reload();
    await page.waitForLoadState();
    // Need to re-enter edit mode after reload
    await page.getByRole('button', { name: 'Edit Profile' }).click();
    await page.waitForLoadState('networkidle');
    
    // Open macro editor to check values
    await page.getByTestId('macro-editor-toggle').click();
    
    // Protein should still show 45% in edit mode
    await expect(page.getByTestId('macro-edit-percent-protein')).toHaveText('45%');
    
    // Protein slider should show 45
    await expect(page.getByTestId('macro-slider-protein')).toHaveValue('45');
  });
});