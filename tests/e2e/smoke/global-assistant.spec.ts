import { expect, test } from '@playwright/test'
import { bootstrapAppState, gotoApp } from '../helpers/bootstrap'
import { setupTestProfile } from '../helpers/setupProfile'
import { testIds } from '../../../src/testIds'

test.describe('Smoke: Global Assistant Drawer', () => {
  test.beforeEach(async ({ page, context }) => {
    await bootstrapAppState(context, {
      clearStorage: true,
      acceptAgeGate: true,
      completeOnboarding: true,
    })

    await setupTestProfile(page)
  })

  test('opens globally and shows the assistant trend snapshot', async ({ page }) => {
    await gotoApp(page, '/dashboard')
    await page.waitForLoadState('networkidle')

    await expect(page.getByTestId(testIds.assistant.fab)).toBeVisible()
    await expect(page.getByTestId(testIds.assistant.drawer)).not.toBeVisible()

    await page.getByTestId(testIds.assistant.fab).click()

    await expect(page.getByTestId(testIds.assistant.drawer)).toBeVisible()
    await expect(page.getByTestId(testIds.assistant.trendSummary)).toBeVisible()
    await expect(page.getByText(/Fitness-only help across the app/i)).toBeVisible()
    await expect(page.getByText(/Snapshot/i)).toBeVisible()
  })

  test('starter prompts send guided assistant requests', async ({ page }) => {
    await gotoApp(page, '/dashboard')
    await page.waitForLoadState('networkidle')

    await page.getByTestId(testIds.assistant.fab).click()
    await page.getByTestId(testIds.assistant.starter('analyze-trends')).click()

    await expect(page.getByTestId(testIds.assistant.drawer)).toBeVisible()
    await expect(page.getByText(/Consistency score:/i)).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/Biggest lever:/i)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Open Progress' })).toBeVisible()
  })

  test('refuses out-of-domain requests with domain-locked guidance', async ({ page }) => {
    await gotoApp(page, '/dashboard')
    await page.waitForLoadState('networkidle')

    await page.getByTestId(testIds.assistant.fab).click()
    await page.getByTestId(testIds.assistant.input).fill('Solve this algebra equation: 2x + 4 = 10')
    await page.getByTestId(testIds.assistant.input).press('Enter')

    await expect(page.getByText(/domain-locked to fitness, nutrition, recovery, and in-app progress help/i)).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('button', { name: 'Open Progress' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Open Coach' })).toBeVisible()
  })
})
