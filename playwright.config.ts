import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // CI can handle a little parallelism. 1 worker is safe but sloooow.
  workers: process.env.CI ? 3 : undefined,
  reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : 'html',
  timeout: 30_000,
  expect: {
    timeout: 7_500,
  },
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
    navigationTimeout: 15_000,
    actionTimeout: 10_000,
    serviceWorkers: 'block', // Block SWs to ensure reliable network mocking in CI
  },
  projects: process.env.CI ? [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ] : [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --host 127.0.0.1 --strictPort --port 4173',
    url: 'http://127.0.0.1:4173',
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
    reuseExistingServer: !process.env.CI,
  },
});