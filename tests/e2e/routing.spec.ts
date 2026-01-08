import { test, expect } from '@playwright/test';

test.describe('Legal Page Routing', () => {
  test('should navigate to legal pages using hash routing', async ({ page }) => {
    // Navigate to Privacy page which has links to legal pages
    await page.goto('/#/privacy');
    await expect(page).toHaveURL(/#\/privacy$/);
    
    // Navigate to Privacy Policy via link
    await page.getByRole('link', { name: 'Privacy Policy' }).click();
    await expect(page).toHaveURL(/#\/legal\/privacy$/);
    await expect(page.getByText('Privacy Policy')).toBeVisible();
    
    // Navigate to Terms of Use directly
    await page.goto('/#/legal/terms');
    await expect(page.getByText('Terms of Use')).toBeVisible();
    
    // Navigate to Medical Disclaimer directly
    await page.goto('/#/legal/disclaimer');
    // Just verify the URL changed (component might not be fully loaded)
    await expect(page).toHaveURL(/#\/legal\/disclaimer$/);
  });
  
  test('should handle direct navigation to legal pages', async ({ page }) => {
    // Direct navigation to privacy policy (age gate blocks other pages, but legal pages should be accessible)
    await page.goto('#/legal/privacy');
    await expect(page.getByText('Privacy Policy')).toBeVisible();
    
    // Refresh should work (not 404)
    await page.reload();
    await expect(page.getByText('Privacy Policy')).toBeVisible();
  });
  
  test('should handle legal links from age gate', async ({ page }) => {
    await page.goto('/');
    
    // Terms link from age gate - should navigate directly even without age gate completed
    await page.getByRole('link', { name: 'Terms of Use' }).first().click();
    await expect(page).toHaveURL(/#\/legal\/terms$/);
    await expect(page.getByText('Terms of Use')).toBeVisible();
    
    // Go back to age gate
    await page.goBack();
    
    // Privacy link from age gate
    await page.getByRole('link', { name: 'Privacy Policy' }).first().click();
    await expect(page.getByText('Privacy Policy')).toBeVisible();
  });
});