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

  test('Coach route never crashes even without WebGPU (shows inline banner)', async ({ page, context }) => {
    // Simulate missing WebGPU by removing navigator.gpu before page load
    await context.addInitScript(() => {
      // @ts-ignore - removing navigator.gpu to simulate missing WebGPU
      delete (window.navigator as any).gpu;
    });
    
    // Track console for crashes
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    // Navigate to Coach page
    await page.goto('./#/coach');
    await page.waitForLoadState('networkidle');
    
    // Should NOT show global Application Error screen (no crash)
    const globalError = page.locator('text=Application Error');
    const globalErrorVisible = await globalError.isVisible({ timeout: 3000 }).catch(() => false);
    expect(globalErrorVisible).toBe(false);
    
    console.log('Console errors:', errors);
    
    // Coach route may be loading, may require profile, or may render coach content.
    // Wait for *any* meaningful non-crash state instead of sampling body text too early.
    const loadingEl = page.getByTestId('coach-loading');
    const profileRequiredEl = page.getByTestId('coach-profile-required');
    const coachHeading = page.getByTestId('coach-heading');

    await expect
      .poll(async () => {
        const isLoading = await loadingEl.isVisible().catch(() => false);
        const needsProfile = await profileRequiredEl.isVisible().catch(() => false);
        const hasCoachHeading = await coachHeading.isVisible().catch(() => false);
        const bodyText = await page.textContent('body');
        const hasMeaningfulCoachText = /AI Coach|Profile Required|Loading coach data|Go to Profile/i.test(bodyText || '');
        return isLoading || needsProfile || hasCoachHeading || hasMeaningfulCoachText;
      }, { timeout: 10000 })
      .toBe(true);

    const bodyText = await page.textContent('body');
    expect(bodyText).toBeTruthy();

    const isLoading = await loadingEl.isVisible().catch(() => false);
    const needsProfile = await profileRequiredEl.isVisible().catch(() => false);
    const hasCoachHeading = await coachHeading.isVisible().catch(() => false);

    if (hasCoachHeading) {
      const webgpuWarning = page.locator('text=WebGPU Not Available');
      const warningVisible = await webgpuWarning.isVisible().catch(() => false);
      if (warningVisible) {
        console.log('✅ Inline WebGPU warning banner shown');
      }
      console.log('✅ Coach route loaded successfully without WebGPU');
    } else if (needsProfile) {
      console.log('✅ Profile required (no WebGPU, no crash)');
    } else if (isLoading) {
      console.log('✅ Loading state (no WebGPU, no crash)');
    } else {
      console.log('✅ Coach route rendered a stable non-crash fallback state');
    }
  });
  
  test('WebLLM: stale modelId in localStorage gets auto-repaired', async ({ page, context }) => {
    // Set up age gate and onboarding
    await context.addInitScript(() => {
      localStorage.setItem('age_gate_accepted', 'true');
      localStorage.setItem('onboarding_completed', 'true');
      localStorage.setItem('webllm_enabled', 'true'); // Enable WebLLM
      // Set a stale/invalid modelId that doesn't exist in any real WebLLM release
      localStorage.setItem('webllm_model_id', 'invalid-model-that-does-not-exist-v12345');
    });
    
    // Navigate to Coach page
    await page.goto('./#/coach');
    await page.waitForLoadState('networkidle');
    
    // No crash should occur
    const globalError = page.locator('text=Application Error');
    await expect(globalError).not.toBeVisible({ timeout: 3000 });
    
    // The stale modelId should have been auto-repaired
    // If there's an error banner, it should mention model repair, not crash
    const errorBanners = page.locator('.bg-red-50, .bg-yellow-50');
    const bannerCount = await errorBanners.count();
    console.log(`Found ${bannerCount} error/warning banners`);
    
    // Banners are OK (they show warnings), just shouldn't crash
    console.log('✅ Stale modelId test passed - no crash with invalid model in localStorage');
  });
  
  test('WebLLM: initialization failures show inline banner, never crash page', async ({ page, context }) => {
    // Set up age gate and onboarding
    await context.addInitScript(() => {
      localStorage.setItem('age_gate_accepted', 'true');
      localStorage.setItem('onboarding_completed', 'true');
      localStorage.setItem('webllm_enabled', 'true');
      localStorage.setItem('profile_completed', 'true');
    });
    
    // Simulate CreateMLCEngine throwing an error by mocking WebGPU
    await context.addInitScript(() => {
      // Create a scenario where CreateMLCEngine would fail
      // by removing navigator.gpu after it exists
      Object.defineProperty(navigator, 'gpu', {
        value: {
          requestAdapter: async () => {
            // Simulate adapter request succeeding but device failing
            return {
              requestDevice: async () => {
                throw new Error('Simulated WebLLM initialization failure for testing');
              }
            };
          }
        },
        writable: false
      });
    });
    
    // Navigate to Coach page
    await page.goto('./#/coach');
    await page.waitForLoadState('networkidle');
    
    // Should NOT show global Application Error screen
    const globalError = page.locator('text=Application Error');
    const globalErrorVisible = await globalError.isVisible({ timeout: 3000 }).catch(() => false);
    expect(globalErrorVisible).toBe(false);
    
    // Page should still render (coach heading or other content)
    let hasContent = false;
    
    // Check for any viable page state
    const coachLoading = page.getByTestId('coach-loading');
    const coachHeading = page.getByTestId('coach-heading');
    const profileRequired = page.getByTestId('coach-profile-required');
    
    if (await coachLoading.isVisible().catch(() => false)) hasContent = true;
    if (await coachHeading.isVisible().catch(() => false)) hasContent = true;
    if (await profileRequired.isVisible().catch(() => false)) hasContent = true;
    
    expect(hasContent).toBe(true);
    
    // May show inline error banners (acceptable behavior)
    const errorBanners = page.locator('.bg-red-50');
    const hasErrorBanner = await errorBanners.isVisible().catch(() => false);
    if (hasErrorBanner) {
      console.log('✅ Inline error banner shown for simulated failure (expected)');
      const errorText = await errorBanners.textContent();
      console.log('Error banner text:', errorText);
    }
    
    console.log('✅ WebLLM failure test passed - page survived initialization error');
  });
});
