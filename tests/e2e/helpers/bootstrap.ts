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

const DB_NAME = 'CodePuppyTrainerDB'
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

      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains('profiles')) {
          db.createObjectStore('profiles', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'id' })
        }
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

        tx.oncomplete = () => db.close()
        tx.onabort = () => db.close()
        tx.onerror = () => db.close()
      }
    },
    { clearStorage, acceptAgeGate, completeOnboarding, seedProfile, seededProfile, seedSettings, seededSettings },
  )
}

export async function gotoApp(page: Page, hashPath = '/') {
  await page.goto(`./#${hashPath}`)
}
