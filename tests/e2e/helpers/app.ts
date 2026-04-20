import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { testIds } from '../../../src/testIds'

/**
 * Waits for the app shell to be rendered and the route-level lazy loading
 * fallback (if any) to disappear.
 */
export async function waitForRouteReady(page: Page) {
  await expect(page.getByTestId(testIds.layout.mainContent)).toBeVisible()

  // If the lazy route fallback is up, wait until it's gone.
  const fallback = page.getByTestId(testIds.app.routeFallback)
  if (await fallback.isVisible().catch(() => false)) {
    await expect(fallback).toBeHidden({ timeout: 30_000 })
  }

  // Wait for any async bootstrap seeding (profile/settings) to finish.
  await page
    .waitForFunction(() => !(window as any).__E2E_BOOTSTRAP_PENDING, null, { timeout: 30_000 })
    .catch(() => {
      // If the flag doesn't exist, cool. If it does and is stuck, Playwright will already
      // give us better error context elsewhere.
    })

  // If seeding explicitly failed, surface it loudly instead of letting tests flake later.
  const bootstrapStatus = await page.evaluate(() => ({
    stage: (window as any).__E2E_BOOTSTRAP_STAGE,
    error: (window as any).__E2E_BOOTSTRAP_ERROR,
  }))

  if (bootstrapStatus?.stage === 'error') {
    throw new Error(`E2E bootstrap seeding failed: ${bootstrapStatus.error ?? 'unknown error'}`)
  }
}
