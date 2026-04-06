import { z } from 'zod'
import type { ExerciseSet, WorkoutPlan } from '@/types'
import { WorkoutPlanSchema, safeJSONParse } from '@/lib/schemas'

const WebLLMExerciseSetSchema = z.object({
  sets: z.number().int().min(1).max(6),
  reps: z.number().int().min(1).max(30).optional(),
  repsRange: z.object({ min: z.number().int().min(1).max(30), max: z.number().int().min(1).max(30) }).optional(),
  restTime: z.number().int().min(15).max(300).optional(),
  notes: z.string().max(300).optional(),
}).refine((value) => !!value.reps || !!value.repsRange, 'Either reps or repsRange is required')

const WebLLMWorkoutExerciseSchema = z.object({
  exerciseId: z.string().min(1),
  sets: WebLLMExerciseSetSchema,
})

const WebLLMWorkoutDaySchema = z.object({
  day: z.string().min(1).max(50),
  notes: z.string().max(500).optional(),
  exercises: z.array(WebLLMWorkoutExerciseSchema).min(1).max(8),
})

const WebLLMWorkoutPlanResponseSchema = z.object({
  name: z.string().min(3).max(100),
  notes: z.string().max(2000).optional(),
  workouts: z.array(WebLLMWorkoutDaySchema).min(1).max(7),
})

export type WebLLMWorkoutPlanResponse = z.infer<typeof WebLLMWorkoutPlanResponseSchema>

export function extractJSONObject(text: string): string | null {
  const fencedMatch = text.match(/```json\s*([\s\S]*?)```/i)
  if (fencedMatch?.[1]) return fencedMatch[1].trim()

  const objectMatch = text.match(/\{[\s\S]*\}/)
  return objectMatch?.[0] ?? null
}

export function parseWebLLMWorkoutPlanResponse(text: string): WebLLMWorkoutPlanResponse | null {
  const json = extractJSONObject(text)
  if (!json) return null

  const parsed = safeJSONParse(json, WebLLMWorkoutPlanResponseSchema, 'WebLLM structured workout response')
  return parsed.success ? parsed.data ?? null : null
}

function sanitizeExerciseSet(sets: ExerciseSet): ExerciseSet {
  return {
    sets: Math.max(1, Math.min(6, sets.sets)),
    reps: sets.reps,
    repsRange: sets.repsRange,
    restTime: sets.restTime,
    notes: sets.notes,
  }
}

export function mergeWorkoutPlanDraft(basePlan: WorkoutPlan, aiDraft: WebLLMWorkoutPlanResponse): WorkoutPlan {
  const baseWeek = basePlan.weeks[0]
  const mergedWorkouts = baseWeek.workouts.map((baseWorkout, index) => {
    const aiWorkout = aiDraft.workouts[index]
    if (!aiWorkout) return baseWorkout

    const allowedExerciseIds = new Set(baseWorkout.exercises.map((exercise) => exercise.exerciseId))
    const mergedExercises = aiWorkout.exercises
      .filter((exercise) => allowedExerciseIds.has(exercise.exerciseId))
      .map((exercise) => ({
        exerciseId: exercise.exerciseId,
        sets: sanitizeExerciseSet(exercise.sets),
      }))

    return {
      day: aiWorkout.day || baseWorkout.day,
      notes: aiWorkout.notes || baseWorkout.notes,
      exercises: mergedExercises.length > 0 ? mergedExercises : baseWorkout.exercises,
    }
  })

  const candidate: WorkoutPlan = {
    ...basePlan,
    name: aiDraft.name || basePlan.name,
    notes: aiDraft.notes || basePlan.notes,
    weeks: [
      {
        ...baseWeek,
        workouts: mergedWorkouts,
      },
      ...basePlan.weeks.slice(1),
    ],
    updatedAt: new Date().toISOString(),
  }

  const validation = WorkoutPlanSchema.safeParse(candidate)
  return validation.success ? candidate : basePlan
}
