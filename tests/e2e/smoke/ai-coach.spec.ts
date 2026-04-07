import { expect, test } from '@playwright/test'
import { bootstrapAppState, gotoApp } from '../helpers/bootstrap'
import { setupTestProfile } from '../helpers/setupProfile'
import { testIds } from '../../../src/testIds'

test.describe('Smoke: AI Coach + WebLLM UI paths', () => {
  test('Coach route loads without crashing when WebGPU is unavailable', async ({ page, context }) => {
    await bootstrapAppState(context, {
      clearStorage: true,
      acceptAgeGate: true,
      completeOnboarding: true,
    })

    await context.addInitScript(() => {
      // @ts-expect-error test shim: simulate missing WebGPU
      delete window.navigator.gpu
    })

    await gotoApp(page, '/coach')
    await page.waitForLoadState('networkidle')

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
    await bootstrapAppState(context, {
      clearStorage: true,
      acceptAgeGate: true,
      completeOnboarding: true,
      seedSettings: true,
      settings: {
        enableWebLLMCoach: true,
        aiProvider: 'webllm',
        webllmModelId: 'invalid-model-that-should-be-repaired',
      },
    })

    await gotoApp(page, '/settings')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
    await expect(page.getByText('WebLLM AI Coach')).toBeVisible()
    await expect(page.getByText('AI Assistant Provider')).toBeVisible()
    await expect(page.getByText('WebLLM Status')).toBeVisible()
    await expect(page.getByText(/AI Coach:/i)).toBeVisible()
    await expect(page.getByText(/ENABLED/i)).toBeVisible()
    await expect(page.getByText(/Selected Model:/i)).toBeVisible()
    await expect(page.getByText(/invalid-model-that-should-be-repaired|Qwen|Llama|Phi/i)).toBeVisible()

    await page.getByRole('button', { name: /show debug details/i }).click()
    await expect(page.getByText('AI Debug Information')).toBeVisible()
    await expect(page.getByText(/WebLLM Version:/i)).toBeVisible()
    await expect(page.getByText(/Available Models:/i)).toBeVisible()
  })

  test('Coach page repairs stale WebLLM model selection without crashing', async ({ page, context }) => {
    await bootstrapAppState(context, {
      clearStorage: true,
      acceptAgeGate: true,
      completeOnboarding: true,
      seedSettings: true,
      settings: {
        enableWebLLMCoach: true,
        aiProvider: 'webllm',
        webllmModelId: 'totally-invalid-model-id',
      },
    })

    await setupTestProfile(page)
    await gotoApp(page, '/coach')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('Application Error')).not.toBeVisible()
    await expect(page.getByTestId(testIds.coach.heading)).toBeVisible({ timeout: 10000 })

    const bodyText = await page.textContent('body')
    expect(bodyText).toMatch(/AI Coach|Generate Your Workout Plan|Initialize AI Coach|WebGPU/i)
  })

  test('Global assistant still responds when webllm provider is selected but WebLLM coach is disabled', async ({ page, context }) => {
    await bootstrapAppState(context, {
      clearStorage: true,
      acceptAgeGate: true,
      completeOnboarding: true,
      seedSettings: true,
      settings: {
        enableWebLLMCoach: false,
        aiProvider: 'webllm',
      },
    })

    await setupTestProfile(page)
    await gotoApp(page, '/dashboard')
    await page.waitForLoadState('networkidle')

    await page.getByTestId(testIds.assistant.fab).click()
    await page.getByTestId(testIds.assistant.starter('analyze-trends')).click()

    await expect(page.getByTestId(testIds.assistant.drawer)).toBeVisible()
    await expect(page.getByText(/Consistency score:/i)).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/Biggest lever:/i)).toBeVisible()
  })
})
