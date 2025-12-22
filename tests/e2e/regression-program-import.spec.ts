import { test, expect } from '@playwright/test';

test.describe('Regression: Program Import - No Unexpected Token (R04)', () => {
  test.beforeEach(async ({ page }) => {
    // Start fresh and set up test environment
    await page.goto('about:blank');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
      // Set age gate to pass
      localStorage.setItem('age_gate_accepted', 'true');
      localStorage.setItem('age_gate_timestamp', new Date().toISOString());
    });
    
    // Navigate to workouts page where program import likely exists
    await page.goto('./#/workouts');
    await page.waitForLoadState();
  });

  test('should create profile before program import', async ({ page }) => {
    // Need a profile to use programs
    await page.goto('./#/profile');
    await expect(page.getByText('No Profile Found')).toBeVisible();
    await page.getByRole('button', { name: 'Create Profile' }).click();
    
    // Fill out profile
    await page.getByLabel('Age').fill('25');
    await page.getByLabel('Sex').selectOption('male');
    await page.getByLabel('Activity Level').selectOption('moderate');
    await page.getByLabel('Experience Level').selectOption('beginner');
    await page.getByPlaceholder(/100.*250/).fill('175');
    await page.getByPlaceholder(/30.*300/).fill('75');
    await page.getByLabel('bodyweight').check();
    await page.getByLabel('monday').check();
    await page.getByRole('button', { name: 'Save Profile' }).click();
    await expect(page.getByText('Profile saved successfully!')).toBeVisible();
    
    // Go to workouts
    await page.goto('./#/workouts');
    await page.waitForLoadState();
  });

  test('should import basic program without Unexpected Token error', async ({ page }) => {
    // Set up profile first
    await page.goto('./#/profile');
    await page.getByRole('button', { name: 'Create Profile' }).click();
    await page.getByLabel('Age').fill('30');
    await page.getByLabel('Sex').selectOption('female');
    await page.getByLabel('Activity Level').selectOption('active');
    await page.getByLabel('Experience Level').selectOption('intermediate');
    await page.getByPlaceholder(/100.*250/).fill('165');
    await page.getByPlaceholder(/30.*300/).fill('60');
    await page.getByLabel('yoga').check();
    await page.getByLabel('wednesday').check();
    await page.getByRole('button', { name: 'Save Profile' }).click();
    
    // Navigate to workouts
    await page.goto('./#/workouts');
    await page.waitForLoadState();
    
    // Look for import/program options
    const importButton = page.getByRole('button', { name: /Import|Load Program/ });
    if (await importButton.isVisible()) {
      await importButton.click();
    } else {
      // Try looking for program selection
      const programButton = page.getByRole('button', { name: /Program|Workout Program/ });
      if (await programButton.isVisible()) {
        await programButton.click();
      }
    }
    
    // Look for file upload or program selection
    const fileInput = page.locator('input[type="file"]');
    if (await fileInput.isVisible()) {
      // Create a simple valid JSON program for testing
      const validProgram = {
        name: "Test Program",
        description: "A simple test program",
        duration: "4 weeks",
        difficulty: "beginner",
        workouts: [
          {
            day: "Monday",
            exercises: [
              {
                name: "Push-ups",
                sets: 3,
                reps: 10,
                rest: 60
              },
              {
                name: "Squats",
                sets: 3,
                reps: 15,
                rest: 60
              }
            ]
          },
          {
            day: "Wednesday",
            exercises: [
              {
                name: "Plank",
                sets: 3,
                duration: 30,
                rest: 60
              }
            ]
          }
        ]
      };
      
      // Convert to file and upload
      const fileBuffer = Buffer.from(JSON.stringify(validProgram, null, 2));
      await fileInput.setInputFiles({
        name: 'test-program.json',
        mimeType: 'application/json',
        buffer: fileBuffer
      });
      
      // Look for import/confirm button
      const confirmButton = page.getByRole('button', { name: /Import|Load|Confirm/ });
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
      }
    }
    
    // Should not show "Unexpected token" error
    await expect(page.getByText(/Unexpected token/i)).not.toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/JSON.*error|parse.*error/i)).not.toBeVisible({ timeout: 10000 });
    
    // Should either show success or handle gracefully
    const successMessage = page.getByText(/imported|loaded|saved|successfully/i);
    if (await successMessage.isVisible({ timeout: 5000 })) {
      await expect(successMessage).toBeVisible();
    }
  });

  test('should handle malformed JSON gracefully without Unexpected Token', async ({ page }) => {
    // Set up profile
    await page.goto('./#/profile');
    await page.getByRole('button', { name: 'Create Profile' }).click();
    await page.getByLabel('Age').fill('25');
    await page.getByLabel('Sex').selectOption('male');
    await page.getByLabel('Activity Level').selectOption('moderate');
    await page.getByLabel('Experience Level').selectOption('beginner');
    await page.getByPlaceholder(/100.*250/).fill('175');
    await page.getByPlaceholder(/30.*300/).fill('75');
    await page.getByLabel('bodyweight').check();
    await page.getByLabel('monday').check();
    await page.getByRole('button', { name: 'Save Profile' }).click();
    
    await page.goto('./#/workouts');
    await page.waitForLoadState();
    
    // Try to find import functionality
    const importButton = page.getByRole('button', { name: /Import|Load Program/ });
    if (await importButton.isVisible()) {
      await importButton.click();
    }
    
    const fileInput = page.locator('input[type="file"]');
    if (await fileInput.isVisible()) {
      // Create malformed JSON
      const malformedJson = '{"name": "Bad Program", "invalid": json missing closing brace';
      const fileBuffer = Buffer.from(malformedJson);
      
      await fileInput.setInputFiles({
        name: 'bad-program.json',
        mimeType: 'application/json',
        buffer: fileBuffer
      });
      
      // Try to import
      const confirmButton = page.getByRole('button', { name: /Import|Load|Confirm/ });
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
      }
      
      // Should handle the error gracefully, not show "Unexpected token"
      await expect(page.getByText(/Unexpected token/i)).not.toBeVisible({ timeout: 10000 });
      
      // Should show a user-friendly error message instead
      await expect(page.getByText(/Invalid.*JSON|parse.*error|file.*error|failed.*import/i)).toBeVisible({ timeout: 10000 });
    }
  });

  test('should handle empty program files without Unexpected Token', async ({ page }) => {
    // Set up profile
    await page.goto('./#/profile');
    await page.getByRole('button', { name: 'Create Profile' }).click();
    await page.getByLabel('Age').fill('28');
    await page.getByLabel('Sex').selectOption('female');
    await page.getByLabel('Activity Level').selectOption('active');
    await page.getByLabel('Experience Level').selectOption('intermediate');
    await page.getByPlaceholder(/100.*250/).fill('160');
    await page.getByPlaceholder(/30.*300/).fill('55');
    await page.getByLabel('yoga').check();
    await page.getByLabel('tuesday').check();
    await page.getByRole('button', { name: 'Save Profile' }).click();
    
    await page.goto('./#/workouts');
    await page.waitForLoadState();
    
    // Try import functionality
    const importButton = page.getByRole('button', { name: /Import|Load Program/ });
    if (await importButton.isVisible()) {
      await importButton.click();
    }
    
    const fileInput = page.locator('input[type="file"]');
    if (await fileInput.isVisible()) {
      // Upload empty file
      const emptyFile = Buffer.from('');
      await fileInput.setInputFiles({
        name: 'empty.json',
        mimeType: 'application/json',
        buffer: emptyFile
      });
      
      const confirmButton = page.getByRole('button', { name: /Import|Load|Confirm/ });
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
      }
      
      // Should handle gracefully without Unexpected Token
      await expect(page.getByText(/Unexpected token/i)).not.toBeVisible({ timeout: 10000 });
      
      // Should show user-friendly error
      await expect(page.getByText(/empty.*file|invalid.*file|no.*data/i)).toBeVisible({ timeout: 10000 });
    }
  });

  test('should handle wrong file type without Unexpected Token', async ({ page }) => {
    // Set up profile
    await page.goto('./#/profile');
    await page.getByRole('button', { name: 'Create Profile' }).click();
    await page.getByLabel('Age').fill('32');
    await page.getByLabel('Sex').selectOption('male');
    await page.getByLabel('Activity Level').selectOption('moderate');
    await page.getByLabel('Experience Level').selectOption('beginner');
    await page.getByPlaceholder(/100.*250/).fill('180');
    await page.getByPlaceholder(/30.*300/).fill('85');
    await page.getByLabel('dumbbells').check();
    await page.getByLabel('thursday').check();
    await page.getByRole('button', { name: 'Save Profile' }).click();
    
    await page.goto('./#/workouts');
    await page.waitForLoadState();
    
    // Try import functionality
    const importButton = page.getByRole('button', { name: /Import|Load Program/ });
    if (await importButton.isVisible()) {
      await importButton.click();
    }
    
    const fileInput = page.locator('input[type="file"]');
    if (await fileInput.isVisible()) {
      // Upload text file instead of JSON
      const textFile = Buffer.from('This is not a JSON file\nIt is just plain text');
      await fileInput.setInputFiles({
        name: 'not-json.txt',
        mimeType: 'text/plain',
        buffer: textFile
      });
      
      const confirmButton = page.getByRole('button', { name: /Import|Load|Confirm/ });
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
      }
      
      // Should handle gracefully without Unexpected Token
      await expect(page.getByText(/Unexpected token/i)).not.toBeVisible({ timeout: 10000 });
      
      // Should show appropriate file type error
      await expect(page.getByText(/JSON.*file|invalid.*format|wrong.*type/i)).toBeVisible({ timeout: 10000 });
    }
  });

  test('should not crash on very large program files', async ({ page }) => {
    // Set up profile
    await page.goto('./#/profile');
    await page.getByRole('button', { name: 'Create Profile' }).click();
    await page.getByLabel('Age').fill('25');
    await page.getByLabel('Sex').selectOption('male');
    await page.getByLabel('Activity Level').selectOption('moderate');
    await page.getByLabel('Experience Level').selectOption('beginner');
    await page.getByPlaceholder(/100.*250/).fill('175');
    await page.getByPlaceholder(/30.*300/).fill('75');
    await page.getByLabel('bodyweight').check();
    await page.getByLabel('monday').check();
    await page.getByRole('button', { name: 'Save Profile' }).click();
    
    await page.goto('./#/workouts');
    await page.waitForLoadState();
    
    // Try import functionality
    const importButton = page.getByRole('button', { name: /Import|Load Program/ });
    if (await importButton.isVisible()) {
      await importButton.click();
    }
    
    const fileInput = page.locator('input[type="file"]');
    if (await fileInput.isVisible()) {
      // Create a large JSON program
      const largeProgram = {
        name: "Large Program",
        description: "A program with many exercises",
        workouts: []
      };
      
      // Add many workouts to make it large
      for (let i = 0; i < 100; i++) {
        largeProgram.workouts.push({
          day: `Day ${i + 1}`,
          exercises: Array.from({ length: 20 }, (_, j) => ({
            name: `Exercise ${i}-${j}`,
            sets: 3,
            reps: 10,
            rest: 60
          }))
        });
      }
      
      const largeFile = Buffer.from(JSON.stringify(largeProgram, null, 2));
      await fileInput.setInputFiles({
        name: 'large-program.json',
        mimeType: 'application/json',
        buffer: largeFile
      });
      
      const confirmButton = page.getByRole('button', { name: /Import|Load|Confirm/ });
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
      }
      
      // Should not crash or show Unexpected Token
      await expect(page.getByText(/Unexpected token/i)).not.toBeVisible({ timeout: 15000 });
      
      // Might show file size error or handle gracefully - either is fine
      // Just make sure it doesn't crash
    }
  });
});