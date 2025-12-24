import { test, expect } from '@playwright/test';

test.describe('Age Gate Continue Fix', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app - Playwright creates fresh browser context per test
    await page.goto('/');
  });

  test('should navigate to onboarding when age >= 13', async ({ page }) => {
    // Should be on age gate initially
    await expect(page.getByText('Welcome to CodePuppy Trainer')).toBeVisible();
    await expect(page.getByLabel('Confirm your age')).toBeVisible();
    
    // Enter valid age
    await page.getByLabel('Confirm your age').fill('20');
    
    // Click continue
    await page.getByRole('button', { name: 'Continue' }).click();
    
    // Should navigate to onboarding without refresh
    await expect(page.getByText('Welcome to CodePuppy Trainer!')).toBeVisible();
    await expect(page.getByText('Your personal offline fitness companion')).toBeVisible();
    await expect(page.getByText('Set Up Profile')).toBeVisible();
    
    // Verify localStorage was set
    const ageGateAccepted = await page.evaluate(() => localStorage.getItem('age_gate_accepted'));
    expect(ageGateAccepted).toBe('true');
  });

  test('should show error when age < 13', async ({ page }) => {
    await page.getByLabel('Confirm your age').fill('12');
    await page.getByRole('button', { name: 'Continue' }).click();
    
    // Should show error and stay on age gate
    await expect(page.getByRole('alert')).toHaveText(/You must be at least 13 years old/);
    await expect(page.getByLabel('Confirm your age')).toBeVisible();
    
    // Should not set localStorage
    const ageGateAccepted = await page.evaluate(() => localStorage.getItem('age_gate_accepted'));
    expect(ageGateAccepted).toBeNull();
  });

  test('should show error for age of 0', async ({ page }) => {
    await page.getByLabel('Confirm your age').fill('0');
    await page.getByRole('button', { name: 'Continue' }).click();
    
    // Wait for error element to be visible, then check text
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('alert')).toHaveText('Please enter a valid age');
    await expect(page.getByLabel('Confirm your age')).toBeVisible();
    
    // Should not set localStorage
    const ageGateAccepted = await page.evaluate(() => localStorage.getItem('age_gate_accepted'));
    expect(ageGateAccepted).toBeNull();
  });

  test('should show error for age over 150', async ({ page }) => {
    await page.getByLabel('Confirm your age').fill('151');
    await page.getByRole('button', { name: 'Continue' }).click();
    
    // Wait for error element to be visible, then check text
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('alert')).toHaveText('Please enter a valid age');
    await expect(page.getByLabel('Confirm your age')).toBeVisible();
    
    // Should not set localStorage
    const ageGateAccepted = await page.evaluate(() => localStorage.getItem('age_gate_accepted'));
    expect(ageGateAccepted).toBeNull();
  });

  test('should disable button during loading', async ({ page }) => {
    await page.getByLabel('Confirm your age').fill('20');
    
    // Click continue
    const continueButton = page.getByRole('button', { name: 'Continue' });
    await continueButton.click();
    
    // Button should show loading state
    await expect(continueButton).toHaveText('Saving...');
    await expect(continueButton).toBeDisabled();
  });

  test('should persist across page reload', async ({ page }) => {
    // Complete age gate
    await page.getByLabel('Confirm your age').fill('20');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.waitForURL('**/onboarding');
    
    // Reload page
    await page.reload();
    
    // Should not show age gate again
    await expect(page.getByText('Welcome to CodePuppy Trainer!')).toBeVisible();
    await expect(page.getByLabel('Confirm your age')).not.toBeVisible();
  });
});