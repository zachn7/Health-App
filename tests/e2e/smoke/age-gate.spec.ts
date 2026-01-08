import { test, expect } from '@playwright/test';

test.describe('Smoke: Age Gate', () => {
  test('should navigate to onboarding when age >= 13', async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
    
    // Should see age gate initially
    await expect(page.getByRole('heading', { name: 'Welcome to CodePuppy Trainer' })).toBeVisible();
    await expect(page.getByTestId('age-input')).toBeVisible();
    
    // Enter valid age and continue
    await page.getByTestId('age-input').fill('20');
    await page.getByTestId('age-gate-continue').click();
    
    // Should navigate to onboarding
    await expect(page.getByRole('heading', { name: 'Welcome to CodePuppy Trainer!' })).toBeVisible();
    await expect(page.getByText('Your personal offline fitness companion')).toBeVisible();
    await expect(page.getByTestId('onboarding-setup-profile')).toBeVisible();
    
    // Verify localStorage was set
    const ageGateAccepted = await page.evaluate(() => localStorage.getItem('age_gate_accepted'));
    expect(ageGateAccepted).toBe('true');
  });
});