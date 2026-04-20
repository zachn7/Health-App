import type { BrowserContext, Page } from '@playwright/test'

export interface SeedProfileOptions {
  age?: number
  sex?: 'male' | 'female'
  activityLevel?: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'
  experienceLevel?: 'beginner' | 'intermediate' | 'advanced'
  equipment?: string[]
  schedule?: string[]
  heightCm?: number
  weightKg?: number
  macros?: {
    protein: number
    carbs: number
    fat: number
  }
}

export interface SeedSettingsOptions {
  enableUSDALookups?: boolean
  enableWebLLMCoach?: boolean
  aiProvider?: 'deterministic' | 'webllm' | 'openrouter'
  aiAllowLoggingActions?: boolean
  webllmModelId?: string | null
}

export interface BootstrapOptions {
  clearStorage?: boolean
  acceptAgeGate?: boolean
  completeOnboarding?: boolean
  seedProfile?: boolean
  profile?: SeedProfileOptions
  seedSettings?: boolean
  settings?: SeedSettingsOptions
}

const defaultProfile: Required<SeedProfileOptions> = {
  age: 30,
  sex: 'male',
  activityLevel: 'moderate',
  experienceLevel: 'beginner',
  equipment: ['bodyweight'],
  schedule: ['monday'],
  heightCm: 175,
  weightKg: 75,
  macros: {
    protein: 30,
    carbs: 40,
    fat: 30,
  },
}

const defaultSettings: Required<SeedSettingsOptions> = {
  enableUSDALookups: false,
  enableWebLLMCoach: false,
  aiProvider: 'deterministic',
  aiAllowLoggingActions: false,
  webllmModelId: null,
}

const DB_NAME = 'FitBudAIDB'
const DB_VERSION = 5

const DEFAULT_BOOTSTRAP: Required<Pick<BootstrapOptions, 'clearStorage' | 'acceptAgeGate' | 'completeOnboarding'>> = {
  // Each Playwright test gets a fresh BrowserContext anyway.
  // Clearing on *every* navigation/reload is slow and breaks tests that
  // intentionally validate persistence.
  clearStorage: false,
  acceptAgeGate: true,
  completeOnboarding: true,
}

const bootstrappedContexts = new WeakMap<BrowserContext, string>()

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`

  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`
}

function optionsSignature(options: BootstrapOptions): string {
  // Stable-ish signature so we can detect accidental conflicting bootstraps.
  // (Recursive key sorting so object literal key ordering doesn't troll us.)
  return stableStringify(options)
}

export function isBootstrapped(context: BrowserContext): boolean {
  return bootstrappedContexts.has(context)
}

export async function bootstrapContext(context: BrowserContext, options: BootstrapOptions = DEFAULT_BOOTSTRAP) {
  const signature = optionsSignature(options)
  const existing = bootstrappedContexts.get(context)

  if (existing) {
    if (existing !== signature) {
      throw new Error(
        `This BrowserContext was bootstrapped already with different options.\n` +
          `Existing: ${existing}\n` +
          `New: ${signature}`,
      )
    }
    return
  }

  await bootstrapAppState(context, options)
  bootstrappedContexts.set(context, signature)
}

export async function bootstrapAppState(context: BrowserContext, options: BootstrapOptions = {}) {
  const {
    clearStorage = false,
    acceptAgeGate = true,
    completeOnboarding = false,
    seedProfile = false,
    profile = {},
    seedSettings = false,
    settings = {},
  } = options

  const seededProfile = {
    ...defaultProfile,
    ...profile,
    macros: {
      ...defaultProfile.macros,
      ...(profile.macros ?? {}),
    },
  }

  const seededSettings = {
    ...defaultSettings,
    ...settings,
  }

  await context.addInitScript(
    ({ clearStorage, acceptAgeGate, completeOnboarding, seedProfile, seededProfile, seedSettings, seededSettings }) => {
      // Used by gotoApp() to wait until async IndexedDB seeding has finished.
      // Default to "done" so tests that don't seed don't hang.
      ;(window as any).__e2e_seed_done__ = true

      if (clearStorage) {
        localStorage.clear()
      }

      if (acceptAgeGate) {
        localStorage.setItem('age_gate_accepted', 'true')
        localStorage.setItem('age_gate_timestamp', new Date().toISOString())
      }

      if (completeOnboarding) {
        localStorage.setItem('onboarding_completed', 'true')
      }

      // Tiny sync hook so tests can wait until async seeding is done.
      // @ts-expect-error - injected test-only flag
      window.__E2E_BOOTSTRAP_PENDING = false
      // @ts-expect-error - injected test-only flag
      window.__E2E_BOOTSTRAP_STAGE = 'noop'
      // @ts-expect-error - injected test-only flag
      window.__E2E_BOOTSTRAP_ERROR = null

      if (!seedProfile && !seedSettings) {
        return
      }

      // Mark "not done" once we know we actually need to seed.
      ;(window as any).__e2e_seed_done__ = false

      // Expose a promise the app can await (see src/main.tsx) so IndexedDB seeding
      // finishes *before* Dexie tries to read defaults.
      ;(window as any).__e2e_seed_promise__ = new Promise<void>((resolve) => {
        ;(window as any).__e2e_seed_resolve__ = resolve
      })

      // @ts-expect-error - injected test-only flag
      window.__E2E_BOOTSTRAP_PENDING = true
      // @ts-expect-error - injected test-only flag
      window.__E2E_BOOTSTRAP_STAGE = 'start'
      // @ts-expect-error - injected test-only flag
      window.__E2E_BOOTSTRAP_ERROR = null

      const finalizeBootstrap = (stage, error = null) => {
        try {
          // @ts-expect-error - injected test-only flag
          window.__E2E_BOOTSTRAP_STAGE = stage
          // @ts-expect-error - injected test-only flag
          window.__E2E_BOOTSTRAP_ERROR = error
          // @ts-expect-error - injected test-only flag
          window.__E2E_BOOTSTRAP_PENDING = false
        } catch {
          // ignore
        }
      }

      // Safety fuse: never hang tests forever if IndexedDB goes sideways.
      setTimeout(() => {
        ;(window as any).__e2e_seed_done__ = true
        try {
          ;(window as any).__e2e_seed_resolve__?.()
        } catch {
          // ignore
        }
        finalizeBootstrap('error', 'E2E bootstrap timed out')
      }, 15000)

      const schedule = {
        monday: seededProfile.schedule.includes('monday'),
        tuesday: seededProfile.schedule.includes('tuesday'),
        wednesday: seededProfile.schedule.includes('wednesday'),
        thursday: seededProfile.schedule.includes('thursday'),
        friday: seededProfile.schedule.includes('friday'),
        saturday: seededProfile.schedule.includes('saturday'),
        sunday: seededProfile.schedule.includes('sunday'),
      }

      const now = new Date().toISOString()
      const seededDbProfile = {
        id: 'bootstrap-profile',
        age: seededProfile.age,
        sex: seededProfile.sex,
        heightCm: seededProfile.heightCm,
        weightKg: seededProfile.weightKg,
        preferredUnits: 'metric',
        activityLevel: seededProfile.activityLevel,
        experienceLevel: seededProfile.experienceLevel,
        goals: [
          {
            id: 'bootstrap-goal',
            type: 'general_fitness',
            priority: 1,
            isPrimary: true,
            targetDate: '',
            createdAt: now,
            updatedAt: now,
          },
        ],
        equipment: seededProfile.equipment,
        schedule,
        limitations: '',
        macroSplit: seededProfile.macros,
        createdAt: now,
        updatedAt: now,
      }

      // The DB is created by the app (Dexie) during initDatabase().
      // In CI, that can race our initScript. We *must not* create the DB ourselves
      // (that would create v1 and break migrations), so we poll until it exists.

      const MAX_ATTEMPTS = 200
      const RETRY_DELAY_MS = 50

      const seedOnceDbExists = (attempt = 0) => {
        if (attempt >= MAX_ATTEMPTS) {
          finalizeBootstrap('error', 'Timed out waiting for IndexedDB database to exist')
          return
        }

        let request
        try {
          request = indexedDB.open(DB_NAME)
        } catch (e) {
          finalizeBootstrap('error', String(e))
          return
        }

        request.onupgradeneeded = () => {
          // DB doesn't exist yet. Abort creating it.
          try {
            // @ts-expect-error - injected test-only flag
            window.__E2E_BOOTSTRAP_STAGE = 'waiting-for-db'
          } catch {
            // ignore
          }

          try {
            request.transaction?.abort()
          } catch {
            // ignore
          }
        }

        request.onerror = () => {
          const errName = request.error?.name
          if (errName === 'AbortError') {
            setTimeout(() => seedOnceDbExists(attempt + 1), RETRY_DELAY_MS)
            return
          }
          finalizeBootstrap('error', request.error ? String(request.error) : 'indexedDB open error')
        }

        request.onsuccess = () => {
          const db = request.result

          const hasProfiles = db.objectStoreNames.contains('profiles')
          const hasSettings = db.objectStoreNames.contains('settings')

          if ((seedProfile && !hasProfiles) || (seedSettings && !hasSettings)) {
            db.close()
            setTimeout(() => seedOnceDbExists(attempt + 1), RETRY_DELAY_MS)
            return
          }

          const storeNames = [] as string[]
          if (seedProfile) storeNames.push('profiles')
          if (seedSettings) storeNames.push('settings')

          let tx: IDBTransaction
          try {
            tx = db.transaction(storeNames, 'readwrite')
          } catch (e) {
            db.close()
            finalizeBootstrap('error', String(e))
            return
          }

          if (seedProfile) {
            const profileStore = tx.objectStore('profiles')
            const writeProfile = () => profileStore.put(seededDbProfile)

            if (clearStorage) {
              const clearRequest = profileStore.clear()
              clearRequest.onsuccess = writeProfile
              clearRequest.onerror = writeProfile
            } else {
              writeProfile()
            }
          }

          if (seedSettings) {
            const now = new Date().toISOString()
            const settingsStore = tx.objectStore('settings')
            const seededDbSettings = {
              id: 'user-settings',
              createdAt: now,
              updatedAt: now,
              enableUSDALookups: seededSettings.enableUSDALookups,
              enableWebLLMCoach: seededSettings.enableWebLLMCoach,
              aiProvider: seededSettings.aiProvider,
              aiAllowLoggingActions: seededSettings.aiAllowLoggingActions,
              webllmModelId: seededSettings.webllmModelId || undefined,
            }
            const writeSettings = () => settingsStore.put(seededDbSettings)

            if (clearStorage) {
              const clearRequest = settingsStore.clear()
              clearRequest.onsuccess = writeSettings
              clearRequest.onerror = writeSettings
            } else {
              writeSettings()
            }
          }

          const finish = () => {
            ;(window as any).__e2e_seed_done__ = true
            try {
              ;(window as any).__e2e_seed_resolve__?.()
            } catch {
              // ignore
            }
            db.close()
            finalizeBootstrap('done', null)
          }

          tx.oncomplete = finish
          tx.onabort = finish
          tx.onerror = finish
        }
      }

      seedOnceDbExists()
      }

      seedOnceDbExists()
    },
    { clearStorage, acceptAgeGate, completeOnboarding, seedProfile, seededProfile, seedSettings, seededSettings },
  )
}

function buildAppUrl(hashPath: string, cacheBust: boolean): string {
  const normalizedHashPath = hashPath.startsWith('/') ? hashPath : `/${hashPath}`
  const cacheBustQuery = cacheBust ? `?e2e_nav=${Date.now()}` : ''
  return `./${cacheBustQuery}#${normalizedHashPath}`
}

export async function gotoApp(
  page: Page,
  hashPath = '/',
  options: { cacheBust?: boolean; bootstrap?: BootstrapOptions } = {},
) {
  const { cacheBust = true, bootstrap } = options

  // Ensure the app doesn't get stuck behind the age gate / onboarding in tests.
  // If a context is already bootstrapped, we *don't* try to re-bootstrap it unless
  // the caller explicitly provides options.
  const context = page.context()
  if (!isBootstrapped(context)) {
    await bootstrapContext(context, bootstrap ?? DEFAULT_BOOTSTRAP)
  } else if (bootstrap) {
    await bootstrapContext(context, bootstrap)
  }

  await page.goto(buildAppUrl(hashPath, cacheBust), { waitUntil: 'domcontentloaded' })

  // Wait for the initScript DB seeding to finish (if seeding was requested).
  await page.waitForFunction(() => (window as any).__e2e_seed_done__ === true, null, { timeout: 20_000 })
}
