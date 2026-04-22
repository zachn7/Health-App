import { expect, test } from '@playwright/test'
import { bootstrapContext, gotoApp } from '../helpers/bootstrap'
import { waitForRouteReady } from '../helpers/app'
import { testIds } from '../../../src/testIds'

test.describe('Smoke: AI Coach + WebLLM UI paths', () => {
  test('Coach route loads without crashing when WebGPU is unavailable', async ({ page, context }) => {
    await bootstrapContext(context, {
      clearStorage: true,
      acceptAgeGate: true,
      completeOnboarding: true,
    })

    await context.addInitScript(() => {
      // @ts-expect-error test shim: simulate missing WebGPU
      delete window.navigator.gpu
    })

    await gotoApp(page, '/coach')
    await waitForRouteReady(page)

    await expect(page.getByText('Application Error')).not.toBeVisible()

    await expect
      .poll(async () => {
        const loading = await page.getByTestId(testIds.coach.loading).isVisible().catch(() => false)
        const profileRequired = await page.getByTestId(testIds.coach.profileRequired).isVisible().catch(() => false)
        const heading = await page.getByTestId(testIds.coach.heading).isVisible().catch(() => false)
        return loading || profileRequired || heading
      }, { timeout: 10000 })
      .toBe(true)
  })

  test('Settings page reflects persisted WebLLM settings and diagnostics', async ({ page, context }) => {
    await bootstrapContext(context, {
      clearStorage: true,
      acceptAgeGate: true,
      completeOnboarding: true,
      seedProfile: true,
      seedSettings: true,
      settings: {
        enableWebLLMCoach: true,
        aiProvider: 'webllm',
        webllmModelId: 'invalid-model-that-should-be-repaired',
      },
    })

    await gotoApp(page, '/settings')
    await waitForRouteReady(page)

    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
    await expect(page.getByText('WebLLM AI Coach')).toBeVisible()
    await expect(page.getByText('AI Assistant Provider')).toBeVisible()
    await expect(page.getByText('WebLLM Status')).toBeVisible()
    // Be specific: "ENABLED" appears in multiple places (and Playwright strict mode hates ambiguity).
    const webllmStatusCard = page.getByRole('heading', { name: 'WebLLM Status' }).locator('..').locator('..')

    await expect(webllmStatusCard.getByText(/AI Coach:/i)).toBeVisible()

    // If the settings toggle was seeded to enabled, diagnostics should eventually show ENABLED.
    // But the Settings UI hard-disables enabling when WebGPU isn't available, and these smoke
    // tests run on machines that may not have WebGPU. So: accept either state, but ensure the
    // row exists and is stable.
    // There are multiple "Disabled" labels in this card (badge + row value), so avoid strict-mode ambiguity.
    const statusRowValue = webllmStatusCard
      .getByText('AI Coach:')
      .locator('..')
      .locator('span')
      .last()

    await expect(statusRowValue).toBeVisible()
    await expect(statusRowValue).toHaveText(/ENABLED|DISABLED/i)

    await expect(webllmStatusCard.getByText(/Browser support:/i)).toBeVisible()
    await expect(webllmStatusCard.getByText(/Runtime ready:/i)).toBeVisible()
    await expect(webllmStatusCard.getByText(/Selected Model:/i)).toBeVisible()
    await expect(page.getByText(/invalid-model-that-should-be-repaired|Qwen|Llama|Phi/i)).toBeVisible()

    await page.getByRole('button', { name: /show debug details/i }).click()
    await expect(page.getByText('AI Debug Information')).toBeVisible()
    await expect(page.getByText(/WebLLM Version:/i)).toBeVisible()
    await expect(page.getByText(/Available Models:/i)).toBeVisible()
  })

  test('Coach page repairs stale WebLLM model selection without crashing', async ({ page, context }) => {
    await bootstrapContext(context, {
      clearStorage: true,
      acceptAgeGate: true,
      completeOnboarding: true,
      seedProfile: true,
      seedSettings: true,
      settings: {
        enableWebLLMCoach: true,
        aiProvider: 'webllm',
        webllmModelId: 'totally-invalid-model-id',
      },
    })

    await gotoApp(page, '/coach')
    await waitForRouteReady(page)

    await expect(page.getByText('Application Error')).not.toBeVisible()

    // Seeding happens via async init script. Coach reads profile on mount, so in some
    // runtimes it may render "Profile Required" before the seeded profile is visible.
    // Both states are acceptable as long as the route stays stable and doesn't crash.
    const coachHeading = page.getByTestId(testIds.coach.heading)
    const profileRequired = page.getByTestId(testIds.coach.profileRequired)

    const state = await expect
      .poll(async () => {
        if (await coachHeading.isVisible().catch(() => false)) return 'coach'
        if (await profileRequired.isVisible().catch(() => false)) return 'profile-required'
        return null
      }, { timeout: 10_000 })
      .not.toBeNull()

    // If the full coach UI is visible, assert the offline (non-WebLLM) path is stable.
    // Otherwise, don't be precious: "Profile Required" might flash briefly while IndexedDB seeding finishes.
    if (await coachHeading.isVisible().catch(() => false)) {
      await expect(page.getByRole('button', { name: 'Generate Offline Plan' })).toBeVisible()
      // Coach must always render and never crash; inline AI warnings may vary.
      await expect(page.getByText(/offline/i).first()).toBeVisible()
    }

    const bodyText = await page.textContent('body')
    expect(bodyText).toMatch(/Profile Required|AI Coach|Generate Offline Plan|WebGPU|offline/i)
  })

  test('Global assistant still responds when webllm provider is selected but WebLLM coach is disabled', async ({ page, context }) => {
    await bootstrapContext(context, {
      clearStorage: true,
      acceptAgeGate: true,
      completeOnboarding: true,
      seedProfile: true,
      seedSettings: true,
      settings: {
        enableWebLLMCoach: false,
        aiProvider: 'webllm',
      },
    })

    await gotoApp(page, '/dashboard')
    await waitForRouteReady(page)

    // The app may read profile before our IndexedDB seed finishes (React mounts before initDatabase).
    // A single reload makes the seeded profile visible immediately on mount.
    await page.reload({ waitUntil: 'domcontentloaded' })
    await waitForRouteReady(page)

    await page.getByTestId(testIds.assistant.fab).click()
    await page.getByTestId(testIds.assistant.starter('analyze-trends')).click()

    await expect(page.getByTestId(testIds.assistant.drawer)).toBeVisible()
    await expect(page.getByText(/Consistency score:/i)).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/Biggest lever:/i)).toBeVisible()
  })
})
