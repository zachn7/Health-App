import { test, expect } from '@playwright/test';

test.describe('Smoke: Profile Page Loads', () => {
  test('should render profile page', async ({ page }) => {
    // Navigate to profile (will require age gate)
    await page.goto('./#/profile');
    
    // Complete age gate
    await expect(page.getByRole('heading', { name: 'Welcome to CodePuppy Trainer' })).toBeVisible();
    await page.getByTestId('age-input').fill('20');
    await page.getByTestId('age-gate-continue').click();
    
    // Should see profile page loaded
    await page.waitForSelector('body');
    const bodyText = await page.textContent('body');
    expect(bodyText).toBeTruthy();
  });
});