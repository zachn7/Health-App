import { test, expect } from '@playwright/test';

test.describe('Onboarding Flow', () => {
  test('should navigate through age gate successfully', async ({ page }) => {
    await page.goto('/');
    
    // Should show age gate
    await expect(page.locator('h2')).toContainText('Welcome to CodePuppy Trainer');
    await expect(page.locator('input#age')).toBeVisible();
    
    // Try invalid age
    await page.fill('input#age', '12');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=You must be at least 13 years old')).toBeVisible();
    
    // Try valid age
    await page.fill('input#age', '20');
    await page.click('button[type="submit"]');
    
    // Should navigate to onboarding after age gate
    await expect(page.locator('h1')).toContainText('Welcome to CodePuppy Trainer!');
    
    // Complete onboarding
    await page.click('button:has-text("Continue to Dashboard")');
    
    // Should navigate to dashboard
    await expect(page.locator('h1')).toContainText('Dashboard');
  });
  
  test('should persist age gate acceptance', async ({ page }) => {
    await page.goto('/');
    
    // Complete age gate
    await page.fill('input#age', '25');
    await page.click('button[type="submit"]');
    
    // Navigate to onboarding
    await expect(page.locator('h1')).toContainText('Welcome to CodePuppy Trainer!');
    
    // Reload page - should not show age gate again
    await page.reload();
    await expect(page.locator('h1')).toContainText('Welcome to CodePuppy Trainer!');
  });
});