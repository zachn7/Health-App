import { repositories } from '@/db'
import type { NutritionLog, Profile, WorkoutLog } from '@/types'
import type { UserContextSnapshot, UserPreferenceSignals, UserProgressSignals } from './types'
import { summarizeWeightTrend } from '@/lib/weight-trends'
import { getDietaryRestrictions, getMovementLimitations } from '@/lib/profile-constraints'

const WORKOUT_LOOKBACK_DAYS = 30
const NUTRITION_LOOKBACK_DAYS = 14

function average(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function getRecentDateCutoff(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString().split('T')[0]
}

function collectPreferredMealLabels(logs: NutritionLog[]): string[] {
  const counts = new Map<string, number>()

  for (const log of logs) {
    for (const item of log.items ?? []) {
      const label = item.mealGroup || 'Uncategorized'
      counts.set(label, (counts.get(label) || 0) + 1)
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([label]) => label)
}

function collectPreferredWorkoutDays(logs: WorkoutLog[]): string[] {
  const counts = new Map<string, number>()

  for (const log of logs) {
    const dayLabel = new Date(`${log.date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
    counts.set(dayLabel, (counts.get(dayLabel) || 0) + 1)
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([label]) => label)
}

function buildPreferenceSignals(workouts: WorkoutLog[], nutritionLogs: NutritionLog[]): UserPreferenceSignals {
  const loggedWorkoutDaysLast30 = workouts.length
  const loggedNutritionDaysLast14 = nutritionLogs.length
  const consistencyScore = Math.min(
    1,
    ((loggedWorkoutDaysLast30 / WORKOUT_LOOKBACK_DAYS) * 3 + (loggedNutritionDaysLast14 / NUTRITION_LOOKBACK_DAYS) * 2) / 5,
  )

  return {
    preferredWorkoutDays: collectPreferredWorkoutDays(workouts),
    preferredMealLabels: collectPreferredMealLabels(nutritionLogs),
    dietaryRestrictions: [],
    movementLimitations: [],
    consistencyScore,
    loggedWorkoutDaysLast30,
    loggedNutritionDaysLast14,
  }
}

function buildProgressSignals(weightLogs: { date: string; weightKg: number }[], nutritionLogs: NutritionLog[], workouts: WorkoutLog[]): UserProgressSignals {
  const weightTrend = summarizeWeightTrend(weightLogs as any, 7)
  const calories = nutritionLogs.map((log) => log.totals.calories)
  const protein = nutritionLogs.map((log) => log.totals.proteinG)

  return {
    trendWeightKg: weightTrend.currentTrendWeightKg,
    scaleWeightKg: weightTrend.currentScaleWeightKg,
    trendDirection: weightTrend.trend,
    averageCaloriesLast14: average(calories),
    averageProteinLast14: average(protein),
    workoutsPerWeek: workouts.length / (WORKOUT_LOOKBACK_DAYS / 7),
  }
}

export async function buildUserContextSnapshot(profile: Profile): Promise<UserContextSnapshot> {
  const workoutCutoff = getRecentDateCutoff(WORKOUT_LOOKBACK_DAYS)
  const nutritionCutoff = getRecentDateCutoff(NUTRITION_LOOKBACK_DAYS)

  const [
    workoutLogs,
    nutritionLogs,
    weightLogs,
    workoutPlans,
    mealPlans,
  ] = await Promise.all([
    repositories.workout.getWorkoutLogs(),
    repositories.nutrition.getNutritionLogs(),
    repositories.progress.getWeightLogs(),
    repositories.workout.getWorkoutPlans(),
    repositories.nutrition.getMealPlans(),
  ])

  const recentWorkoutLogs = workoutLogs.filter((log) => log.date >= workoutCutoff)
  const recentNutritionLogs = nutritionLogs.filter((log) => log.date >= nutritionCutoff)

  const preferenceSignals = buildPreferenceSignals(recentWorkoutLogs, recentNutritionLogs)

  return {
    profile,
    preferenceSignals: {
      ...preferenceSignals,
      dietaryRestrictions: getDietaryRestrictions(profile),
      movementLimitations: getMovementLimitations(profile),
    },
    progressSignals: buildProgressSignals(weightLogs, recentNutritionLogs, recentWorkoutLogs),
    latestWorkoutPlan: workoutPlans[0] || null,
    latestMealPlan: mealPlans[0] || null,
  }
}
