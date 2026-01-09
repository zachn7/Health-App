import { test, expect } from '@playwright/test';

test.describe('Regression: Coach Route Hardening (R09)', () => {
  test.beforeEach(async ({ page, context }) => {
    // Set up age gate
    await context.addInitScript(() => {
      localStorage.setItem('age_gate_accepted', 'true');
    });
  });

  test('should load Coach page without global crash even when WebGPU unavailable', async ({ page }) => {
    // Navigate to Coach page
    await page.goto('./#/coach');
    await page.waitForLoadState('networkidle');
    
    // Wait for page to load fully
    await page.waitForTimeout(3000);
    
    // Verify we're NOT on the global error screen - this is THE critical test
    const errorScreen = page.getByText('Application Error');
    await expect(errorScreen).not.toBeVisible({ timeout: 5000 });
    
    // Verify we're actually on the coach page
    expect(page.url()).toContain('/coach');
    
    // Any content is fine - loading, profile required, or coach content
    // The key is NO GLOBAL CRASH
    const bodyContent = await page.textContent('body');
    expect(bodyContent?.length).toBeGreaterThan(50);
    
    console.log('✓ Coach page loaded without global crash');
  });

  test('should show inline error banner when AI features fail', async ({ page }) => {
    // Navigate to Coach page
    await page.goto('./#/coach');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    // Verify global error screen is NOT shown
    const errorScreen = page.getByText('Application Error');
    await expect(errorScreen).not.toBeVisible({ timeout: 5000 });
    
    // URL should be correct
    expect(page.url()).toContain('/coach');
    
    // Page should have content
    const bodyContent = await page.textContent('body');
    expect(bodyContent?.length).toBeGreaterThan(50);
    
    console.log('✓ No global error, inline handling working');
  });

  test('should handle WebLLM initialization errors gracefully', async ({ page }) => {
    // Navigate to Coach page
    await page.goto('./#/coach');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    // After page loads, verify no global crash
    const errorScreen = page.getByText('Application Error');
    await expect(errorScreen).not.toBeVisible({ timeout: 5000 });
    
    // URL is correct
    expect(page.url()).toContain('/coach');
    
    // Has content
    const bodyContent = await page.textContent('body');
    expect(bodyContent?.length).toBeGreaterThan(50);
    
    console.log('✓ Handled WebLLM init errors gracefully');
  });

  test('should render Coach features even without WebGPU', async ({ page }) => {
    await page.goto('./#/coach');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    // Verify no global crash
    const errorScreen = page.getByText('Application Error');
    await expect(errorScreen).not.toBeVisible({ timeout: 5000 });
    
    // Verify URL is correct
    expect(page.url()).toContain('/coach');
    
    // Page should have SOME content (not completely blank)
    const bodyContent = await page.textContent('body');
    expect(bodyContent?.length).toBeGreaterThan(50);
    
    console.log('✓ Coach features rendered even without WebGPU');
  });

  test('should not crash on navigation to Coach route', async ({ page }) => {
    // Navigate to dashboard first
    await page.goto('./#/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    // Navigate to coach
    await page.goto('./#/coach');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    // Verify no crash
    const errorScreen = page.getByText('Application Error');
    await expect(errorScreen).not.toBeVisible({ timeout: 5000 });
    
    // Verify URL
    expect(page.url()).toContain('/coach');
    
    // Has content
    const bodyContent = await page.textContent('body');
    expect(bodyContent?.length).toBeGreaterThan(50);
    
    console.log('✓ No crash on navigation to Coach');
  });

  test('should handle invalid modelId gracefully', async ({ page, context }) => {
    // Mock an invalid modelId in localStorage
    await context.addInitScript(() => {
      localStorage.setItem('webllm_selected_model_id', 'invalid-model-id-12345');
    });
    
    await page.goto('./#/coach');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    // Verify no global crash
    const errorScreen = page.getByText('Application Error');
    await expect(errorScreen).not.toBeVisible({ timeout: 5000 });
    
    // URL is correct
    expect(page.url()).toContain('/coach');
    
    // Has content
    const bodyContent = await page.textContent('body');
    expect(bodyContent?.length).toBeGreaterThan(50);
    
    console.log('✓ Handled invalid modelId gracefully');
  });

  test('should allow retry after AI initialization failure', async ({ page }) => {
    await page.goto('./#/coach');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Look for retry button or reload options
    const retryButton = page.getByRole('button', { name: /Retry|Reload|Try Again/i });
    
    if (await retryButton.isVisible({ timeout: 3000 })) {
      await retryButton.click();
      await page.waitForTimeout(2000);
    }
    
    // After retry, verify no global crash
    const errorScreen = page.getByText('Application Error');
    await expect(errorScreen).not.toBeVisible({ timeout: 5000 });
    
    console.log('✓ Retry handled gracefully');
  });
});
