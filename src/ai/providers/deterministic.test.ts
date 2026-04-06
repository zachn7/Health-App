import { describe, expect, it } from 'vitest'
import { DeterministicAssistantProvider } from './deterministic'
import type { AssistantRequest } from '../types'

function makeRequest(message: string): AssistantRequest {
  const now = new Date().toISOString()

  return {
    message,
    context: {
      profile: {
        id: 'profile-1',
        age: 30,
        sex: 'female',
        heightCm: 168,
        weightKg: 70,
        preferredUnits: 'metric',
        activityLevel: 'moderate',
        experienceLevel: 'intermediate',
        goals: [
          {
            id: 'goal-1',
            type: 'general_fitness',
            priority: 1,
            isPrimary: true,
            targetDate: '',
            createdAt: now,
            updatedAt: now,
          },
        ],
        equipment: ['bodyweight', 'dumbbell'],
        schedule: {
          monday: true,
          tuesday: false,
          wednesday: true,
          thursday: false,
          friday: true,
          saturday: false,
          sunday: false,
        },
        limitations: '',
        dietaryRestrictions: '',
        macroSplit: {
          protein: 30,
          carbs: 40,
          fat: 30,
        },
        createdAt: now,
        updatedAt: now,
      },
      preferenceSignals: {
        preferredWorkoutDays: ['monday', 'wednesday', 'friday'],
        preferredMealLabels: ['Breakfast', 'Lunch', 'Dinner'],
        dietaryRestrictions: [],
        movementLimitations: [],
        consistencyScore: 0.6,
        loggedWorkoutDaysLast30: 9,
        loggedNutritionDaysLast14: 6,
      },
      progressSignals: {
        trendWeightKg: 69.8,
        scaleWeightKg: 70,
        trendDirection: 'down',
        averageCaloriesLast14: 2150,
        averageProteinLast14: 95,
        workoutsPerWeek: 2.1,
      },
      latestWorkoutPlan: null,
      latestMealPlan: null,
    },
  }
}

describe('DeterministicAssistantProvider', () => {
  it('routes trend/stat analysis prompts to progress_analysis instead of meal_plan', async () => {
    const provider = new DeterministicAssistantProvider(async () => [])

    const response = await provider.sendMessage(
      makeRequest('Analyze my recent weight, workout, and nutrition trends and tell me the most important thing to adjust next.'),
    )

    expect(response.intent).toBe('progress_analysis')
    expect(response.message).toContain('Consistency score:')
    expect(response.message).toContain('Biggest lever:')
    expect(response.suggestedMealPlan).toBeUndefined()
    expect(response.actions?.some((action) => action.label === 'Open Progress')).toBe(true)
  })
})
