import { test, expect } from '@playwright/test';

test.describe('Smoke: Basic Routing', () => {
  test('should render main page', async ({ page }) => {
    // Complete age gate first
    await page.goto('./');
    await expect(page.getByText('Welcome to CodePuppy Trainer')).toBeVisible();
    await page.getByLabel('Confirm your age').fill('20');
    await page.getByTestId('age-gate-continue').click();
    
    // Should see onboarding page
    await expect(page.getByText('Welcome to CodePuppy Trainer!')).toBeVisible();
  });
});