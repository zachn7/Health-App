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
  /** Optional USDA/FDC API key override (stored in IndexedDB settings). */
  fdcApiKey?: string | null
  enableWebLLMCoach?: boolean
  aiProvider?: 'deterministic' | 'webllm' | 'openai_proxy' | 'openrouter'
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
  fdcApiKey: null,
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
    ({
      clearStorage,
      acceptAgeGate,
      completeOnboarding,
      seedProfile,
      seededProfile,
      seedSettings,
      seededSettings,
      dbName,
      dbVersion,
    }) => {
      // Used by gotoApp() to wait until async IndexedDB seeding has finished.
      // Default to "done" so tests that don't seed don't hang.
      ;(window as any).__e2e_seed_done__ = true

      const clearMarkerKey = '__e2e_clear_done__'
      const seedMarkerKey = '__e2e_seed_completed__'
      const shouldClearStorage = clearStorage && localStorage.getItem(clearMarkerKey) !== 'true'

      if (shouldClearStorage) {
        localStorage.clear()
        // Ensure we don't nuke storage again on reloads within the same test.
        localStorage.setItem(clearMarkerKey, 'true')
        localStorage.removeItem(seedMarkerKey)
      }

      // Default to "no seed requested" so gotoApp() can decide whether to wait.
      ;(window as any).__e2e_seed_requested__ = false

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

      // If we've already seeded this context once (and we're not explicitly clearing),
      // don't do it again on reload. Re-seeding can cause slow/hanging IndexedDB
      // transactions in CI.
      if (!shouldClearStorage && localStorage.getItem(seedMarkerKey) === 'true') {
        return
      }

      // Mark "not done" once we know we actually need to seed.
      ;(window as any).__e2e_seed_done__ = false

      // Expose a promise the app can await (see src/main.tsx) so IndexedDB seeding
      // finishes *before* Dexie tries to read defaults.
      ;(window as any).__e2e_seed_promise__ = new Promise<void>((resolve) => {
        ;(window as any).__e2e_seed_resolve__ = resolve
      })

      // Expose requested seeding so gotoApp() can decide whether to wait.
      ;(window as any).__e2e_seed_requested__ = true

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
      }, 30000)

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

      const startSeed = () => {
        const request = indexedDB.open(dbName, dbVersion)

        request.onupgradeneeded = () => {
          const db = request.result

          // Keep this in sync with src/db/index.ts schema version 5.
          // Yes it's duplicated. No I don't like it either. But E2E bootstrapping runs *before* the app code.
          const ensureStore = (
            name: string,
            options: IDBObjectStoreParameters,
            indexes: Array<{ name: string; keyPath: string | string[]; options?: IDBIndexParameters }> = [],
          ) => {
            if (!db.objectStoreNames.contains(name)) {
              const store = db.createObjectStore(name, options)
              indexes.forEach((idx) => store.createIndex(idx.name, idx.keyPath, idx.options))
            }
          }

          // Core (indexes must match src/db/index.ts schema version 5)
          ensureStore('profiles', { keyPath: 'id' }, [
            { name: 'createdAt', keyPath: 'createdAt' },
            { name: 'updatedAt', keyPath: 'updatedAt' },
            { name: 'age', keyPath: 'age' },
            { name: 'activityLevel', keyPath: 'activityLevel' },
            { name: 'experienceLevel', keyPath: 'experienceLevel' },
            { name: 'lastSync', keyPath: 'lastSync' },
          ])

          ensureStore('settings', { keyPath: 'id' }, [
            { name: 'createdAt', keyPath: 'createdAt' },
            { name: 'updatedAt', keyPath: 'updatedAt' },
            { name: 'lastSync', keyPath: 'lastSync' },
          ])

          // Workouts
          ensureStore('workoutPlans', { keyPath: 'id', autoIncrement: true }, [
            { name: 'name', keyPath: 'name' },
            { name: 'generatedBy', keyPath: 'generatedBy' },
            { name: 'createdAt', keyPath: 'createdAt' },
            { name: 'updatedAt', keyPath: 'updatedAt' },
            { name: 'lastSync', keyPath: 'lastSync' },
          ])

          ensureStore('workoutLogs', { keyPath: 'id', autoIncrement: true }, [
            { name: 'date', keyPath: 'date' },
            { name: 'workoutPlanId', keyPath: 'workoutPlanId' },
            { name: 'createdAt', keyPath: 'createdAt' },
            { name: 'updatedAt', keyPath: 'updatedAt' },
            { name: 'date+workoutPlanId', keyPath: ['date', 'workoutPlanId'] },
            { name: 'lastSync', keyPath: 'lastSync' },
          ])

          // Nutrition
          ensureStore('nutritionLogs', { keyPath: 'id', autoIncrement: true }, [
            { name: 'date', keyPath: 'date' },
            { name: 'createdAt', keyPath: 'createdAt' },
            { name: 'updatedAt', keyPath: 'updatedAt' },
            { name: 'lastSync', keyPath: 'lastSync' },
          ])

          ensureStore('foodItems', { keyPath: 'id', autoIncrement: true }, [
            { name: 'name', keyPath: 'name' },
            { name: 'barcode', keyPath: 'barcode' },
            { name: 'source', keyPath: 'source' },
            { name: 'createdAt', keyPath: 'createdAt' },
            { name: 'updatedAt', keyPath: 'updatedAt' },
            { name: 'name+source', keyPath: ['name', 'source'] },
            { name: 'lastSync', keyPath: 'lastSync' },
          ])

          ensureStore('mealTemplates', { keyPath: 'id', autoIncrement: true }, [
            { name: 'name', keyPath: 'name' },
            { name: 'createdAt', keyPath: 'createdAt' },
            { name: 'updatedAt', keyPath: 'updatedAt' },
            { name: 'lastSync', keyPath: 'lastSync' },
          ])

          ensureStore('mealPlans', { keyPath: 'id', autoIncrement: true }, [
            { name: 'name', keyPath: 'name' },
            { name: 'startDate', keyPath: 'startDate' },
            { name: 'endDate', keyPath: 'endDate' },
            { name: 'generationType', keyPath: 'generationType' },
            { name: 'createdAt', keyPath: 'createdAt' },
            { name: 'updatedAt', keyPath: 'updatedAt' },
            { name: 'startDate+endDate', keyPath: ['startDate', 'endDate'] },
          ])

          // Tracking
          ensureStore('weightLogs', { keyPath: 'id' }, [
            { name: 'date', keyPath: 'date' },
            { name: 'weightKg', keyPath: 'weightKg' },
            { name: 'createdAt', keyPath: 'createdAt' },
            { name: 'updatedAt', keyPath: 'updatedAt' },
            { name: 'lastSync', keyPath: 'lastSync' },
            { name: 'date+weightKg', keyPath: ['date', 'weightKg'] },
          ])

          ensureStore('weeklyCheckIns', { keyPath: 'id', autoIncrement: true }, [
            { name: 'createdAt', keyPath: 'createdAt' },
            { name: 'lastSync', keyPath: 'lastSync' },
          ])

          // Safety
          ensureStore('injuryAssessments', { keyPath: 'id', autoIncrement: true }, [
            { name: 'createdAt', keyPath: 'createdAt' },
            { name: 'area', keyPath: 'area' },
            { name: 'severity', keyPath: 'severity' },
            { name: 'area+severity', keyPath: ['area', 'severity'] },
            { name: 'lastSync', keyPath: 'lastSync' },
          ])

          // Exercise DB
          ensureStore('exercises', { keyPath: 'id' }, [
            { name: 'name', keyPath: 'name' },
            { name: 'bodyPart', keyPath: 'bodyPart' },
            { name: 'category', keyPath: 'category' },
            { name: 'equipment', keyPath: 'equipment' },
            { name: 'difficulty', keyPath: 'difficulty' },
            { name: 'name+bodyPart', keyPath: ['name', 'bodyPart'] },
            { name: 'lastSync', keyPath: 'lastSync' },
          ])

          ensureStore('customExercises', { keyPath: 'id', autoIncrement: true }, [
            { name: 'name', keyPath: 'name' },
            { name: 'createdAt', keyPath: 'createdAt' },
            { name: 'updatedAt', keyPath: 'updatedAt' },
            { name: 'lastSync', keyPath: 'lastSync' },
          ])
        }

        request.onerror = () => {
          finalizeBootstrap('error', request.error ? String(request.error) : 'indexedDB open error')
        }

        request.onsuccess = () => {
          const db = request.result
          const storeNames = [] as string[]
          if (seedProfile && db.objectStoreNames.contains('profiles')) {
            storeNames.push('profiles')
          }
          if (seedSettings && db.objectStoreNames.contains('settings')) {
            storeNames.push('settings')
          }

          const finish = () => {
            ;(window as any).__e2e_seed_done__ = true
            try {
              ;(window as any).__e2e_seed_resolve__?.()
            } catch {
              // ignore
            }
            try {
              localStorage.setItem(seedMarkerKey, 'true')
            } catch {
              // ignore
            }
            db.close()
            finalizeBootstrap('done', null)
          }

          if (storeNames.length === 0) {
            finish()
            return
          }

          const tx = db.transaction(storeNames, 'readwrite')

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
              fdcApiKey: seededSettings.fdcApiKey || undefined,
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

          tx.oncomplete = finish
          tx.onabort = finish
          tx.onerror = finish
        }
      }

      if (shouldClearStorage) {
        const deleteRequest = indexedDB.deleteDatabase(dbName)
        deleteRequest.onsuccess = startSeed
        deleteRequest.onerror = startSeed
        deleteRequest.onblocked = startSeed
      } else {
        startSeed()
      }
    },
    {
      clearStorage,
      acceptAgeGate,
      completeOnboarding,
      seedProfile,
      seededProfile,
      seedSettings,
      seededSettings,
      dbName: DB_NAME,
      dbVersion: DB_VERSION,
    },
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

  // Some tests depend on seeded profile/settings being present on first mount.
  // If we requested seeding, wait for the seed fuse to complete.
  const shouldWaitForSeed = await page
    .evaluate(() => (window as any).__e2e_seed_requested__ === true)
    .catch(() => false)

  if (shouldWaitForSeed) {
    await page.waitForFunction(() => (window as any).__e2e_seed_done__ === true, null, { timeout: 35_000 })
  }
}
