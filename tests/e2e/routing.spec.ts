import { test, expect } from '@playwright/test';

test.describe('Legal Page Routing', () => {
  test('should navigate to legal pages using hash routing', async ({ page }) => {
    // Start with age gate completed
    await page.goto('/');
    await page.fill('input#age', '20');
    await page.click('button[type="submit"]');
    await page.click('button:has-text("Continue to Dashboard")');
    
    // Navigate to Privacy Policy via footer link
    await page.click('a[href="#/legal/privacy"]');
    await expect(page.locator('h1')).toContainText('Privacy Policy');
    expect(page.url()).toContain('#/legal/privacy');
    
    // Navigate to Terms of Use
    await page.click('a[href="#/legal/terms"]');
    await expect(page.locator('h1')).toContainText('Terms of Use');
    expect(page.url()).toContain('#/legal/terms');
    
    // Navigate to Medical Disclaimer
    await page.click('a[href="#/legal/disclaimer"]');
    await expect(page.locator('h1')).toContainText('Medical Disclaimer');
    expect(page.url()).toContain('#/legal/disclaimer');
  });
  
  test('should handle direct navigation to legal pages', async ({ page }) => {
    // Complete age gate first
    await page.goto('/');
    await page.fill('input#age', '20');
    await page.click('button[type="submit"]');
    await page.click('button:has-text("Continue to Dashboard")');
    
    // Direct navigation to privacy policy
    await page.goto('/#/legal/privacy');
    await expect(page.locator('h1')).toContainText('Privacy Policy');
    
    // Refresh should work (not 404)
    await page.reload();
    await expect(page.locator('h1')).toContainText('Privacy Policy');
  });
  
  test('should handle legal links from age gate', async ({ page }) => {
    await page.goto('/');
    
    // Terms link from age gate
    await page.click('a[href="#/legal/terms"]');
    await expect(page.locator('h1')).toContainText('Terms of Use');
    
    // Go back to age gate
    await page.goBack();
    
    // Privacy link from age gate
    await page.click('a[href="#/legal/privacy"]');
    await expect(page.locator('h1')).toContainText('Privacy Policy');
  });
});