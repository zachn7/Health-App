import type { BrowserContext, Page } from '@playwright/test'

interface SeedProfileOptions {
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

interface SeedSettingsOptions {
  enableUSDALookups?: boolean
  enableWebLLMCoach?: boolean
  aiProvider?: 'deterministic' | 'webllm' | 'openrouter'
  aiAllowLoggingActions?: boolean
  webllmModelId?: string | null
}

interface BootstrapOptions {
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

      // Safety fuse: never hang tests forever if IndexedDB goes sideways.
      setTimeout(() => {
        ;(window as any).__e2e_seed_done__ = true
        try {
          ;(window as any).__e2e_seed_resolve__?.()
        } catch {
          // ignore
        }
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

      const startSeed = () => {
        const request = indexedDB.open(DB_NAME, DB_VERSION)

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

          // Core
          ensureStore('profiles', { keyPath: 'id' })
          ensureStore('settings', { keyPath: 'id' })

          // Workouts
          ensureStore('workoutPlans', { keyPath: 'id', autoIncrement: true })
          ensureStore('workoutLogs', { keyPath: 'id', autoIncrement: true })

          // Nutrition
          ensureStore('nutritionLogs', { keyPath: 'id', autoIncrement: true })
          ensureStore('foodItems', { keyPath: 'id', autoIncrement: true })
          ensureStore('mealTemplates', { keyPath: 'id', autoIncrement: true })
          ensureStore('mealPlans', { keyPath: 'id', autoIncrement: true })

          // Tracking
          ensureStore('weightLogs', { keyPath: 'id' })
          ensureStore('weeklyCheckIns', { keyPath: 'id', autoIncrement: true })

          // Safety
          ensureStore('injuryAssessments', { keyPath: 'id', autoIncrement: true })

          // Exercise DB
          ensureStore('exercises', { keyPath: 'id' })
          ensureStore('customExercises', { keyPath: 'id', autoIncrement: true })
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

          if (storeNames.length === 0) {
            db.close()
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
          }

          tx.oncomplete = finish
          tx.onabort = finish
          tx.onerror = finish
        }
      }

      if (clearStorage) {
        const deleteRequest = indexedDB.deleteDatabase(DB_NAME)
        deleteRequest.onsuccess = startSeed
        deleteRequest.onerror = startSeed
        deleteRequest.onblocked = startSeed
      } else {
        startSeed()
      }
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
  options: { cacheBust?: boolean } = {},
) {
  const { cacheBust = true } = options
  await page.goto(buildAppUrl(hashPath, cacheBust), { waitUntil: 'domcontentloaded' })

  // Wait for the initScript DB seeding to finish (if seeding was requested).
  await page.waitForFunction(() => (window as any).__e2e_seed_done__ === true, null, { timeout: 20_000 })
}
