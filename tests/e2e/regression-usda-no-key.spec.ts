import { test, expect } from '@playwright/test'
import { bootstrapContext, gotoApp } from './helpers/bootstrap'
import { waitForRouteReady } from './helpers/app'

test.describe('Regression: USDA UI without API key', () => {
  test('Nutrition page should not crash and should show disabled banner when no key is present', async ({ page, context }) => {
    await bootstrapContext(context, {
      clearStorage: true,
      acceptAgeGate: true,
      completeOnboarding: true,
      seedProfile: true,
      seedSettings: true,
      settings: {
        enableUSDALookups: false,
        fdcApiKey: null,
      },
    })

    await gotoApp(page, '/nutrition')
    await waitForRouteReady(page)

    await expect(page.getByText('Application Error')).not.toBeVisible()

    await expect(page.getByTestId('usda-search-button')).not.toBeVisible()
    await expect(page.getByTestId('usda-disabled-banner')).toBeVisible()
  })
})
