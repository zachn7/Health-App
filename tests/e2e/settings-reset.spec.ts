import { test, expect } from '@playwright/test';
import { bootstrapAppState, gotoApp } from './helpers/bootstrap';

test.describe('Settings: Reset App Data', () => {
  test.beforeEach(async ({ context }) => {
    await bootstrapAppState(context, {
      clearStorage: true,
      completeOnboarding: true,
      seedProfile: true,
      profile: {
        age: 30,
        sex: 'male',
        activityLevel: 'moderate',
        experienceLevel: 'intermediate',
        equipment: ['barbell', 'dumbbell'],
        schedule: ['monday', 'wednesday', 'friday'],
        heightCm: 180,
        weightKg: 80,
      },
    });
  });

  test('should reset app data and reload the page', async ({ page }) => {
    // Navigate to Settings
    await gotoApp(page, '/settings');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible({ timeout: 10_000 });
    
    // Get initial URL
    const initialUrl = page.url();
    console.log('Initial URL:', initialUrl);
    
    // Find the reset button
    const resetButton = page.getByTestId('reset-app-data-btn');
    await expect(resetButton).toBeVisible({ timeout: 5000 });
    
    // Handle the confirmation dialog
    page.on('dialog', async dialog => {
      expect(dialog.message()).toContain('Warning: This will permanently delete all your data');
      await dialog.accept();
    });
    
    // Click reset button
    await resetButton.click();
    
    // Wait for page reload - the reload uses a cache-busting query param
    await page.waitForURL(url => url.toString().includes('reset='), { timeout: 15_000 });

    // Check that the URL changed (has reset parameter)
    const url = page.url();
    console.log('URL after reset:', url);
    expect(url).toContain('reset=');
    expect(url).not.toEqual(initialUrl);
    
    // Wait for the new page to load
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
    
    // Verify the page reloaded and is in a valid state
    const bodyContent = await page.textContent('body');
    expect(bodyContent?.length).toBeGreaterThan(50);
    
    console.log('✅ App reset successfully and page reloaded');
  });

  test('should show confirmation dialog before reset', async ({ page }) => {
    await gotoApp(page, '/settings');
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('reset-app-data-btn')).toBeVisible({ timeout: 10_000 });
    
    const resetButton = page.getByTestId('reset-app-data-btn');
    await expect(resetButton).toBeVisible();
    
    // Click reset button and wait for dialog
    let dialogShown = false;
    let dialogMessage = '';
    
    page.on('dialog', dialog => {
      dialogShown = true;
      dialogMessage = dialog.message();
      // Dismiss it to continue with test
      dialog.dismiss();
    });
    
    await resetButton.click();

    // Verify dialog was shown
    await expect.poll(() => dialogShown, { timeout: 5_000 }).toBeTruthy();
    expect(dialogMessage).toContain('Warning: This will permanently delete all your data');
    expect(dialogMessage).toContain('profiles');
    expect(dialogMessage).toContain('cannot be undone');
    
    console.log('✅ Confirmation dialog shown with proper warning');
  });

  test('should NOT reset when dialog is cancelled', async ({ page }) => {
    const initialUrl = await page.url();
    
    await gotoApp(page, '/settings');
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('reset-app-data-btn')).toBeVisible({ timeout: 10_000 });
    
    const resetButton = page.getByTestId('reset-app-data-btn');
    
    // Click reset and dismiss dialog
    page.on('dialog', dialog => {
      dialog.dismiss();
    });
    
    await resetButton.click();

    // Verify we're still on settings page (no reload)
    await expect(page).toHaveURL(/#\/settings/);
    const currentUrl = page.url();
    expect(currentUrl).toContain('/settings');
    
    // Settings page should still be visible
    const settingsHeading = page.getByRole('heading', { name: 'Settings' });
    await expect(settingsHeading).toBeVisible();
    
    console.log('✅ Reset cancelled, page still on Settings');
  });

  test('should have reset button visible in settings', async ({ page }) => {
    await gotoApp(page, '/settings');
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('reset-app-data-btn')).toBeVisible({ timeout: 10_000 });
    
    // Verify reset button exists and is visible
    const resetButton = page.getByTestId('reset-app-data-btn');
    await expect(resetButton).toBeVisible();
    
    // Verify button text
    await expect(resetButton).toHaveText('Reset App Data & Reload');
    
    console.log('✅ Reset button visible with correct text');
  });

  test('should show detailed explanation near reset button', async ({ page }) => {
    await gotoApp(page, '/settings');
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('reset-app-data-btn')).toBeVisible({ timeout: 10_000 });
    
    const resetButton = page.getByTestId('reset-app-data-btn');
    
    // Look for the explanation text near the button
    const pageContent = await page.textContent('body');
    
    const hasExplanation = 
      pageContent?.toLowerCase().includes('reset all local data') ||
      pageContent?.toLowerCase().includes('cached assets') ||
      pageContent?.toLowerCase().includes('clean state') ||
      pageContent?.toLowerCase().includes('testing new deployments');
    
    expect(hasExplanation).toBeTruthy();
    console.log('✅ Reset feature has user-friendly explanation');
  });
});
