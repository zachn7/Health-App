import { calculateMacroTargets, calculateTDEE, generateWorkoutPlan } from '@/lib/coach-engine'
import type { AssistantProvider, AssistantRequest, AssistantResponse, PlanGenerationResult } from '@/ai/types'
import type { MealPlan, MealPlanDay, MealPlanMeal, MealPlanFood, MealTemplate } from '@/types'
import { buildProfileConstraintSummary, filterFoodsForProfile } from '@/lib/profile-constraints'

function makeAction(
  type: 'accept_workout_plan' | 'accept_meal_plan' | 'log_weight' | 'log_workout' | 'log_meal' | 'open_page',
  label: string,
  description: string,
  payload?: Record<string, unknown>,
) {
  return {
    id: crypto.randomUUID(),
    type,
    label,
    description,
    payload,
  }
}

function inferIntent(message: string): AssistantResponse['intent'] {
  const normalized = message.toLowerCase()
  const isProgressAnalysis = (
    normalized.includes('trend')
    || normalized.includes('progress')
    || normalized.includes('analy')
    || normalized.includes('summary')
    || normalized.includes('stats')
    || normalized.includes('what should i adjust')
    || normalized.includes('what should i do next')
  ) && (
    normalized.includes('weight')
    || normalized.includes('workout')
    || normalized.includes('nutrition')
    || normalized.includes('calories')
    || normalized.includes('protein')
    || normalized.includes('progress')
    || normalized.includes('trend')
    || normalized.includes('stats')
  )

  if (normalized.includes('stretch') || normalized.includes('tight') || normalized.includes('mobility')) return 'mobility'
  if (normalized.includes('form') || normalized.includes('how do i do') || normalized.includes('how should i do')) return 'workout_form'
  if (isProgressAnalysis) return 'progress_analysis'
  if (normalized.includes('meal') || normalized.includes('eat') || normalized.includes('nutrition')) return 'meal_plan'
  if (normalized.includes('log') || normalized.includes('track') || normalized.includes('record')) return 'logging'
  if (normalized.includes('accept') || normalized.includes('approve') || normalized.includes('review')) return 'plan_review'
  if (normalized.includes('workout') || normalized.includes('plan')) return 'workout_plan'
  return 'general_coaching'
}

function buildMealFoodsFromTemplate(template: MealTemplate, targetMealCalories: number): MealPlanFood[] {
  const templateCalories = template.items.reduce((sum, item) => sum + item.calories, 0) || 1
  const scale = Math.max(0.75, Math.min(1.5, targetMealCalories / templateCalories))

  return template.items.map((item) => ({
    id: crypto.randomUUID(),
    name: item.name,
    servingSize: item.servingSize,
    quantidade: Number((item.quantidade * scale).toFixed(2)),
    calories: Math.round(item.calories * scale),
    proteinG: Number((item.proteinG * scale).toFixed(1)),
    carbsG: Number((item.carbsG * scale).toFixed(1)),
    fatG: Number((item.fatG * scale).toFixed(1)),
    baseUnit: item.baseUnit,
    servingGrams: item.servingGrams,
    computedTotalGrams: Number((item.computedTotalGrams * scale).toFixed(1)),
    fdcId: item.fdcId,
  }))
}

function buildMealPlanFromTemplates(context: AssistantRequest['context'], templates: MealTemplate[]): MealPlan {
  const tdee = calculateTDEE(context.profile)
  const macros = calculateMacroTargets(context.profile, tdee.tdee)
  const today = new Date()
  const dayCount = 3
  const mealsPerDay = Math.max(3, Math.min(5, context.preferenceSignals.preferredMealLabels.length || 3))
  const mealLabels = context.preferenceSignals.preferredMealLabels.length > 0
    ? context.preferenceSignals.preferredMealLabels
    : ['Breakfast', 'Lunch', 'Dinner', 'Snacks']

  const days: MealPlanDay[] = []
  const safeTemplates = templates.length > 0 ? templates : []

  for (let dayIndex = 0; dayIndex < dayCount; dayIndex++) {
    const currentDate = new Date(today)
    currentDate.setDate(today.getDate() + dayIndex)
    const date = currentDate.toISOString().split('T')[0]
    const targetMealCalories = macros.calories / mealsPerDay

    const meals: MealPlanMeal[] = Array.from({ length: mealsPerDay }).map((_, mealIndex) => {
      const label = mealLabels[mealIndex] || `Meal ${mealIndex + 1}`
      const template = safeTemplates[mealIndex % Math.max(safeTemplates.length, 1)]
      const foods = template
        ? filterFoodsForProfile(buildMealFoodsFromTemplate(template, targetMealCalories), context.profile)
        : [
            {
              id: crypto.randomUUID(),
              name: `${label} protein + carb base`,
              servingSize: '1 serving',
              quantidade: 1,
              calories: Math.round(targetMealCalories),
              proteinG: Math.round(macros.proteinG / mealsPerDay),
              carbsG: Math.round(macros.carbsG / mealsPerDay),
              fatG: Math.round(macros.fatG / mealsPerDay),
              baseUnit: 'serving',
              servingGrams: 250,
              computedTotalGrams: 250,
            },
          ] as MealPlanFood[]

      const totals = foods.reduce(
        (sum, food) => ({
          calories: sum.calories + food.calories,
          proteinG: sum.proteinG + food.proteinG,
          carbsG: sum.carbsG + food.carbsG,
          fatG: sum.fatG + food.fatG,
        }),
        { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
      )

      return {
        id: crypto.randomUUID(),
        label,
        mealId: template?.id,
        inlineMealSnapshot: foods,
        foods,
        ...totals,
      }
    })

    const totals = meals.reduce(
      (sum, meal) => ({
        calories: sum.calories + meal.calories,
        proteinG: sum.proteinG + meal.proteinG,
        carbsG: sum.carbsG + meal.carbsG,
        fatG: sum.fatG + meal.fatG,
      }),
      { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
    )

    days.push({
      id: crypto.randomUUID(),
      date,
      meals,
      totals,
    })
  }

  return {
    id: crypto.randomUUID(),
    name: `${context.profile.goals[0]?.type?.replace('_', ' ') || 'balanced'} meal plan`,
    startDate: days[0].date,
    endDate: days[days.length - 1].date,
    days,
    generationType: 'offline_basic',
    constraintsSnapshot: {
      calories: macros.calories,
      proteinG: macros.proteinG,
      carbsG: macros.carbsG,
      fatG: macros.fatG,
      mealsPerDay,
      dietaryPreferences: context.preferenceSignals.dietaryRestrictions,
      movementLimitations: context.preferenceSignals.movementLimitations,
    },
    notes: 'Deterministic meal plan scaffold based on saved meals, calorie targets, and recent adherence patterns.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

function buildFormGuidance(message: string): string {
  const normalized = message.toLowerCase()
  if (normalized.includes('squat')) {
    return 'For squats: brace first, keep your whole foot planted, let knees track over toes, sit between the hips, and keep the bar/path stacked over mid-foot. Start lighter than your ego wants. Your ego is not a certified coach.'
  }
  if (normalized.includes('deadlift')) {
    return 'For deadlifts: create tension before the bar leaves the floor, keep the bar close, push the floor away, and lock out with glutes rather than leaning back. If you feel your lower back doing all the drama, reduce the load and reset your setup.'
  }
  if (normalized.includes('bench')) {
    return 'For bench press: set your upper back first, keep wrists stacked over elbows, lower with control, and drive feet into the floor. Touch low enough to keep forearms close to vertical.'
  }

  return 'For exercise form: use a controlled tempo, keep joints stacked, prioritize full pain-free range of motion, and stop the set when technique degrades. If you want, ask me about a specific lift and I can get less generic and more useful.'
}

function buildProgressAnalysis(context: AssistantRequest['context']): { message: string; actions: ReturnType<typeof makeAction>[] } {
  const { preferenceSignals, progressSignals } = context
  const consistencyPercent = (preferenceSignals.consistencyScore * 100).toFixed(0)
  const trendDirection = progressSignals.trendDirection || 'not established yet'
  const workoutsPerWeek = progressSignals.workoutsPerWeek.toFixed(1)
  const calories = progressSignals.averageCaloriesLast14 === null
    ? 'not enough calorie data yet'
    : `${Math.round(progressSignals.averageCaloriesLast14)} kcal/day`
  const protein = progressSignals.averageProteinLast14 === null
    ? 'not enough protein data yet'
    : `${Math.round(progressSignals.averageProteinLast14)} g/day`

  const observations = [
    `Consistency score: ${consistencyPercent}%.`,
    `Workout frequency: ${workoutsPerWeek} sessions/week.`,
    `Weight trend: ${trendDirection}.`,
    `Average calories: ${calories}.`,
    `Average protein: ${protein}.`,
  ]

  const nextStep = progressSignals.workoutsPerWeek < 2
    ? 'Biggest lever: tighten workout consistency first. Even two repeatable sessions per week will beat a theoretical perfect plan you never run.'
    : progressSignals.averageProteinLast14 !== null && progressSignals.averageProteinLast14 < Math.max(90, context.profile.weightKg * 1.4)
      ? 'Biggest lever: bring protein up more consistently so recovery and body-composition progress stop relying on wishful thinking.'
      : progressSignals.averageCaloriesLast14 === null
        ? 'Biggest lever: log nutrition more consistently for a week so the app can stop coaching off vibes and start coaching off data.'
        : 'Biggest lever: keep the boring basics stable—training frequency, protein intake, and recovery—then adjust plan details only after the trend actually earns it.'

  return {
    message: `${observations.join(' ')} ${nextStep}`,
    actions: [
      makeAction('open_page', 'Open Progress', 'Review your weight trend and workout stats in Progress.', { path: '/progress' }),
      makeAction('log_weight', 'Log weight', 'Add a new bodyweight entry.', { path: '/progress' }),
      makeAction('log_workout', 'Log workout', 'Open the workout logger to improve adherence.', { path: '/log/workout' }),
    ],
  }
}

function buildMobilityGuidance(message: string): string {
  const normalized = message.toLowerCase()
  if (normalized.includes('hip')) {
    return 'For tight hips: try 90/90 switches, couch stretch, hip flexor stretch with glute squeeze, and deep goblet squat holds. Pair mobility with strength in the new range so it actually sticks.'
  }
  if (normalized.includes('hamstring')) {
    return 'For hamstring tightness: use lying hamstring flossing, Romanian deadlift eccentrics, and gentle hinge patterning. Stretching helps, but loaded lengthening usually helps more.'
  }
  if (normalized.includes('shoulder') || normalized.includes('pec')) {
    return 'For shoulder/pec tightness: try doorway pec stretch, thoracic extensions over a bench or foam roller, wall slides, and controlled Y/T raises. If pinchy pain shows up, back off and get assessed.'
  }

  return 'A good mobility block usually combines tissue tolerance, controlled end-range work, and some strength through the new range. Tell me the exact tight area and I’ll tailor it better.'
}

export class DeterministicAssistantProvider implements AssistantProvider {
  id: AssistantProvider['id'] = 'deterministic'

  constructor(private readonly getMealTemplates: () => Promise<MealTemplate[]>) {}

  async isAvailable(): Promise<boolean> {
    return true
  }

  async sendMessage(request: AssistantRequest): Promise<AssistantResponse> {
    const intent = inferIntent(request.message)

    if (intent === 'workout_form') {
      return {
        provider: this.id,
        intent,
        message: buildFormGuidance(request.message),
        actions: [makeAction('open_page', 'Open workout logger', 'Go log or review the lift in the workout logger.', { path: '/log/workout' })],
      }
    }

    if (intent === 'mobility') {
      return {
        provider: this.id,
        intent,
        message: buildMobilityGuidance(request.message),
      }
    }

    if (intent === 'progress_analysis') {
      const analysis = buildProgressAnalysis(request.context)
      return {
        provider: this.id,
        intent,
        message: analysis.message,
        actions: analysis.actions,
      }
    }

    if (intent === 'meal_plan') {
      const result = await this.generateMealPlan(request.context)
      return {
        provider: this.id,
        intent,
        message: `${result.rationale}\n\nI drafted a meal plan scaffold you can review and accept.` ,
        suggestedMealPlan: result.mealPlan,
        actions: result.actions,
      }
    }

    if (intent === 'workout_plan' || intent === 'plan_review') {
      const result = await this.generateWorkoutPlan(request.context)
      return {
        provider: this.id,
        intent,
        message: `${result.rationale}\n\nI drafted a workout plan you can review and accept.` ,
        suggestedWorkoutPlan: result.workoutPlan,
        actions: result.actions,
      }
    }

    if (intent === 'logging') {
      return {
        provider: this.id,
        intent,
        message: 'I can help you decide what to log and where. Right now the app can save weight, workouts, and meals using the normal flows; next step is wiring direct assistant-triggered logging actions. Baby steps, not reckless wizardry.',
        actions: [
          makeAction('log_weight', 'Log weight', 'Open Progress to log bodyweight.', { path: '/progress' }),
          makeAction('log_workout', 'Log workout', 'Open the workout logger.', { path: '/log/workout' }),
          makeAction('log_meal', 'Log meal', 'Open Nutrition to log meals.', { path: '/nutrition' }),
        ],
      }
    }

    return {
      provider: this.id,
      intent,
      message: `Here’s the useful summary: your consistency score is ${(request.context.preferenceSignals.consistencyScore * 100).toFixed(0)}%, recent workout frequency is ${request.context.progressSignals.workoutsPerWeek.toFixed(1)} per week, and your weight trend is ${request.context.progressSignals.trendDirection || 'not established yet'}. Ask me for a workout plan, meal plan, form cue, or mobility suggestion and I can be more specific instead of philosophizing at you.`,
    }
  }

  async generateWorkoutPlan(context: AssistantRequest['context']): Promise<PlanGenerationResult> {
    const selectedGoalId = context.profile.goals.find((goal) => goal.isPrimary)?.id || context.profile.goals[0]?.id
    const workoutPlan = await generateWorkoutPlan(context.profile, selectedGoalId)

    return {
      provider: this.id,
      rationale: `Built from your profile, available equipment, goal priority, recent consistency (${(context.preferenceSignals.consistencyScore * 100).toFixed(0)}%), preferred workout days: ${context.preferenceSignals.preferredWorkoutDays.join(', ') || 'not enough data yet'}, and constraints: ${buildProfileConstraintSummary(context.profile)}.`,
      workoutPlan,
      actions: [
        makeAction('accept_workout_plan', 'Accept workout plan', 'Save this workout plan to My Programs.', { planId: workoutPlan.id }),
        makeAction('open_page', 'Review workouts', 'Open the workouts page to inspect or edit the draft.', { path: '/workouts' }),
      ],
    }
  }

  async generateMealPlan(context: AssistantRequest['context']): Promise<PlanGenerationResult> {
    const templates = await this.getMealTemplates()
    const mealPlan = buildMealPlanFromTemplates(context, templates)

    return {
      provider: this.id,
      rationale: `Built from your calorie and macro targets, saved meals, recent nutrition logging, preferred meal groups: ${context.preferenceSignals.preferredMealLabels.join(', ') || 'not enough data yet'}, and nutrition constraints: ${buildProfileConstraintSummary(context.profile)}.`,
      mealPlan,
      actions: [
        makeAction('accept_meal_plan', 'Accept meal plan', 'Save this meal plan to your library.', { planId: mealPlan.id }),
        makeAction('open_page', 'Review meals', 'Open Meals to inspect or refine saved meals.', { path: '/meals' }),
      ],
    }
  }
}
