import { test, expect } from '@playwright/test';

test.describe('Age Gate Continue Fix', () => {
  test.beforeEach(async ({ page }) => {
    // Clear local storage before each test
    await page.goto('about:blank');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto('./');
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
    await expect(page.getByText('You must be at least 13 years old to use this app.')).toBeVisible();
    await expect(page.getByLabel('Confirm your age')).toBeVisible();
    
    // Should not set localStorage
    const ageGateAccepted = await page.evaluate(() => localStorage.getItem('age_gate_accepted'));
    expect(ageGateAccepted).toBeNull();
  });

  test('should show error for invalid age', async ({ page }) => {
    await page.getByLabel('Confirm your age').fill('abc');
    await page.getByRole('button', { name: 'Continue' }).click();
    
    await expect(page.getByText('Please enter a valid age')).toBeVisible();
    
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