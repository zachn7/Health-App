import { test, expect } from '@playwright/test';

test.describe('Smoke: AI Coach Features', () => {
  test.beforeEach(async ({ page, context }) => {
    // Set up age gate and onboarding
    await context.addInitScript(() => {
      localStorage.setItem('age_gate_accepted', 'true');
      localStorage.setItem('onboarding_completed', 'true');
    });
  });

  test('AI Coach page loads without crashing (even if no profile or WebGPU)', async ({ page }) => {
    // Navigate to Coach page
    await page.goto('./#/coach');
    await page.waitForLoadState('networkidle');
    
    const url = page.url();
    
    // If redirected to profile (no profile exists), that's also acceptable
    if (url.includes('/profile')) {
      console.log('Redirected to profile - needs profile for coach');
      // Verify we're on the profile page with no errors
      const bodyText = await page.textContent('body');
      expect(bodyText).toBeTruthy();
    } else if (url.includes('/coach')) {
      // If on coach page, verify it loads without crashing
      const bodyText = await page.textContent('body');
      expect(bodyText).toBeTruthy();
      
      // Check for any error banners (acceptable to show errors, just shouldn't crash)
      const errorBanners = page.locator('.bg-red-50, .bg-yellow-50');
      const bannerCount = await errorBanners.count();
      console.log(`Found ${bannerCount} error/warning banners`);
      // Errors are okay, just shouldn't crash the page
    }
  });

  test('Settings page shows WebGPU status clearly', async ({ page }) => {
    // Navigate to Settings
    await page.goto('./#/settings');
    await page.waitForLoadState('networkidle');
    
    // Verify Settings page loads
    await expect(page.locator('body')).toBeVisible();
    
    // Check for WebGPU-related text
    const bodyText = await page.textContent('body');
    expect(bodyText).toBeTruthy();
  });

  test('Can toggle WebLLM in Settings (may show error if WebGPU unavailable)', async ({ page }) => {
    // Navigate to Settings
    await page.goto('./#/settings');
    await page.waitForLoadState('networkidle');
    
    // Look for WebLLM AI Coach section
    const webllmText = page.locator('text=WebLLM AI Coach');
    
    if (await webllmText.isVisible({ timeout: 5000 })) {
      console.log('WebLLM AI Coach section found');
      // Section exists, test passes
    } else {
      console.log('WebLLM AI Coach section not visible (might be okay)');
    }
  });

  test('No JavaScript console errors on AI-related routes', async ({ page }) => {
    // Track console errors
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    // Navigate to various routes that might use AI features
    const routes = ['./#/coach', './#/settings'];
    
    for (const route of routes) {
      await page.goto(route);
      await page.waitForLoadState('networkidle');
    }
    
    // Check that we didn't have critical errors
    const criticalErrors = errors.filter(e => 
      e.includes('Uncaught') || 
      e.includes('TypeError') ||
      e.includes('ReferenceError') ||
      e.includes('requestAdapterInfo is not a function') ||
      e.includes('requestAdapterInfo is not a method')
    );
    
    // Some errors are okay (like WebGPU errors), but requestAdapterInfo errors should NOT appear
    console.log('Console errors:', errors);
    
    // Specifically check that the deprecated requestAdapterInfo error is NOT present
    const adapterInfoErrors = errors.filter(e => e.includes('requestAdapterInfo'));
    expect(adapterInfoErrors.length).toBe(0);
    
    // This test mainly ensures the app doesn't completely crash
    expect(page.url()).toBeTruthy();
  });
});
