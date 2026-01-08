import { test, expect } from '@playwright/test';

test.describe('Onboarding Flow', () => {
  test('should navigate through age gate successfully', async ({ page }) => {
    await page.goto('/');
    
    // Should show age gate
    await expect(page.getByRole('heading', { name: 'Welcome to CodePuppy Trainer' })).toBeVisible();
    await expect(page.getByTestId('age-input')).toBeVisible();
    
    // Try invalid age
    await page.getByTestId('age-input').fill('12');
    await page.getByTestId('age-gate-continue').click();
    await expect(page.getByTestId('age-gate-error')).toContainText('13');
    
    // Try valid age
    await page.getByTestId('age-input').fill('20');
    await page.getByTestId('age-gate-continue').click();
    
    // Should navigate to onboarding after age gate
    await expect(page.getByRole('heading', { name: 'Welcome to CodePuppy Trainer!' })).toBeVisible();
    
    // Complete onboarding - skip for now
    await page.getByTestId('onboarding-skip').click();
    
    // After skipping, onboarding should be complete
    const onboardingCompleted = await page.evaluate(() => localStorage.getItem('onboarding_completed'));
    expect(onboardingCompleted).toBe('true');
  });
  
  test('should persist age gate acceptance', async ({ page }) => {
    await page.goto('/');
    
    // Complete age gate
    await page.getByTestId('age-input').fill('25');
    await page.getByTestId('age-gate-continue').click();
    
    // Navigate to onboarding
    await expect(page.getByRole('heading', { name: 'Welcome to CodePuppy Trainer!' })).toBeVisible();
    
    // Reload page - should not show age gate again (should stay on onboarding)
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Welcome to CodePuppy Trainer!' })).toBeVisible();
  });
});