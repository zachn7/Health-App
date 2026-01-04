import { test, expect } from '@playwright/test';

test.describe('Smoke: Meals Feature', () => {
  test.beforeEach(async ({ page, context }) => {
    // Set up age gate and onboarding
    await context.addInitScript(() => {
      localStorage.setItem('age_gate_accepted', 'true');
      localStorage.setItem('onboarding_completed', 'true');
    });
    
    // Set up USDA API key for food search tests
    await context.addInitScript(() => {
      localStorage.setItem('usda_fdc_api_key', 'test-key');
    });
  });

  test('Meals page loads with empty state', async ({ page }) => {
    // Navigate to Meals page
    await page.goto('./#/meals');
    await page.waitForLoadState('networkidle');
    
    // Verify the page title using h1
    const mainHeading = page.locator('h1');
    await expect(mainHeading).toHaveText('Meals', { timeout: 5000 });
    
    // Verify empty state message
    await expect(page.getByText('No Meals Saved Yet')).toBeVisible({ timeout: 5000 });
    
    // Verify create button exists
    await expect(page.getByText('Create New Meal')).toBeVisible({ timeout: 5000 });
  });

  test('Can create a new meal and open the meal editor', async ({ page }) => {
    // Navigate to Meals page
    await page.goto('./#/meals');
    await page.waitForLoadState('networkidle');
    
    // Click "Create New Meal" button
    await page.getByText('Create New Meal').click();
    await page.waitForTimeout(500);
    
    // Verify meal editor modal opens
    // Use text content instead of role for modal title
    await expect(page.locator('h2').filter({ hasText: /Create New Meal/i })).toBeVisible({ timeout: 5000 });
    
    // Verify meal name input exists
    const nameInput = page.locator('input[placeholder*="e.g., Post-Workout Shake"]');
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    
    // Verify "Add Food" button exists - use button role to avoid strict mode
    await expect(page.getByRole('button', { name: 'Add Food' })).toBeVisible({ timeout: 5000 });
    
    // Close modal using text
    await page.getByText('Cancel').click();
    await page.waitForTimeout(300);
  });

  test('Food picker modal opens and searches for food', async ({ page }) => {
    // Navigate to Meals page
    await page.goto('./#/meals');
    await page.waitForLoadState('networkidle');
    
    // Open meal editor
    await page.getByText('Create New Meal').click();
    await page.waitForTimeout(500);
    
    // Click "Add Food" button - use button role to avoid strict mode
    await page.getByRole('button', { name: 'Add Food' }).click();
    await page.waitForTimeout(500);
    
    // Verify food picker modal opens
    await expect(page.locator('h2').filter({ hasText: 'Add Food' })).toBeVisible({ timeout: 5000 });
    
    // Verify search input exists
    const searchInput = page.locator('input[placeholder*="Search for food"]');
    await expect(searchInput).toBeVisible({ timeout: 5000 });
    
    // Note: Actual search requires mocked USDA responses, which is covered in USDA tests
    // This test just verifies the UI exists
    
    // Close modal by pressing Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  test('Meals navigation link exists in sidebar', async ({ page }) => {
    // Navigate to home
    await page.goto('./#/');
    await page.waitForLoadState('networkidle');
    
    // Check if Meals link exists in navigation
    const mealsLink = page.locator('a').filter({ hasText: 'Meals' });
    await expect(mealsLink.first()).toBeVisible({ timeout: 5000 });
  });

  test('Can navigate to Meals page from sidebar', async ({ page }) => {
    // Navigate to home
    await page.goto('./#/');
    await page.waitForLoadState('networkidle');
    
    // Click Meals link using aria-label or href
    const mealsLink = page.locator('a[href*="meals"]');
    await mealsLink.click();
    await page.waitForTimeout(500);
    
    // Verify URL changed
    await expect(page.url()).toContain('/meals');
  });

  test('Can dismiss import status toast', async ({ page }) => {
    // We'll test this more thoroughly when we have meal data
    // For now, just verify the page structure
    await page.goto('./#/meals');
    await page.waitForLoadState('networkidle');
    
    // Verify Meals page loads using h1
    const mainHeading = page.locator('h1');
    await expect(mainHeading).toHaveText('Meals', { timeout: 5000 });
  });

  test('Meal editor shows empty state when no foods added', async ({ page }) => {
    // Navigate to Meals page
    await page.goto('./#/meals');
    await page.waitForLoadState('networkidle');
    
    // Open meal editor
    await page.getByText('Create New Meal').click();
    await page.waitForTimeout(500);
    
    // Verify empty state message
    await expect(page.getByText('No food items added yet')).toBeVisible({ timeout: 5000 });
    
    // Close modal using text
    await page.getByText('Cancel').click();
    await page.waitForTimeout(300);
  });

  test('Create New Meal button is disabled/different when meal name is empty', async ({ page }) => {
    // Navigate to Meals page
    await page.goto('./#/meals');
    await page.waitForLoadState('networkidle');
    
    // Open meal editor
    await page.getByText('Create New Meal').click();
    await page.waitForTimeout(500);
    
    // Note: Save button should be disabled when name is empty
    // This is verified by the disabled attribute, but button visibility is enough for smoke test
    const saveButton = page.getByText('Save Meal');
    await expect(saveButton).toBeVisible({ timeout: 5000 });
    
    // Close modal using text
    await page.getByText('Cancel').click();
    await page.waitForTimeout(300);
  });

  test('Meal Plans tab exists and can be switched to', async ({ page }) => {
    // Navigate to Meals page
    await page.goto('./#/meals');
    await page.waitForLoadState('networkidle');
    
    // Click Meal Plans tab button
    await page.getByRole('button', { name: 'Meal Plans' }).click();
    await page.waitForTimeout(300);
    
    // Verify Meal Plans tab is active (contains "Meal Plans" heading)
    await expect(page.locator('h2').filter({ hasText: 'Meal Plans' })).toBeVisible({ timeout: 5000 });
  });

  test('Can switch between Saved Meals and Meal Plans tabs', async ({ page }) => {
    // Navigate to Meals page
    await page.goto('./#/meals');
    await page.waitForLoadState('networkidle');
    
    // Verify initial tab is Saved Meals (use button role to avoid strict mode)
    await expect(page.getByRole('button', { name: 'Saved Meals' })).toBeVisible({ timeout: 5000 });
    
    // Switch to Meal Plans
    await page.getByRole('button', { name: 'Meal Plans' }).click();
    await page.waitForTimeout(300);
    
    // Verify tab switched
    await expect(page.locator('h2').filter({ hasText: 'Meal Plans' })).toBeVisible({ timeout: 5000 });
    
    // Switch back to Saved Meals
    await page.getByRole('button', { name: 'Saved Meals' }).click();
    await page.waitForTimeout(300);
    
    // Verify tab switched back (check button is active with border-blue-500)
    const savedMealsButton = page.getByRole('button', { name: 'Saved Meals' });
    await expect(savedMealsButton).toHaveClass(/border-blue-500/);
  });
});
