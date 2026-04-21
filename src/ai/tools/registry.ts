import { repositories } from '@/db'
import { settingsRepository } from '@/db/repositories/settings.repository'
import { calculateMacroTargets, calculateTDEE, generateWorkoutPlan } from '@/lib/coach-engine'
import type { MealPlan, WorkoutPlan } from '@/types'
import type { ToolCallResult, ToolSpec } from './types'
import type { AIProxyTool } from '@/lib/ai-proxy-client'

function guardAllowLogging() {
  return settingsRepository.getAIAllowLoggingActions()
}

function ok(message: string, data?: unknown): ToolCallResult {
  return { ok: true, message, data }
}

function fail(message: string, data?: unknown): ToolCallResult {
  return { ok: false, message, data }
}

export function getToolSpecs(): ToolSpec[] {
  return [
    {
      name: 'open_page',
      description: 'Navigate the user to a page in the app by returning a path (hash route).',
      parametersSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'App hash route path starting with / e.g. /nutrition, /log/workout' },
        },
        required: ['path'],
        additionalProperties: false,
      },
      async execute(args: any) {
        const path = String(args?.path || '')
        if (!path.startsWith('/')) return fail('Path must start with /')
        return ok('Navigate to page', { path })
      },
    },
    {
      name: 'log_weight',
      description: 'Log a bodyweight entry for a specific date. If date is omitted, use today.',
      parametersSchema: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'YYYY-MM-DD local date key (optional)' },
          weightKg: { type: 'number', description: 'Bodyweight in kilograms' },
          notes: { type: 'string' },
        },
        required: ['weightKg'],
        additionalProperties: false,
      },
      async execute(args: any) {
        if (!(await guardAllowLogging())) {
          return fail('Logging actions are disabled in Settings. Enable “Allow assistant logging actions” to let the coach do this.')
        }

        const weightKg = Number(args?.weightKg)
        if (!Number.isFinite(weightKg) || weightKg <= 0) return fail('weightKg must be a positive number')

        const date = typeof args?.date === 'string' && args.date ? args.date : new Date().toISOString().split('T')[0]
        const notes = typeof args?.notes === 'string' ? args.notes : undefined

        const saved = await repositories.progress.createWeightLog({ date, weightKg, notes })
        return ok(`Logged weight ${weightKg} kg on ${date}.`, { saved })
      },
    },
    {
      name: 'log_food',
      description: 'Log a food item into the Nutrition log for a specific date and meal group.',
      parametersSchema: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'YYYY-MM-DD local date key (optional)' },
          mealGroup: { type: 'string', enum: ['Breakfast', 'Lunch', 'Dinner', 'Snacks', 'Uncategorized'] },
          item: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              servingSize: { type: 'string' },
              quantidade: { type: 'number' },
              calories: { type: 'number' },
              proteinG: { type: 'number' },
              carbsG: { type: 'number' },
              fatG: { type: 'number' },
              fiberG: { type: 'number' },
              sugarG: { type: 'number' },
              sodiumMg: { type: 'number' },
              baseUnit: { type: 'string', enum: ['serving', 'grams'] },
              servingGrams: { type: 'number' },
              computedTotalGrams: { type: 'number' },
              fdcId: { type: 'number' },
            },
            required: ['name', 'servingSize', 'quantidade', 'calories', 'proteinG', 'carbsG', 'fatG', 'baseUnit', 'servingGrams', 'computedTotalGrams'],
            additionalProperties: true,
          },
        },
        required: ['item'],
        additionalProperties: false,
      },
      async execute(args: any) {
        if (!(await guardAllowLogging())) {
          return fail('Logging actions are disabled in Settings. Enable “Allow assistant logging actions” to let the coach do this.')
        }

        const date = typeof args?.date === 'string' && args.date ? args.date : new Date().toISOString().split('T')[0]
        const mealGroup = (typeof args?.mealGroup === 'string' ? args.mealGroup : 'Uncategorized') as any
        const item = args?.item || {}

        const foodLogItem = {
          id: crypto.randomUUID(),
          name: String(item.name || 'Unknown food'),
          servingSize: String(item.servingSize || '1 serving'),
          quantidade: Number(item.quantidade ?? 1),
          calories: Number(item.calories ?? 0),
          proteinG: Number(item.proteinG ?? 0),
          carbsG: Number(item.carbsG ?? 0),
          fatG: Number(item.fatG ?? 0),
          fiberG: item.fiberG !== undefined ? Number(item.fiberG) : undefined,
          sugarG: item.sugarG !== undefined ? Number(item.sugarG) : undefined,
          sodiumMg: item.sodiumMg !== undefined ? Number(item.sodiumMg) : undefined,
          baseUnit: (item.baseUnit === 'grams' ? 'grams' : 'serving') as 'serving' | 'grams',
          servingGrams: Number(item.servingGrams ?? 100),
          computedTotalGrams: Number(item.computedTotalGrams ?? (Number(item.quantidade ?? 1) * Number(item.servingGrams ?? 100))),
          fdcId: item.fdcId !== undefined ? Number(item.fdcId) : undefined,
          mealGroup,
        }

        const saved = await repositories.nutrition.addFoodToDayLog(date, foodLogItem)
        return ok(`Logged food “${foodLogItem.name}” to ${mealGroup} on ${date}.`, { saved })
      },
    },
    {
      name: 'log_workout',
      description: 'Log a simple workout session to the Workout Logger for a specific date.',
      parametersSchema: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'YYYY-MM-DD local date key (optional)' },
          durationMinutes: { type: 'number', description: 'Total session duration in minutes' },
          entries: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                exerciseId: { type: 'string' },
                exerciseName: { type: 'string' },
                sets: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      set: { type: 'number' },
                      reps: { type: 'number' },
                      weight: { type: 'number' },
                      rpe: { type: 'number' },
                    },
                    required: ['set', 'reps'],
                    additionalProperties: false,
                  },
                },
                notes: { type: 'string' },
              },
              required: ['exerciseName', 'sets'],
              additionalProperties: true,
            },
          },
          sessionNotes: { type: 'string' },
        },
        required: ['entries'],
        additionalProperties: false,
      },
      async execute(args: any) {
        if (!(await guardAllowLogging())) {
          return fail('Logging actions are disabled in Settings. Enable “Allow assistant logging actions” to let the coach do this.')
        }

        const date = typeof args?.date === 'string' && args.date ? args.date : new Date().toISOString().split('T')[0]
        const durationMinutes = Number(args?.durationMinutes ?? 0)
        const entries = Array.isArray(args?.entries) ? args.entries : []
        if (entries.length === 0) return fail('Workout entries must be a non-empty array')

        const log = await repositories.workout.createWorkoutLog({
          date,
          workoutPlanId: undefined,
          entries: entries.map((e: any) => ({
            exerciseId: String(e.exerciseId || String(e.exerciseName || '').toLowerCase().replace(/[^a-z0-9]/g, '-')),
            exerciseName: String(e.exerciseName || 'Unknown exercise'),
            sets: (Array.isArray(e.sets) ? e.sets : []).map((s: any, idx: number) => ({
              set: Number(s.set ?? (idx + 1)),
              reps: Number(s.reps ?? 0),
              weight: s.weight !== undefined ? Number(s.weight) : undefined,
              rpe: s.rpe !== undefined ? Number(s.rpe) : undefined,
            })),
            notes: typeof e.notes === 'string' ? e.notes : undefined,
          })),
          cardioEntries: [],
          sessionNotes: typeof args?.sessionNotes === 'string' ? args.sessionNotes : undefined,
          duration: Number.isFinite(durationMinutes) ? durationMinutes : 0,
          timeEntries: [],
        })

        return ok(`Logged workout on ${date} with ${entries.length} exercises.`, { log })
      },
    },
    {
      name: 'create_workout_plan',
      description: 'Create a new workout plan using the built-in coach engine. Returns a plan draft (not saved).',
      parametersSchema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
        required: [],
        additionalProperties: false,
      },
      async execute(args: any) {
        const profile = await repositories.profile.get()
        if (!profile) return fail('No profile found. User must complete profile first.')

        const plan = await generateWorkoutPlan(profile)
        const named: WorkoutPlan = {
          ...plan,
          name: typeof args?.name === 'string' && args.name.trim() ? args.name.trim() : plan.name,
        }

        return ok('Workout plan draft created. Ask user to confirm saving.', { workoutPlan: named })
      },
    },
    {
      name: 'create_meal_plan',
      description: 'Create a simple meal plan draft using current profile macro targets. Returns a plan draft (not saved).',
      parametersSchema: {
        type: 'object',
        properties: {
          days: { type: 'number', minimum: 1, maximum: 14 },
          mealsPerDay: { type: 'number', minimum: 3, maximum: 6 },
          name: { type: 'string' },
        },
        required: [],
        additionalProperties: false,
      },
      async execute(args: any) {
        const profile = await repositories.profile.get()
        if (!profile) return fail('No profile found. User must complete profile first.')

        const tdee = calculateTDEE(profile)
        const macros = calculateMacroTargets(profile, tdee.tdee)
        const days = Math.max(1, Math.min(14, Number(args?.days ?? 3)))
        const mealsPerDay = Math.max(3, Math.min(6, Number(args?.mealsPerDay ?? 4)))

        const today = new Date()
        const planDays = Array.from({ length: days }).map((_, idx) => {
          const d = new Date(today)
          d.setDate(today.getDate() + idx)
          const date = d.toISOString().split('T')[0]

          const mealLabels = ['Breakfast', 'Lunch', 'Dinner', 'Snacks', 'Snack 2', 'Snack 3']
          const meals = Array.from({ length: mealsPerDay }).map((__, mi) => {
            const label = mealLabels[mi] || `Meal ${mi + 1}`
            const targetCalories = macros.calories / mealsPerDay
            return {
              id: crypto.randomUUID(),
              label,
              foods: [],
              calories: 0,
              proteinG: 0,
              carbsG: 0,
              fatG: 0,
              // keep place for future
              _targetCalories: Math.round(targetCalories),
            }
          })

          return {
            id: crypto.randomUUID(),
            date,
            meals: meals as any,
            totals: { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
          }
        })

        const mealPlan: MealPlan = {
          id: crypto.randomUUID(),
          name: typeof args?.name === 'string' && args.name.trim() ? args.name.trim() : 'AI Meal Plan Draft',
          startDate: planDays[0].date,
          endDate: planDays[planDays.length - 1].date,
          days: planDays as any,
          generationType: 'offline_basic',
          constraintsSnapshot: {
            calories: macros.calories,
            proteinG: macros.proteinG,
            carbsG: macros.carbsG,
            fatG: macros.fatG,
            mealsPerDay,
          },
          notes: 'Draft created by assistant tool. Add foods per meal to complete it.',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }

        return ok('Meal plan draft created. Ask user to confirm saving.', { mealPlan })
      },
    },
  ]
}

export function toolSpecsToOpenAITools(specs: ToolSpec[]): AIProxyTool[] {
  return specs.map((spec) => ({
    type: 'function' as const,
    function: {
      name: spec.name,
      description: spec.description,
      parameters: spec.parametersSchema,
    },
  }))
}

export function findToolSpec(name: string, specs: ToolSpec[]) {
  return specs.find((s) => s.name === name)
}
