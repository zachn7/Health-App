import type { MealPlan, Profile, WorkoutPlan } from '@/types'

export type AIProviderId = 'deterministic' | 'webllm' | 'openrouter'

export type AssistantIntent =
  | 'workout_form'
  | 'mobility'
  | 'workout_plan'
  | 'meal_plan'
  | 'logging'
  | 'plan_review'
  | 'general_coaching'

export interface UserPreferenceSignals {
  preferredWorkoutDays: string[]
  preferredMealLabels: string[]
  consistencyScore: number
  loggedWorkoutDaysLast30: number
  loggedNutritionDaysLast14: number
}

export interface UserProgressSignals {
  trendWeightKg: number | null
  scaleWeightKg: number | null
  trendDirection: 'up' | 'down' | 'stable' | null
  averageCaloriesLast14: number | null
  averageProteinLast14: number | null
  workoutsPerWeek: number
}

export interface UserContextSnapshot {
  profile: Profile
  preferenceSignals: UserPreferenceSignals
  progressSignals: UserProgressSignals
  latestWorkoutPlan?: WorkoutPlan | null
  latestMealPlan?: MealPlan | null
}

export interface AssistantActionSuggestion {
  id: string
  type: 'accept_workout_plan' | 'accept_meal_plan' | 'log_weight' | 'log_workout' | 'log_meal' | 'open_page'
  label: string
  description: string
  payload?: Record<string, unknown>
}

export interface AssistantResponse {
  provider: AIProviderId
  intent: AssistantIntent
  message: string
  suggestedWorkoutPlan?: WorkoutPlan
  suggestedMealPlan?: MealPlan
  actions?: AssistantActionSuggestion[]
}

export interface AssistantRequest {
  message: string
  context: UserContextSnapshot
}

export interface PlanGenerationResult {
  provider: AIProviderId
  rationale: string
  workoutPlan?: WorkoutPlan
  mealPlan?: MealPlan
  actions?: AssistantActionSuggestion[]
}

export interface AssistantProvider {
  id: AIProviderId
  isAvailable(): Promise<boolean>
  sendMessage(request: AssistantRequest): Promise<AssistantResponse>
  generateWorkoutPlan(context: UserContextSnapshot): Promise<PlanGenerationResult>
  generateMealPlan(context: UserContextSnapshot): Promise<PlanGenerationResult>
}
