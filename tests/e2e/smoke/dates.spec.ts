import { test, expect } from '@playwright/test';

test.describe('Smoke: Date Navigation and Weight Logging', () => {
  test.beforeEach(async ({ page, context }) => {
    // Set up age gate and onboarding
    await context.addInitScript(() => {
      localStorage.setItem('age_gate_accepted', 'true');
      localStorage.setItem('onboarding_completed', 'true');
    });
    
    // Navigate to Nutrition page just to set up profile
    await page.goto('./#/nutrition');
    await page.waitForLoadState('networkidle');
  });

  test('Today button selects correct local today date on Nutrition page', async ({ page }) => {
    // Get the current date components
    const todayObj = new Date();
    const todayMonth = todayObj.toLocaleDateString('en-US', { month: 'long' });
    const todayDay = todayObj.getDate();
    const todayYear = todayObj.getFullYear();
    
    // Click Today button
    await page.getByRole('button', { name: /Today/i }).click();
    
    // Wait for date to update
    await page.waitForTimeout(200);
    
    // Verify the displayed date matches today
    const dateString = await page.textContent('.text-center.text-lg.font-medium');
    
    expect(dateString).toContain(todayMonth);
    expect(dateString).toContain(String(todayDay));
    expect(dateString).toContain(String(todayYear));
  });

  test('Can navigate to future dates on Nutrition page', async ({ page }) => {
    // Get current date text
    await page.waitForSelector('.text-center.text-lg.font-medium');
    const currentText = await page.textContent('.text-center.text-lg.font-medium');
    
    // Click Next button
    await page.getByRole('button', { name: /Next/i }).click();
    
    // Wait for date to update
    await page.waitForTimeout(200);
    
    // Get new date text
    const newText = await page.textContent('.text-center.text-lg.font-medium');
    
    // Dates should be different
    expect(newText).not.toBe(currentText);
  });

  test('Can navigate to future dates on Progress page', async ({ page }) => {
    // Navigate to Progress page
    await page.goto('./#/progress');
    await page.waitForLoadState('networkidle');
    
    // Get current date
    await page.waitForSelector('button:has(.lucide-calendar)');
    const currentDateString = await page.locator('button:has(.lucide-calendar)').first().textContent();
    
    // Click Next button (right chevron)
    await page.locator('button:has(.lucide-chevron-right)').first().click();
    
    // Wait for update
    await page.waitForTimeout(200);
    
    // Get new date
    const newDateString = await page.locator('button:has(.lucide-calendar)').first().textContent();
    
    // Dates should be different
    expect(newDateString).not.toBe(currentDateString);
  });

  test('Weight logger displays correct labels', async ({ page }) => {
    // Navigate to Progress page
    await page.goto('./#/progress');
    await page.waitForLoadState('networkidle');
    
    // Check for "Scale Weight" label (not "Actual Weight")
    await expect(page.getByText('Scale Weight')).toBeVisible();
    
    // Check for "Average Weight" label (not "Average 7-day weight")
    await expect(page.getByText('Average Weight')).toBeVisible();
  });

  test('Weight logger accepts decimal input', async ({ page }) => {
    // Navigate to Progress page
    await page.goto('./#/progress');
    await page.waitForLoadState('networkidle');
    
    // Click Log Weight button
    await page.getByRole('button', { name: 'Log Weight' }).click();
    
    // Enter weight with decimal
    await page.waitForTimeout(300);
    const weightInput = page.locator('input[type="number"]').first();
    await weightInput.fill('150.5');
    
    // Verify the value is accepted
    expect(await weightInput.inputValue()).toBe('150.5');
  });
});
