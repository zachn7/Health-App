import { test, expect } from '@playwright/test';

test.describe('Age Gate Continue Fix', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app - Playwright creates fresh browser context per test
    await page.goto('/');
  });

  test('should navigate to onboarding when age >= 13', async ({ page }) => {
    // Should be on age gate initially
    await expect(page.getByRole('heading', { name: 'Welcome to CodePuppy Trainer' })).toBeVisible();
    await expect(page.getByTestId('age-input')).toBeVisible();
    
    // Enter valid age
    await page.getByTestId('age-input').fill('20');
    
    // Click continue
    await page.getByTestId('age-gate-continue').click();
    
    // Should navigate to onboarding without refresh
    await expect(page.getByRole('heading', { name: 'Welcome to CodePuppy Trainer!' })).toBeVisible();
    await expect(page.getByText('Your personal offline fitness companion')).toBeVisible();
    await expect(page.getByTestId('onboarding-setup-profile')).toBeVisible();
    
    // Verify localStorage was set
    const ageGateAccepted = await page.evaluate(() => localStorage.getItem('age_gate_accepted'));
    expect(ageGateAccepted).toBe('true');
  });

  test('should show error when age < 13', async ({ page }) => {
    await page.getByTestId('age-input').fill('12');
    await page.getByTestId('age-gate-continue').click();
    
    // Should show error and stay on age gate
    await expect(page.getByTestId('age-gate-error')).toHaveText(/13 years old/);
    await expect(page.getByTestId('age-input')).toBeVisible();
    
    // Should not set localStorage
    const ageGateAccepted = await page.evaluate(() => localStorage.getItem('age_gate_accepted'));
    expect(ageGateAccepted).toBeNull();
  });

  test('should show error for age of 0', async ({ page }) => {
    await page.getByTestId('age-input').fill('0');
    await page.getByTestId('age-gate-continue').click();
    
    // Wait for error element to be visible, then check text
    await expect(page.getByTestId('age-gate-error')).toBeVisible();
    await expect(page.getByTestId('age-gate-error')).toHaveText('Please enter a valid age');
    await expect(page.getByTestId('age-input')).toBeVisible();
    
    // Should not set localStorage
    const ageGateAccepted = await page.evaluate(() => localStorage.getItem('age_gate_accepted'));
    expect(ageGateAccepted).toBeNull();
  });

  test('should show error for age over 150', async ({ page }) => {
    await page.getByTestId('age-input').fill('151');
    await page.getByTestId('age-gate-continue').click();
    
    // Wait for error element to be visible, then check text
    await expect(page.getByTestId('age-gate-error')).toBeVisible();
    await expect(page.getByTestId('age-gate-error')).toHaveText('Please enter a valid age');
    await expect(page.getByTestId('age-input')).toBeVisible();
    
    // Should not set localStorage
    const ageGateAccepted = await page.evaluate(() => localStorage.getItem('age_gate_accepted'));
    expect(ageGateAccepted).toBeNull();
  });

  test('should disable button during loading', async ({ page }) => {
    await page.getByTestId('age-input').fill('20');
    
    // Click continue using stable selector
    const continueButton = page.getByTestId('age-gate-continue');
    await continueButton.click();
    
    // Button should show loading state - check it becomes disabled
    // The text may change quickly, so we check for any loading indicator text
    await expect(continueButton).toBeDisabled();
    await expect(continueButton).toHaveText(/Saving/);
  });

  test('should persist across page reload', async ({ page }) => {
    // Complete age gate
    await page.getByTestId('age-input').fill('20');
    await page.getByTestId('age-gate-continue').click();
    await page.waitForURL(/onboarding/);
    
    // Reload page
    await page.reload();
    
    // Should not show age gate again (should stay on onboarding)
    await expect(page.getByRole('heading', { name: 'Welcome to CodePuppy Trainer!' })).toBeVisible();
    await expect(page.getByTestId('age-input')).not.toBeVisible();
  });
});