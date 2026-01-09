import { test, expect } from '@playwright/test';

test.describe('Regression: Exercise Search Improvements (R06)', () => {
  test.beforeEach(async ({ page, context }) => {
    // Set up age gate and onboarding
    await context.addInitScript(() => {
      localStorage.setItem('age_gate_accepted', 'true');
      localStorage.setItem('onboarding_completed', 'true');
    });
  });

  test('should show sample exercises when search is empty', async ({ page }) => {
    // Navigate to Workout Logger
    await page.goto('./#/log/workout');
    await page.waitForLoadState('networkidle');
    
    // Click "Log Exercises Manually" or "Add Another Exercise" button
    const logManuallyBtn = page.getByRole('button', { name: /Log Exercises Manually/i });
    const addAnotherBtn = page.getByRole('button', { name: /Add Another Exercise/i });
    
    if (await logManuallyBtn.isVisible({ timeout: 3000 })) {
      await logManuallyBtn.click();
    } else if (await addAnotherBtn.isVisible({ timeout: 3000 })) {
      await addAnotherBtn.click();
    } else {
      throw new Error('Could not find "Log Exercises Manually" or "Add Another Exercise" button');
    }
    await page.waitForTimeout(500);
    
    // Wait for Exercise Picker to open
    await expect(page.getByText('Exercise Picker')).toBeVisible({ timeout: 5000 });
    
    // Clear search input if it has any content
    const searchInput = page.getByTestId('exercise-search-input');
    await expect(searchInput).toBeVisible({ timeout: 3000 });
    await searchInput.clear();
    await page.waitForTimeout(300);
    
    // Should show exercise results (empty state should NOT be visible)
    const emptyState = page.getByTestId('exercise-search-empty-state');
    await expect(emptyState).not.toBeVisible({ timeout: 5000 });
    
    // Should see at least some exercise results
    const firstResult = page.locator('[data-testid^="exercise-result-"]').first();
    await expect(firstResult).toBeVisible({ timeout: 5000 });
    
    // Get count of visible results
    const resultCount = await page.locator('[data-testid^="exercise-result-"]').count();
    console.log(`Found ${resultCount} exercises with empty search`);
    expect(resultCount).toBeGreaterThan(0);
    
    // Close the exercise picker
    const closeButton = page.getByText('✕');
    await closeButton.click();
  });

  test('should perform substring matching for single word queries', async ({ page }) => {
    // Navigate to Workout Logger
    await page.goto('./#/log/workout');
    await page.waitForLoadState('networkidle');
    
    // Click "Log Exercises Manually" or "Add Another Exercise" button
    const logManuallyBtn = page.getByRole('button', { name: /Log Exercises Manually/i });
    const addAnotherBtn = page.getByRole('button', { name: /Add Another Exercise/i });
    
    if (await logManuallyBtn.isVisible({ timeout: 3000 })) {
      await logManuallyBtn.click();
    } else if (await addAnotherBtn.isVisible({ timeout: 3000 })) {
      await addAnotherBtn.click();
    } else {
      throw new Error('Could not find "Log Exercises Manually" or "Add Another Exercise" button');
    }
    await page.waitForTimeout(500);
    
    // Wait for Exercise Picker to open
    await expect(page.getByText('Exercise Picker')).toBeVisible({ timeout: 5000 });
    
    // Search for "bench" - should find bench press, incline bench press, dumbbell bench press, etc.
    const searchInput = page.getByTestId('exercise-search-input');
    await searchInput.fill('bench');
    await page.waitForTimeout(500);
    
    // Wait for results to load
    const firstResult = page.locator('[data-testid^="exercise-result-"]').first();
    await expect(firstResult).toBeVisible({ timeout: 5000 });
    
    // Get all results
    const results = page.locator('[data-testid^="exercise-result-"]');
    const resultCount = await results.count();
    console.log(`Found ${resultCount} exercises for "bench"`);
    expect(resultCount).toBeGreaterThan(0);
    
    // Verify at least one result contains "bench" in the name
    const benchResults = results.filter({ hasText: /bench/i });
    const benchCount = await benchResults.count();
    console.log(`Found ${benchCount} exercises with "bench" in name`);
    expect(benchCount).toBeGreaterThan(0);
    
    // Should NOT show empty state
    const emptyState = page.getByTestId('exercise-search-empty-state');
    await expect(emptyState).not.toBeVisible({ timeout: 5000 });
    
    // Close the exercise picker
    const closeButton = page.getByText('✕');
    await closeButton.click();
  });

  test('should perform token-based matching for multi-word queries', async ({ page }) => {
    // Navigate to Workout Logger
    await page.goto('./#/log/workout');
    await page.waitForLoadState('networkidle');
    
    // Click "Log Exercises Manually" or "Add Another Exercise" button
    const logManuallyBtn = page.getByRole('button', { name: /Log Exercises Manually/i });
    const addAnotherBtn = page.getByRole('button', { name: /Add Another Exercise/i });
    
    if (await logManuallyBtn.isVisible({ timeout: 3000 })) {
      await logManuallyBtn.click();
    } else if (await addAnotherBtn.isVisible({ timeout: 3000 })) {
      await addAnotherBtn.click();
    } else {
      throw new Error('Could not find "Log Exercises Manually" or "Add Another Exercise" button');
    }
    await page.waitForTimeout(500);
    
    // Wait for Exercise Picker to open
    await expect(page.getByText('Exercise Picker')).toBeVisible({ timeout: 5000 });
    
    // Search for "incline bench" - should find incline bench press (contains both tokens)
    const searchInput = page.getByTestId('exercise-search-input');
    await searchInput.fill('incline bench');
    await page.waitForTimeout(500);
    
    // Wait for results to load
    const firstResult = page.locator('[data-testid^="exercise-result-"]').first();
    await expect(firstResult).toBeVisible({ timeout: 5000 });
    
    // Get all results
    const results = page.locator('[data-testid^="exercise-result-"]');
    const resultCount = await results.count();
    console.log(`Found ${resultCount} exercises for "incline bench"`);
    
    // Verify results contain the search tokens (either "incline" and "bench" in each result)
    // or at least combined in the exercise details (name, bodypart, equipment)
    const inclineBenchResults = results.filter({ 
      hasText: /incline/i 
    }).filter({ 
      hasText: /bench/i 
    });
    const combinedCount = await inclineBenchResults.count();
    console.log(`Found ${combinedCount} exercises containing both "incline" and "bench"`);
    
    // We should find at least some exercises with both terms
    // (e.g., "Incline Dumbbell Bench Press", "Incline Barbell Bench Press")
    expect(combinedCount).toBeGreaterThan(0);
    
    // Close the exercise picker
    const closeButton = page.getByText('✕');
    await closeButton.click();
  });

  test('should allow selecting an exercise from search results', async ({ page }) => {
    // Navigate to Workout Logger
    await page.goto('./#/log/workout');
    await page.waitForLoadState('networkidle');
    
    // Click "Log Exercises Manually" or "Add Another Exercise" button
    const logManuallyBtn = page.getByRole('button', { name: /Log Exercises Manually/i });
    const addAnotherBtn = page.getByRole('button', { name: /Add Another Exercise/i });
    
    if (await logManuallyBtn.isVisible({ timeout: 3000 })) {
      await logManuallyBtn.click();
    } else if (await addAnotherBtn.isVisible({ timeout: 3000 })) {
      await addAnotherBtn.click();
    } else {
      throw new Error('Could not find "Log Exercises Manually" or "Add Another Exercise" button');
    }
    await page.waitForTimeout(500);
    
    // Wait for Exercise Picker to open
    await expect(page.getByText('Exercise Picker')).toBeVisible({ timeout: 5000 });
    
    // Search for "squat"
    const searchInput = page.getByTestId('exercise-search-input');
    await searchInput.fill('squat');
    await page.waitForTimeout(500);
    
    // Wait for results
    const firstResult = page.locator('[data-testid^="exercise-result-"]').first();
    await expect(firstResult).toBeVisible({ timeout: 5000 });
    
    // Get the exercise name before clicking
    const exerciseName = await firstResult.getAttribute('data-exercise-name');
    console.log(`Selecting exercise: ${exerciseName}`);
    
    // Click the first result
    await firstResult.click();
    await page.waitForTimeout(500);
    
    // Exercise picker should close after selection
    await expect(page.getByText('Exercise Picker')).not.toBeVisible({ timeout: 5000 });
    
    // The exercise should now be visible in the workout logger
    // (This depends on how the workout logger displays selected exercises)
    // For now, just verify we're back on the logger page and picker is closed
    expect(page.url()).toContain('/log/workout');
  });

  test('should show empty state when no results found', async ({ page }) => {
    // Navigate to Workout Logger
    await page.goto('./#/log/workout');
    await page.waitForLoadState('networkidle');
    
    // Click "Log Exercises Manually" or "Add Another Exercise" button
    const logManuallyBtn = page.getByRole('button', { name: /Log Exercises Manually/i });
    const addAnotherBtn = page.getByRole('button', { name: /Add Another Exercise/i });
    
    if (await logManuallyBtn.isVisible({ timeout: 3000 })) {
      await logManuallyBtn.click();
    } else if (await addAnotherBtn.isVisible({ timeout: 3000 })) {
      await addAnotherBtn.click();
    } else {
      throw new Error('Could not find "Log Exercises Manually" or "Add Another Exercise" button');
    }
    await page.waitForTimeout(500);
    
    // Wait for Exercise Picker to open
    await expect(page.getByText('Exercise Picker')).toBeVisible({ timeout: 5000 });
    
    // Search for something that definitely won't exist
    const searchInput = page.getByTestId('exercise-search-input');
    await searchInput.fill('xyz123nonexistentexercise');
    await page.waitForTimeout(500);
    
    // Wait a moment for search to complete
    await page.waitForTimeout(1000);
    
    // Should show empty state
    const emptyState = page.getByTestId('exercise-search-empty-state');
    await expect(emptyState).toBeVisible({ timeout: 5000 });
    
    // Should NOT show any results
    const results = page.locator('[data-testid^="exercise-result-"]');
    const resultCount = await results.count();
    expect(resultCount).toBe(0);
    
    // Verify empty state message
    await expect(emptyState.getByText('No exercises found')).toBeVisible({ timeout: 3000 });
    
    // Close the exercise picker
    const closeButton = page.getByText('✕');
    await closeButton.click();
  });

  test('should show full exercise dataset on empty search and allow scrolling', async ({ page }) => {
    // Navigate to Workout Logger
    await page.goto('./#/log/workout');
    await page.waitForLoadState('networkidle');
    
    // Click "Log Exercises Manually" button
    const logManuallyBtn = page.getByRole('button', { name: /Log Exercises Manually/i });
    const addAnotherBtn = page.getByRole('button', { name: /Add Another Exercise/i });
    
    if (await logManuallyBtn.isVisible({ timeout: 3000 })) {
      await logManuallyBtn.click();
    } else if (await addAnotherBtn.isVisible({ timeout: 3000 })) {
      await addAnotherBtn.click();
    } else {
      throw new Error('Could not find "Log Exercises Manually" or "Add Another Exercise" button');
    }
    await page.waitForTimeout(500);
    
    // Wait for Exercise Picker to open
    await expect(page.getByText('Exercise Picker')).toBeVisible({ timeout: 5000 });
    
    // Get the search input (should be empty by default)
    const searchInput = page.getByTestId('exercise-search-input');
    const currentValue = await searchInput.inputValue();
    expect(currentValue).toBe('');
    
    // Wait for results to load
    await page.waitForTimeout(1000);
    
    // Check the results count - should show large number (full dataset)
    const resultsCount = page.getByTestId('exercise-results-count');
    await expect(resultsCount).toBeVisible({ timeout: 5000 });
    
    const countText = await resultsCount.textContent();
    console.log('Results count text:', countText);
    
    // Extract the number from text like "Showing 50 exercises"
    const countMatch = countText?.match(/Showing (\d+) exercise/);
    const totalCount = countMatch ? parseInt(countMatch[1], 10) : 0;
    
    console.log(`Total exercises shown: ${totalCount}`);
    expect(totalCount).toBeGreaterThan(100); // Should show full dataset
    
    // Get the first visible result
    const resultsList = page.getByTestId('exercise-results-list');
    const firstResult = resultsList.locator('[data-testid^="exercise-result-"]').first();
    await expect(firstResult).toBeVisible({ timeout: 5000 });
    
    const firstResultText = await firstResult.textContent();
    console.log('First result:', firstResultText);
    expect(firstResultText).toBeTruthy();
    expect(firstResultText?.length).toBeGreaterThan(0);
    
    // Scroll to the bottom of the results list
    await resultsList.evaluate((el: HTMLElement) => {
      el.scrollTop = el.scrollHeight;
    });
    await page.waitForTimeout(500);
    
    // Get the last visible result after scrolling
    const lastResult = resultsList.locator('[data-testid^="exercise-result-"]').last();
    await expect(lastResult).toBeVisible({ timeout: 5000 });
    
    const lastResultText = await lastResult.textContent();
    console.log('Last result after scrolling:', lastResultText);
    
    // Verify that the first and last results are different (scrolling worked)
    expect(firstResultText).not.toBe(lastResultText);
    
    // Search for 'bench' and verify we get matches
    await searchInput.fill('bench');
    await page.waitForTimeout(1000);
    
    const benchResultsCount = await page.getByTestId('exercise-results-count').textContent();
    console.log('Bench search results:', benchResultsCount);
    
    const benchCountMatch = benchResultsCount?.match(/Showing (\d+) exercise/);
    const benchCount = benchCountMatch ? parseInt(benchCountMatch[1], 10) : 0;
    
    expect(benchCount).toBeGreaterThan(0);
    console.log(`✅ Found ${benchCount} exercises matching 'bench'`);
    
    // Verify first result contains 'bench'
    const firstBenchResult = resultsList.locator('[data-testid^="exercise-result-"]').first();
    const firstBenchText = await firstBenchResult.textContent();
    console.log('First bench result:', firstBenchText);
    expect(firstBenchText?.toLowerCase()).toContain('bench');
  });

  test('should apply filters and narrow results correctly', async ({ page }) => {
    // Navigate to Workout Logger to open exercise picker
    await page.goto('./#/log/workout');
    await page.waitForLoadState('networkidle');
    
    // Click to open exercise picker
    const logManuallyBtn = page.getByRole('button', { name: /Log Exercises Manually/i });
    const addAnotherBtn = page.getByRole('button', { name: /Add Another Exercise/i });
    
    if (await logManuallyBtn.isVisible({ timeout: 3000 })) {
      await logManuallyBtn.click();
    } else if (await addAnotherBtn.isVisible({ timeout: 3000 })) {
      await addAnotherBtn.click();
    } else {
      throw new Error('Could not find exercise picker button');
    }
    await page.waitForTimeout(500);
    
    // Wait for Exercise Picker to open
    await expect(page.getByText('Exercise Picker')).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(1000);
    
    // Get initial results count (should show all exercises)
    const resultsCount = page.getByTestId('exercise-results-count');
    await expect(resultsCount).toBeVisible({ timeout: 5000 });
    
    const initialCountText = await resultsCount.textContent();
    const initialCountMatch = initialCountText?.match(/Showing (\d+) exercise/);
    const initialCount = initialCountMatch ? parseInt(initialCountMatch[1], 10) : 0;
    
    console.log(`Initial exercise count: ${initialCount}`);
    expect(initialCount).toBeGreaterThan(100);
    
    // Apply a difficulty filter
    const difficultyFilter = page.getByTestId('exercise-filter-difficulty');
    await difficultyFilter.selectOption('beginner');
    await page.waitForTimeout(500);
    
    // Get filtered results count
    const beginnerCountText = await resultsCount.textContent();
    const beginnerCountMatch = beginnerCountText?.match(/Showing (\d+) exercise/);
    const beginnerCount = beginnerCountMatch ? parseInt(beginnerCountMatch[1], 10) : 0;
    
    console.log(`Beginner filter count: ${beginnerCount}`);
    expect(beginnerCount).toBeGreaterThan(0);
    expect(beginnerCount).toBeLessThan(initialCount); // Should be fewer than total
    
    // Verify first result has 'beginner' difficulty badge
    const resultsList = page.getByTestId('exercise-results-list');
    const firstResult = resultsList.locator('[data-testid^="exercise-result-"]').first();
    
    // Get difficulty badge from first result
    const difficultyBadge = firstResult.locator('.bg-green-100'); // difficulty has green badge style
    await expect(difficultyBadge).toBeVisible();
    
    const badgeText = await difficultyBadge.textContent();
    expect(badgeText?.toLowerCase()).toBe('beginner');
    
    // Clear filters
    const clearButton = page.getByTestId('exercise-filter-clear');
    await clearButton.click();
    await page.waitForTimeout(500);
    
    // Verify results count returns to initial count
    const clearedCountText = await resultsCount.textContent();
    const clearedCountMatch = clearedCountText?.match(/Showing (\d+) exercise/);
    const clearedCount = clearedCountMatch ? parseInt(clearedCountMatch[1], 10) : 0;
    
    console.log(`After clearing filters: ${clearedCount}`);
    expect(clearedCount).toBe(initialCount);
    
    // Now test combining search + filters
    const searchInput = page.getByTestId('exercise-search-input');
    await searchInput.fill('bench');
    await page.waitForTimeout(500);
    
    const benchOnlyCountText = await resultsCount.textContent();
    const benchOnlyCountMatch = benchOnlyCountText?.match(/Showing (\d+) exercise/);
    const benchOnlyCount = benchOnlyCountMatch ? parseInt(benchOnlyCountMatch[1], 10) : 0;
    
    console.log(`Bench search count: ${benchOnlyCount}`);
    expect(benchOnlyCount).toBeGreaterThan(0);
    
    // Now add difficulty filter on top of search
    await difficultyFilter.selectOption('beginner');
    await page.waitForTimeout(500);
    
    const benchBeginnerCountText = await resultsCount.textContent();
    const benchBeginnerCountMatch = benchBeginnerCountText?.match(/Showing (\d+) exercise/);
    const benchBeginnerCount = benchBeginnerCountMatch ? parseInt(benchBeginnerCountMatch[1], 10) : 0;
    
    console.log(`Bench + Beginner filter count: ${benchBeginnerCount}`);
    expect(benchBeginnerCount).toBeGreaterThan(0);
    expect(benchBeginnerCount).toBeLessThanOrEqual(benchOnlyCount); // Should be fewer or equal
    
    // Verify all results have 'bench' in name and 'beginner' difficulty
    const allResults = resultsList.locator('[data-testid^="exercise-result-"]');
    const resultCount = await allResults.count();
    console.log(`Combined filter results count: ${resultCount}`);
    
    for (let i = 0; i < Math.min(resultCount, 3); i++) {
      const result = allResults.nth(i);
      const resultText = await result.textContent();
      expect(resultText?.toLowerCase()).toContain('bench');
      
      const resultDifficultyBadge = result.locator('.bg-green-100');
      await expect(resultDifficultyBadge).toBeVisible();
      const resultBadgeText = await resultDifficultyBadge.textContent();
      expect(resultBadgeText?.toLowerCase()).toBe('beginner');
    }
    
    console.log('✅ Filters work correctly and combine with search');
  });
});
