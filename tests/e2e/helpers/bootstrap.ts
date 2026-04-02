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

interface BootstrapOptions {
  clearStorage?: boolean
  acceptAgeGate?: boolean
  completeOnboarding?: boolean
  seedProfile?: boolean
  profile?: SeedProfileOptions
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

const DB_NAME = 'CodePuppyTrainerDB'
const DB_VERSION = 5

export async function bootstrapAppState(context: BrowserContext, options: BootstrapOptions = {}) {
  const {
    clearStorage = false,
    acceptAgeGate = true,
    completeOnboarding = false,
    seedProfile = false,
    profile = {},
  } = options

  const seededProfile = {
    ...defaultProfile,
    ...profile,
    macros: {
      ...defaultProfile.macros,
      ...(profile.macros ?? {}),
    },
  }

  await context.addInitScript(
    ({ clearStorage, acceptAgeGate, completeOnboarding, seedProfile, seededProfile }) => {
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

      if (!seedProfile) {
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
      }

      request.onsuccess = () => {
        const db = request.result
        if (!db.objectStoreNames.contains('profiles')) {
          db.close()
          return
        }

        const tx = db.transaction('profiles', 'readwrite')
        const store = tx.objectStore('profiles')
        const writeProfile = () => store.put(seededDbProfile)

        if (clearStorage) {
          const clearRequest = store.clear()
          clearRequest.onsuccess = writeProfile
          clearRequest.onerror = writeProfile
        } else {
          writeProfile()
        }

        tx.oncomplete = () => db.close()
        tx.onabort = () => db.close()
        tx.onerror = () => db.close()
      }
    },
    { clearStorage, acceptAgeGate, completeOnboarding, seedProfile, seededProfile },
  )
}

export async function gotoApp(page: Page, hashPath = '/') {
  await page.goto(`./#${hashPath}`)
}
