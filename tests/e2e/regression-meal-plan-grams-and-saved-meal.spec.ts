import { test, expect } from '@playwright/test'
import { bootstrapContext, gotoApp } from './helpers/bootstrap'
import { waitForRouteReady } from './helpers/app'

test.describe('Regression: Meal plan editor grams + add from saved meals', () => {
  test.beforeEach(async ({ context }) => {
    await bootstrapContext(context, {
      clearStorage: true,
      acceptAgeGate: true,
      completeOnboarding: true,
      seedProfile: true,
    })
  })

  test('edit an item by grams and macros visibly change after save', async ({ page }) => {
    await gotoApp(page, '/meals')
    await waitForRouteReady(page)

    // Import a preset so we have a plan to edit
    await page.getByTestId('meals-presets-tab').click()
    const presetCards = page.locator('[data-testid^="meals-preset-card-"]')
    await expect(presetCards.first()).toBeVisible({ timeout: 10_000 })
    await presetCards.first().getByRole('button', { name: 'Import as Copy' }).click()

    await expect(page.getByTestId('meal-plan-title-input')).toBeVisible({ timeout: 10_000 })

    // Add a manual food with known macros
    const manualButton = page.getByTestId(/meal-plan-.*-add-manual-food/).first()
    await manualButton.click()

    const nameInput = page.locator('input[placeholder="e.g., Homemade Salad"]')
    await nameInput.fill('E2E Grams Food')

    // calories/protein/carbs/fat are first 4 number inputs in the modal
    const modal = page.locator('.fixed.inset-0.bg-black').filter({ hasText: 'Add Manual Food' })
    await modal.locator('input[type="number"]').nth(0).fill('200')
    await modal.locator('input[type="number"]').nth(1).fill('30')
    await modal.locator('input[type="number"]').nth(2).fill('10')
    await modal.locator('input[type="number"]').nth(3).fill('5')

    await modal.getByRole('button', { name: 'Add to Meal' }).click()

    // Edit the manual item we just created (avoid picking some empty preset food row)
    const rowByText = page.locator('[data-testid^="meal-plan-food-"]').filter({ hasText: 'E2E Grams Food' }).first()
    await expect(rowByText).toBeVisible({ timeout: 5_000 })

    // Capture stable row testid BEFORE switching to edit mode (text disappears in edit mode)
    const rowTestId = await rowByText.getAttribute('data-testid')
    if (!rowTestId) throw new Error('Expected meal plan food row to have data-testid')

    const foodRow = page.getByTestId(rowTestId)

    const beforeText = await foodRow.textContent()
    const beforeCal = Number((beforeText?.match(/(\d+) cal/) || [])[1] || 0)

    const editButton = foodRow.locator('[data-testid^="meal-plan-food-edit-btn-"]')
    await editButton.click()

    // Wait for edit mode
    const qtyInput = foodRow.locator('[data-testid^="meal-plan-food-edit-qty-"]')
    await expect(qtyInput).toBeVisible({ timeout: 5_000 })

    // Switch to grams
    await foodRow.getByRole('button', { name: 'Grams' }).click()

    await qtyInput.fill('200')

    await foodRow.locator('[data-testid^="meal-plan-food-save-qty-"]').click()

    const afterText = await foodRow.textContent()
    const afterCal = Number((afterText?.match(/(\d+) cal/) || [])[1] || 0)

    expect(afterCal).not.toEqual(beforeCal)
  })

  test('add a saved meal into Breakfast and confirm all items appear', async ({ page }) => {
    await gotoApp(page, '/meals')
    await waitForRouteReady(page)

    // Create a saved meal template with 2 items (manual foods)
    await page.getByRole('button', { name: /Create New Meal/i }).click()
    await page.getByTestId('meal-editor-name-input').fill('E2E Saved Meal')

    await page.getByTestId('meal-editor-add-manual-food-btn').click()
    let modal = page.locator('.fixed.inset-0.bg-black').filter({ hasText: 'Add Manual Food' })
    await modal.locator('input[placeholder="e.g., Homemade Salad"]').fill('Saved Item 1')
    await modal.locator('input[type="number"]').nth(0).fill('100')
    await modal.locator('input[type="number"]').nth(1).fill('10')
    await modal.locator('input[type="number"]').nth(2).fill('10')
    await modal.locator('input[type="number"]').nth(3).fill('2')
    await modal.getByRole('button', { name: 'Add to Meal' }).click()

    await page.getByTestId('meal-editor-add-manual-food-btn').click()
    modal = page.locator('.fixed.inset-0.bg-black').filter({ hasText: 'Add Manual Food' })
    await modal.locator('input[placeholder="e.g., Homemade Salad"]').fill('Saved Item 2')
    await modal.locator('input[type="number"]').nth(0).fill('150')
    await modal.locator('input[type="number"]').nth(1).fill('20')
    await modal.locator('input[type="number"]').nth(2).fill('5')
    await modal.locator('input[type="number"]').nth(3).fill('4')
    await modal.getByRole('button', { name: 'Add to Meal' }).click()

    await page.getByTestId('meal-editor-save-btn').click()

    // Now import a meal plan preset and open editor
    await page.getByTestId('meals-presets-tab').click()
    const presetCards = page.locator('[data-testid^="meals-preset-card-"]')
    await expect(presetCards.first()).toBeVisible({ timeout: 10_000 })
    await presetCards.first().getByRole('button', { name: 'Import as Copy' }).click()
    await expect(page.getByTestId('meal-plan-title-input')).toBeVisible({ timeout: 10_000 })

    // Click "Add Saved Meal" in the first meal section (Breakfast)
    const addSavedMeal = page.getByTestId(/meal-plan-.*-add-from-saved-meal/).first()
    await addSavedMeal.click()

    await expect(page.getByTestId('meal-plan-saved-meal-dialog')).toBeVisible()
    await page.getByTestId('meal-plan-saved-meal-search').fill('E2E Saved Meal')

    const row = page.getByTestId('meal-plan-saved-meal-row').first()
    await row.click()

    // Both items should now appear in the plan editor
    await expect(page.getByText('Saved Item 1')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('Saved Item 2')).toBeVisible({ timeout: 5_000 })
  })
})
