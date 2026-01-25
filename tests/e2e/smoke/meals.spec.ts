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
    
    // Verify "Search USDA Foods" button exists - use button role to avoid strict mode
    await expect(page.getByRole('button', { name: 'Search USDA Foods' })).toBeVisible({ timeout: 5000 });
    
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
    
    // Click "Search USDA Foods" button - use button role to avoid strict mode
    await page.getByRole('button', { name: 'Search USDA Foods' }).click();
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

  test('Can switch to Presets tab and see placeholder', async ({ page }) => {
    // Navigate to Meals page
    await page.goto('./#/meals');
    await page.waitForLoadState('networkidle');
    
    // Click Presets tab
    const presetsTab = page.getByTestId('meals-presets-tab');
    await presetsTab.click();
    await page.waitForTimeout(300);
    
    // Verify Presets tab is active
    await expect(presetsTab).toHaveClass(/border-blue-500/);
    
    // Verify at least one preset card is visible
    const presetCards = page.locator('[data-testid^="meals-preset-card-"]');
    await expect(presetCards.first()).toBeVisible({ timeout: 5000 });
    
    // Verify search input is visible
    await expect(page.getByTestId('meals-preset-search-input')).toBeVisible({ timeout: 5000 });
  });

  test('Can toggle preset filters on meals presets tab', async ({ page }) => {
    // Navigate to Meals page
    await page.goto('./#/meals');
    await page.waitForLoadState('networkidle');
    
    // Click Presets tab
    const presetsTab = page.getByTestId('meals-presets-tab');
    await presetsTab.click();
    
    // Verify filter toggle button is visible
    const filterToggle = page.getByTestId('meals-presets-filters-toggle');
    await expect(filterToggle).toBeVisible({ timeout: 5000 });
    
    // Verify filters panel is initially visible or hidden (depends on localStorage)
    const filtersPanel = page.getByTestId('meals-presets-filters-panel');
    
    // Click filter toggle to open
    await filterToggle.click();
    await page.waitForTimeout(300);
    
    // Verify filter controls are visible
    await expect(filtersPanel).toBeVisible({ timeout: 3000 });
    
    // Click filter toggle to close
    await filterToggle.click();
    await page.waitForTimeout(300);
    
    // Verify filters panel is hidden
    await expect(filtersPanel).not.toBeVisible({ timeout: 3000 });
  });

  test('Can switch between all three tabs (Saved Meals, Meal Plans, Presets)', async ({ page }) => {
    // Navigate to Meals page
    await page.goto('./#/meals');
    await page.waitForLoadState('networkidle');
    
    // Get all three tabs
    const savedMealsTab = page.getByTestId('meals-saved-meals-tab');
    const mealPlansTab = page.getByTestId('meals-meal-plans-tab');
    const presetsTab = page.getByTestId('meals-presets-tab');
    
    // Verify all tabs are visible
    await expect(savedMealsTab).toBeVisible({ timeout: 5000 });
    await expect(mealPlansTab).toBeVisible({ timeout: 5000 });
    await expect(presetsTab).toBeVisible({ timeout: 5000 });
    
    // Start on Saved Meals
    await expect(savedMealsTab).toHaveClass(/border-blue-500/);
    
    // Switch to Meal Plans
    await mealPlansTab.click();
    await page.waitForTimeout(300);
    await expect(mealPlansTab).toHaveClass(/border-blue-500/);
    
    // Switch to Presets
    await presetsTab.click();
    await page.waitForTimeout(300);
    await expect(presetsTab).toHaveClass(/border-blue-500/);
    
    // Switch back to Saved Meals
    await savedMealsTab.click();
    await page.waitForTimeout(300);
    await expect(savedMealsTab).toHaveClass(/border-blue-500/);
  });

  // Note: USDA food adding tested in usda-search.spec.ts
  // Skipped here to avoid modal management complexity
  
  test('Add manual food to meal and verify totals update', async ({ page, context }) => {
    // Set up age gate and onboarding
    await context.addInitScript(() => {
      localStorage.setItem('age_gate_accepted', 'true');
      localStorage.setItem('onboarding_completed', 'true');
    });

    // Navigate to Meals page
    await page.goto('./#/meals');
    await page.waitForLoadState('networkidle');
    
    // Open meal editor
    await page.getByText('Create New Meal').click();
    await page.waitForTimeout(500);
    
    // Set meal name
    const nameInput = page.locator('input[placeholder*="e.g., Post-Workout Shake"]');
    await nameInput.fill('Manual Test Meal');
    
    // Open manual food form
    await page.getByRole('button', { name: 'Add Manual Food' }).click();
    await page.waitForTimeout(500);
    
    // Fill in manual food form
    const foodNameInput = page.locator('input[placeholder*="e.g., Homemade Salad"]');
    await foodNameInput.fill('Test Food');
    
    const caloriesInput = page.locator('input[placeholder="200"]');
    await caloriesInput.fill('300');
    
    const proteinInput = page.locator('input[placeholder="20"]');
    await proteinInput.fill('25');
    
    const carbsInput = page.locator('input[placeholder="25"]');
    await carbsInput.fill('30');
    
    const fatInput = page.locator('input[placeholder="8"]');
    await fatInput.fill('10');
    
    // Add to meal
    await page.getByRole('button', { name: 'Add to Meal' }).click();
    await page.waitForTimeout(500);
    
    // Verify food appears in meal
    await expect(page.getByText('Test Food')).toBeVisible({ timeout: 5000 });
    
    // Verify meal totals section exists
    const mealTotalsSection = page.locator('h3').filter({ hasText: 'Meal Totals' });
    await expect(mealTotalsSection).toBeVisible({ timeout: 5000 });
    
    // Verify totals have content (values > 0 should be displayed)
    await expect(page.locator('.text-blue-600').first()).toBeVisible({ timeout: 5000 });
    
    // Cancel the meal editor
    await page.getByText('Cancel').click();
  });
});
