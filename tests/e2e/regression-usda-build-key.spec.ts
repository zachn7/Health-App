import { test, expect } from '@playwright/test'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { bootstrapContext } from './helpers/bootstrap'
import { waitForRouteReady } from './helpers/app'
import { applyUsdaMocks } from './helpers/mockUsdaFdc'

const BUILD_PORT = 4174
const BUILD_DIR = 'dist-usda-buildkey'

async function waitForServerReady(proc: ChildProcessWithoutNullStreams): Promise<void> {
  return await new Promise((resolve, reject) => {
    let seen = ''

    const onData = (chunk: Buffer) => {
      const text = chunk.toString('utf8')
      // Vite pretty-prints with ANSI colors/bold, which can split the port number.
      // Strip ANSI so we can reliably detect readiness.
      const cleaned = text.replace(/\x1b\[[0-9;]*m/g, '')
      seen = (seen + cleaned).slice(-4000)

      if (seen.includes(`http://127.0.0.1:${BUILD_PORT}`) || seen.includes(`:${BUILD_PORT}`)) {
        cleanup()
        resolve()
      }
    }

    const onExit = (code: number | null) => {
      cleanup()
      reject(new Error(`USDA build-key preview server exited early (code=${code ?? 'null'})`))
    }

    const cleanup = () => {
      proc.stdout.off('data', onData)
      proc.stderr.off('data', onData)
      proc.off('exit', onExit)
    }

    proc.stdout.on('data', onData)
    proc.stderr.on('data', onData)
    proc.on('exit', onExit)

    // Failsafe: don't hang forever if Vite changes its logs.
    setTimeout(() => {
      cleanup()
      reject(new Error(`Timed out waiting for build-key preview server to become ready. Last output:\n${seen}`))
    }, 60_000)
  })
}

test.describe('Regression: USDA UI with build-time key', () => {
  test.describe.configure({ mode: 'serial' })

  let previewProc: ChildProcessWithoutNullStreams | null = null

  test.beforeAll(async () => {
    test.setTimeout(180_000)

    // Build a SECOND bundle with a build-time key, to prove "it just works".
    // This avoids messing with the main Playwright webServer (which is used by the rest of the suite).
    // Note: network is still mocked; key is public and not actually used.
    const buildCmd = `VITE_USDA_API_KEY=e2e-build-key npx vite build --outDir ${BUILD_DIR} --emptyOutDir --base=/`
    const build = spawn(buildCmd, { shell: true, stdio: 'inherit' })
    const buildExit = await new Promise<number>((resolve) => build.on('exit', (code) => resolve(code ?? 1)))
    if (buildExit !== 0) {
      throw new Error(`Failed to build USDA build-key bundle (exit=${buildExit})`)
    }

    const previewCmd = `npx vite preview --outDir ${BUILD_DIR} --base=/ --host 127.0.0.1 --strictPort --port ${BUILD_PORT}`
    previewProc = spawn(previewCmd, { shell: true, stdio: ['ignore', 'pipe', 'pipe'] })
    await waitForServerReady(previewProc)
  })

  test.afterAll(async () => {
    previewProc?.kill('SIGTERM')
    previewProc = null
  })

  test('Nutrition page should show search button when build-time key exists (no Settings interaction)', async ({ page, context }) => {
    test.setTimeout(60_000)

    await bootstrapContext(context, {
      clearStorage: true,
      acceptAgeGate: true,
      completeOnboarding: true,
      seedProfile: true,
      // Intentionally do NOT seed settings. This is the "it just works" case.
    })

    applyUsdaMocks(page)

    await page.goto(`http://127.0.0.1:${BUILD_PORT}/?e2e_nav=${Date.now()}#/nutrition`, {
      waitUntil: 'domcontentloaded',
    })
    await waitForRouteReady(page)

    await expect(page.getByText('Application Error')).not.toBeVisible()

    await expect(page.getByTestId('usda-disabled-banner')).not.toBeVisible()
    await expect(page.getByTestId('usda-search-button')).toBeVisible()
  })
})
