import { expect, test } from '@playwright/test';
import { testIds } from '../../src/testIds';
import { bootstrapAppState } from './helpers/bootstrap';

test.describe('Regression: Nutrition saved food search is predictive', () => {
  test.beforeEach(async ({ page, context }) => {
    await bootstrapAppState(context, {
      clearStorage: true,
      completeOnboarding: true,
    });

    await page.goto('./#/nutrition');
    await page.waitForLoadState('networkidle');

    await page.evaluate(async () => {
      const foods = [
        {
          id: 'saved-food-greek-yogurt',
          name: 'Greek Yogurt',
          servingSize: '170g cup',
          calories: 100,
          proteinG: 17,
          carbsG: 6,
          fatG: 0,
          source: 'bundled',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'saved-food-grilled-chicken',
          name: 'Grilled Chicken Breast',
          servingSize: '120g',
          calories: 198,
          proteinG: 37,
          carbsG: 0,
          fatG: 4,
          source: 'bundled',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'saved-food-banana',
          name: 'Banana',
          servingSize: '1 medium (118g)',
          calories: 105,
          proteinG: 1.3,
          carbsG: 27,
          fatG: 0.4,
          source: 'bundled',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];

      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('CodePuppyTrainerDB');

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction('foodItems', 'readwrite');
          const store = tx.objectStore('foodItems');

          const clearRequest = store.clear();
          clearRequest.onerror = () => reject(clearRequest.error);
          clearRequest.onsuccess = () => {
            for (const food of foods) {
              store.put(food);
            }
          };

          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(tx.error);
        };
      });
    });

    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  test('shows filtered saved food results as the user types and can add one', async ({ page }) => {
    await page.getByTestId(testIds.nutrition.savedFoodSearchButton).click();

    const modal = page.getByTestId(testIds.nutrition.savedFoodSearchModal);
    await expect(modal).toBeVisible();

    const input = page.getByTestId(testIds.nutrition.savedFoodSearchInput);
    await input.fill('gr');

    const results = page.getByTestId(testIds.nutrition.savedFoodSearchResults);
    await expect(results).toBeVisible();
    await expect(page.getByTestId(testIds.nutrition.savedFoodResultRow('saved-food-greek-yogurt'))).toBeVisible();
    await expect(page.getByTestId(testIds.nutrition.savedFoodResultRow('saved-food-grilled-chicken'))).toBeVisible();

    await input.fill('greek yo');
    await expect(page.getByTestId(testIds.nutrition.savedFoodResultRow('saved-food-greek-yogurt'))).toBeVisible();
    await expect(page.getByTestId(testIds.nutrition.savedFoodResultRow('saved-food-grilled-chicken'))).not.toBeVisible();
    await expect(page.getByTestId(testIds.nutrition.savedFoodResultRow('saved-food-banana'))).not.toBeVisible();

    await page.getByTestId(testIds.nutrition.savedFoodResultRow('saved-food-greek-yogurt')).click();

    await expect(page.getByTestId(testIds.nutrition.savedFoodSearchModal)).not.toBeVisible();
    await expect(page.getByTestId(testIds.nutrition.nutritionLogList)).toContainText('Greek Yogurt');
  });

  test('shows an empty state when no saved foods match', async ({ page }) => {
    await page.getByTestId(testIds.nutrition.savedFoodSearchButton).click();

    const input = page.getByTestId(testIds.nutrition.savedFoodSearchInput);
    await input.fill('zzzznope');

    await expect(page.getByTestId(testIds.nutrition.savedFoodSearchEmpty)).toBeVisible();
    await expect(page.getByText('No saved foods match "zzzznope".')).toBeVisible();
  });
});
