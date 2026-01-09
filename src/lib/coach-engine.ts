import type { Profile, WorkoutPlan, MacroTargets, ExerciseSet, ExerciseDBItem } from '../types';
import { ActivityLevel, GoalType, ExperienceLevel } from '../types';
import { ExerciseDBService } from './exercise-db';
import { db } from '@/db';

type ExerciseSubstitution = {
  originalExerciseId: string;
  newExerciseId: string;
  timestamp: number;
};

// Track substitutions to avoid cycling back to the same exercises
const exerciseSubstitutionHistory: Record<string, ExerciseSubstitution[]> = {};

// Body part mapping: general focus -> specific muscles in the exercise DB
const BODY_PART_MAPPINGS = {
  'chest': ['pectorals', 'chest'],
  'shoulders': ['shoulders', 'deltoids'],
  'triceps': ['triceps'],
  'biceps': ['biceps'],
  'forearms': ['forearms'],
  'back': ['lats', 'latissimus dorsi', 'traps', 'trapezius', 'lower back', 'spine'],
  'legs': ['quadriceps', 'quads', 'hamstrings', 'glutes', 'calves', 'adductors', 'abductors'],
  'core': ['abdominals', 'abs', 'obliques'],
  'cardio': [], // Special case, no specific muscles
  'full body': [] // Special case, all exercises
} as const;

type BodyPartFocus = keyof typeof BODY_PART_MAPPINGS;

// Workout splits based on days per week
function getWorkoutSplitType(totalDays: number): 'full-body' | 'upper-lower' | 'push-pull-legs' {
  if (totalDays <= 3) return 'full-body';
  if (totalDays <= 4) return 'upper-lower';
  return 'push-pull-legs';
}

// Get body part focus for a given day index
function getDayBodyPartFocus(dayIndex: number, totalDays: number): BodyPartFocus[] {
  const splitType = getWorkoutSplitType(totalDays);
  
  if (splitType === 'full-body') {
    return ['full body'];
  }
  
  if (splitType === 'upper-lower') {
    return dayIndex % 2 === 0 ? ['chest', 'shoulders', 'triceps', 'back', 'biceps'] : ['legs', 'core'];
  }
  
  // Push/Pull/Legs
  const dayInCycle = dayIndex % 3;
  if (dayInCycle === 0) return ['chest', 'shoulders', 'triceps']; // Push
  if (dayInCycle === 1) return ['back', 'biceps', 'forearms']; // Pull
  return ['legs', 'core']; // Legs
}
// Calculate TDEE using Mifflin-St Jeor equation
export function calculateTDEE(profile: Profile): { bmr: number; tdee: number } {
  const { weightKg, heightCm, age, sex, activityLevel } = profile;
  
  // BMR calculation (Mifflin-St Jeor)
  let bmr: number;
  if (sex === 'male') {
    bmr = 10 * weightKg + 6.25 * heightCm - 5 * (age || 25) + 5;
  } else {
    bmr = 10 * weightKg + 6.25 * heightCm - 5 * (age || 25) - 161;
  }
  
  // Activity multipliers
  const activityMultipliers = {
    [ActivityLevel.SEDENTARY]: 1.2,
    [ActivityLevel.LIGHT]: 1.375,
    [ActivityLevel.MODERATE]: 1.55,
    [ActivityLevel.ACTIVE]: 1.725,
    [ActivityLevel.VERY_ACTIVE]: 1.9
  };
  
  const tdee = bmr * activityMultipliers[activityLevel];
  
  return { bmr, tdee };
}

// Calculate macro targets based on goals
export function calculateMacroTargets(profile: Profile, tdee: number): MacroTargets {
  const primaryGoal = profile.goals.find(g => g.isPrimary)?.type || profile.goals[0]?.type || GoalType.MAINTENANCE;
  const weightKg = profile.weightKg;
  
  // Start with base calorie calculation
  let calories = tdee;
  
  // Adjust calories based on goal
  switch (primaryGoal) {
    case GoalType.FAT_LOSS:
      calories = tdee * 0.85; // 15% deficit
      break;
    case GoalType.HYPERTROPHY:
      calories = tdee * 1.05; // 5% surplus
      break;
    case GoalType.STRENGTH:
      calories = tdee * 1.0; // Maintenance
      break;
    case GoalType.ENDURANCE:
      calories = tdee * 0.95; // Slight deficit for endurance athletes
      break;
    default:
      calories = tdee;
  }
  
  // Protein: 1.6-2.2g per kg bodyweight, higher for fat loss and strength goals
  let proteinMultiplier = 1.8;
  if (primaryGoal === GoalType.FAT_LOSS || primaryGoal === GoalType.STRENGTH) {
    proteinMultiplier = 2.2;
  }
  const proteinG = Math.round(weightKg * proteinMultiplier);
  
  // Fats: 20-30% of calories
  const fatCalories = calories * 0.25;
  const fatG = Math.round(fatCalories / 9);
  
  // Carbs: remaining calories
  const proteinCalories = proteinG * 4;
  const remainingCalories = calories - proteinCalories - fatCalories;
  const carbsG = Math.round(remainingCalories / 4);
  
  return {
    calories: Math.round(calories),
    proteinG,
    carbsG,
    fatG
  };
}

// Generate workout plan based on profile and goals
export async function generateWorkoutPlan(profile: Profile, goalId?: string): Promise<WorkoutPlan> {
  const { experienceLevel, goals, equipment, schedule } = profile;
  const selectedGoal = goals.find(g => g.id === goalId) || goals.find(g => g.isPrimary) || goals[0];
  const primaryGoal = selectedGoal?.type || GoalType.GENERAL_FITNESS;
  
  // Initialize exercise DB to ensure data is loaded
  await ExerciseDBService.initialize();
  
  // Normalize equipment names for better matching
  // Map UI equipment names to exercise database equipment names
  const EQUIPMENT_MAPPING: Record<string, string[]> = {
    'bodyweight': ['body only', 'bodyweight', 'body only'],
    'barbell': ['barbell'],
    'dumbbells': ['dumbbell', 'dumbbells'],
    'kettlebells': ['kettlebells'],
    'resistance bands': ['bands', 'resistance bands'],
    'cable machine': ['cable', 'cable machine'],
    'squat rack': ['barbell', 'squat rack'], // squat rack primarily uses barbells
    'bench': ['barbell', 'bench', 'machine'] // bench can use various equipment
  };
  
  // Build list of all matching equipment names for profile selection
  // Convert everything to lowercase for consistent comparison
  const normalizedEquipment = equipment.flatMap(eq => 
    EQUIPMENT_MAPPING[eq.toLowerCase()] || [eq]
  ).map(eq => eq.toLowerCase());
  
  console.log('Profile equipment:', equipment);
  console.log('Normalized equipment:', normalizedEquipment);
  
  // Get all available exercises from the database
  const allExercises = await db.table('exercises').toArray();
  
  // Filter exercises by available equipment using normalized names
  const availableExercises = allExercises.filter((exercise: ExerciseDBItem) => 
    exercise.equipment.some((eq: string) => normalizedEquipment.includes(eq.toLowerCase()))
  );
  
  console.log(`Found ${allExercises.length} total exercises, ${availableExercises.length} match equipment`);
  
  // Determine training frequency based on schedule
  const trainingDays = Object.values(schedule).filter(Boolean).length;
  
  // Generate weekly plan
  const weeks: any[] = [];
  
  // Week 1 - track used exercises to avoid duplicates across the week
  const week1 = {
    week: 1,
    workouts: [] as any[]
  };
  
  const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  
  let workoutIndex = 0;
  const usedExerciseIds = new Set<string>();
  
  for (const day of dayNames) {
    if (schedule[day as keyof typeof schedule]) {
      const { exercises: workout, newlyUsedIds } = await generateDayWorkout(
        workoutIndex, 
        trainingDays, 
        availableExercises, 
        experienceLevel, 
        primaryGoal,
        usedExerciseIds
      );
      week1.workouts.push({
        day: day.charAt(0).toUpperCase() + day.slice(1),
        exercises: workout,
        notes: getDayNotes(primaryGoal, experienceLevel, workoutIndex, trainingDays)
      });
      
      // Track used exercises
      newlyUsedIds.forEach(id => usedExerciseIds.add(id));
      workoutIndex++;
    }
  }
  
  weeks.push(week1);
  
  // Generate 4 weeks total with progression
  for (let week = 2; week <= 4; week++) {
    const weekPlan = JSON.parse(JSON.stringify(week1));
    weekPlan.week = week;
    
    // Apply progression
    weekPlan.workouts.forEach((workout: any) => {
      workout.exercises.forEach((exercise: any) => {
        // Increase reps or add progression
        if (week % 2 === 0 && exercise.sets) {
          if (exercise.sets.reps) {
            exercise.sets.reps += Math.floor(exercise.sets.reps * 0.05);
          } else if (exercise.sets.repsRange) {
            exercise.sets.repsRange.min += Math.floor(exercise.sets.repsRange.min * 0.05);
            exercise.sets.repsRange.max += Math.floor(exercise.sets.repsRange.max * 0.05);
          }
        }
      });
    });
    
    weeks.push(weekPlan);
  }
  
  return {
    id: crypto.randomUUID(),
    name: generatePlanName(primaryGoal, experienceLevel),
    weeks,
    generatedBy: 'coach' as const,
    notes: generatePlanNotes(primaryGoal, experienceLevel),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

// Deterministically sort exercises for consistent selection
function sortExercisesDeterministically(exercises: ExerciseDBItem[]): ExerciseDBItem[] {
  return [...exercises].sort((a, b) => {
    // Primary sort: compound exercises first
    const aCompound = (a.mechanicsType === 'compound' ? 1 : 0);
    const bCompound = (b.mechanicsType === 'compound' ? 1 : 0);
    if (aCompound !== bCompound) return bCompound - aCompound;
    
    // Secondary sort: by name for consistency
    return a.name.localeCompare(b.name);
  });
}

// Get exercises matching body part focus with cascading fallbacks
function getExercisesForBodyPart(
  bodyParts: BodyPartFocus[],
  availableExercises: ExerciseDBItem[],
  usedExerciseIds: Set<string> = new Set()
): ExerciseDBItem[] {
  // Try exact muscle matching first
  let candidateMuscles: string[] = [];
  for (const bodyPart of bodyParts) {
    candidateMuscles.push(...BODY_PART_MAPPINGS[bodyPart]);
  }
  
  // Filter exercises that match target muscles
  let exercises = availableExercises.filter(ex =>
    !usedExerciseIds.has(ex.id) &&
    candidateMuscles.some(muscle =>
      ex.targetMuscles.some(tm => 
        tm.toLowerCase().includes(muscle.toLowerCase()) ||
        muscle.toLowerCase().includes(tm.toLowerCase())
      )
    )
  );
  
  console.log(`Step 1 - Exact muscle match: ${exercises.length} exercises`);
  
  if (exercises.length === 0) {
    // Fallback 1: Match by bodyPart field
    exercises = availableExercises.filter(ex =>
      !usedExerciseIds.has(ex.id) &&
      candidateMuscles.some(muscle =>
        ex.bodyPart.toLowerCase().includes(muscle.toLowerCase()) ||
        muscle.toLowerCase().includes(ex.bodyPart.toLowerCase())
      )
    );
    console.log(`Step 2 - BodyPart field match: ${exercises.length} exercises`);
  }
  
  if (exercises.length === 0) {
    // Fallback 2: Match by synergist muscles
    exercises = availableExercises.filter(ex =>
      !usedExerciseIds.has(ex.id) &&
      ex.synergistMuscles.some(sm =>
        candidateMuscles.some(muscle =>
          sm.toLowerCase().includes(muscle.toLowerCase()) ||
          muscle.toLowerCase().includes(sm.toLowerCase())
        )
      )
    );
    console.log(`Step 3 - Synergist muscle match: ${exercises.length} exercises`);
  }
  
  if (exercises.length === 0) {
    // Fallback 3: Use any exercises (full body fallback)
    console.log('Step 4 - Fallback to all available exercises');
    exercises = availableExercises.filter(ex => !usedExerciseIds.has(ex.id));
  }
  
  return sortExercisesDeterministically(exercises);
}

async function generateDayWorkout(
  dayIndex: number,
  totalDays: number,
  exercises: ExerciseDBItem[],
  experienceLevel: ExperienceLevel,
  primaryGoal: GoalType,
  usedExerciseIds: Set<string> = new Set()
): Promise<{ exercises: any[]; newlyUsedIds: Set<string> }> {
  const workout: any[] = [];
  const newlyUsedIds: Set<string> = new Set();
  
  // Determine body part focus for this day
  const bodyPartFocus = getDayBodyPartFocus(dayIndex, totalDays);
  console.log(`Day ${dayIndex}: Focus on ${bodyPartFocus.join(', ')}`);
  
  // Determine target exercise count based on experience level
  const targetExerciseCount = experienceLevel === 'beginner' ? 4 : 6;
  
  // Get candidate exercises with cascading fallbacks
  const candidateExercises = getExercisesForBodyPart(bodyPartFocus, exercises, usedExerciseIds);
  
  console.log(`Found ${candidateExercises.length} candidate exercises for day ${dayIndex}`);
  
  if (candidateExercises.length === 0) {
    throw new Error(
      `No exercises available for day ${dayIndex} (focus: ${bodyPartFocus.join(', ')}) after checking all options. `
      + 'Please check equipment settings or add exercises to the database.'
    );
  }
  
  // Select exercises: prefer compound first, then isolation
  const selectedExercises: ExerciseDBItem[] = [];
  
  // Prioritize compound exercises (get up to half of target count)
  const compoundExercises = candidateExercises.filter(ex => ex.mechanicsType === 'compound');
  const compoundTarget = Math.ceil(targetExerciseCount / 2);
  const selectedCompound = compoundExercises.slice(0, compoundTarget);
  
  // Add isolation exercises for the rest
  const isolationExercises = candidateExercises.filter(ex => ex.mechanicsType === 'isolation');
  const remainingNeeded = targetExerciseCount - selectedCompound.length;
  const selectedIsolation = isolationExercises.slice(0, remainingNeeded);
  
  // If we don't have enough, fill from any remaining candidates
  const allRemaining = candidateExercises.filter(
    ex => !selectedCompound.includes(ex) && !selectedIsolation.includes(ex)
  );
  const stillNeeded = targetExerciseCount - selectedCompound.length - selectedIsolation.length;
  const selectedFillers = allRemaining.slice(0, stillNeeded);
  
  selectedExercises.push(...selectedCompound, ...selectedIsolation, ...selectedFillers);
  
  console.log(`Selected ${selectedExercises.length} exercises for day ${dayIndex}`);
  
  // Create workout entries
  selectedExercises.forEach(exercise => {
    workout.push({
      exerciseId: exercise.id,
      sets: getExerciseSets(exercise, experienceLevel, primaryGoal)
    });
    newlyUsedIds.add(exercise.id);
  });
  
  // Ensure we have at least one exercise (safety check)
  if (workout.length === 0) {
    throw new Error(`Failed to generate any exercises for day ${dayIndex}. This should not happen.`);
  }
  
  return { exercises: workout, newlyUsedIds };
}

function getExerciseSets(
  exercise: ExerciseDBItem,
  experienceLevel: ExperienceLevel,
  goal: GoalType
): ExerciseSet {
  const baseSets = experienceLevel === 'beginner' ? 3 : 4;
  const baseReps = getBaseReps(goal, exercise.mechanicsType || 'compound');
  
  const exerciseSet: ExerciseSet = {
    sets: baseSets,
    restTime: exercise.mechanicsType === 'compound' ? 90 : 60,
    notes: `Focus on proper form. ${exercise.instructions[0] || ''}`
  };
  
  // Set either reps (for single value) or repsRange (for range)
  if (typeof baseReps === 'number') {
    exerciseSet.reps = baseReps;
  } else {
    exerciseSet.repsRange = baseReps;
  }
  
  return exerciseSet;
}

function getBaseReps(primaryGoal: GoalType, category: string): number | { min: number; max: number } {
  if (category === 'compound') {
    if (primaryGoal === GoalType.STRENGTH) return { min: 3, max: 6 };
    if (primaryGoal === GoalType.HYPERTROPHY) return { min: 8, max: 12 };
    return { min: 10, max: 15 };
  } else {
    if (primaryGoal === GoalType.STRENGTH) return { min: 6, max: 10 };
    if (primaryGoal === GoalType.HYPERTROPHY) return { min: 10, max: 15 };
    return { min: 12, max: 20 };
  }
}

function generatePlanName(goal: GoalType, experienceLevel: ExperienceLevel): string {
  const goalNames = {
    [GoalType.STRENGTH]: 'Strength',
    [GoalType.HYPERTROPHY]: 'Muscle Building',
    [GoalType.FAT_LOSS]: 'Fat Loss',
    [GoalType.ENDURANCE]: 'Endurance',
    [GoalType.GENERAL_FITNESS]: 'General Fitness'
  };
  
  const levelNames = {
    [ExperienceLevel.BEGINNER]: 'Beginner',
    [ExperienceLevel.INTERMEDIATE]: 'Intermediate',
    [ExperienceLevel.ADVANCED]: 'Advanced'
  };
  
  return `${goalNames[goal]} ${levelNames[experienceLevel]} Plan`;
}

function generatePlanNotes(primaryGoal: GoalType, experienceLevel: ExperienceLevel): string {
  const tips = [];
  
  if (experienceLevel === 'beginner') {
    tips.push('Start with lighter weights to master form');
    tips.push('Focus on full range of motion');
  }
  
  if (primaryGoal === GoalType.STRENGTH) {
    tips.push('Gradually increase weight as strength improves');
    tips.push('Ensure adequate rest between sets (3-5 minutes for heavy lifts)');
  } else if (primaryGoal === GoalType.HYPERTROPHY) {
    tips.push('Focus on muscle mind connection');
    tips.push('Control the negative portion of each rep');
  }
  
  tips.push('Listen to your body and rest when needed');
  tips.push('Stay hydrated and fuel properly');
  
  return tips.join('. ');
}

function getDayNotes(_primaryGoal: GoalType, experienceLevel: ExperienceLevel, dayIndex: number, totalDays: number): string {
  const notes = [];
  const bodyPartFocus = getDayBodyPartFocus(dayIndex, totalDays);
  
  // Add focus description
  if (bodyPartFocus.includes('full body')) {
    notes.push('Full body workout - exercises for major muscle groups');
  } else if (bodyPartFocus.includes('chest') && bodyPartFocus.includes('shoulders')) {
    notes.push('Push day - chest, shoulders, triceps');
  } else if (bodyPartFocus.includes('back')) {
    notes.push('Pull day - back, biceps, rear delts');
  } else if (bodyPartFocus.includes('legs')) {
    notes.push('Leg day - quads, hamstrings, glutes, calves');
  } else {
    notes.push(`Focus on: ${bodyPartFocus.join(', ')}`);
  }
  
  if (experienceLevel === ExperienceLevel.BEGINNER && bodyPartFocus.includes('legs')) {
    notes.push('Start light with leg exercises');
  }
  
  return notes.join('. ');
}

// Substitute an exercise with a different one from the same body part/equipment
export async function substituteExercise(
  currentExerciseId: string,
  planId: string,
  equipment?: string[]
): Promise<ExerciseDBItem | null> {
  await ExerciseDBService.initialize();
  
  // Get the current exercise
  const currentExercise = await ExerciseDBService.getExerciseById(currentExerciseId);
  if (!currentExercise) {
    console.error('Current exercise not found:', currentExerciseId);
    return null;
  }
  
  // Get substitution history for this plan
  const history = exerciseSubstitutionHistory[planId] || [];
  
  // Get all exercises from the DB
  const allExercises = await db.table('exercises').toArray();
  
  // Filter for compatible exercises:
  // 1. Same body part or targets the same muscles
  // 2. Matches equipment (if specified)
  // 3. Not the current exercise
  // 4. Not recently substituted (to avoid cycling)
  const compatibleExercises = allExercises.filter((exercise: ExerciseDBItem) => {
    // Skip the same exercise
    if (exercise.id === currentExerciseId) return false;
    
    // Check if recently substituted (avoid cycling back within 10 minutes)
    const recentSubstitution = history.find((sub: ExerciseSubstitution) => sub.newExerciseId === exercise.id);
    if (recentSubstitution && Date.now() - recentSubstitution.timestamp < 600000) {
      return false;
    }
    
    // Check body part match (exact or via target muscles)
    const shareTargetMuscles = currentExercise.targetMuscles.some((m: string) => 
      exercise.targetMuscles.includes(m)
    );
    const shareBodyPart = exercise.bodyPart === currentExercise.bodyPart;
    
    if (!shareBodyPart && !shareTargetMuscles) {
      return false;
    }
    
    // Check equipment match (if specified)
    if (equipment && equipment.length > 0) {
      const hasRequiredEquipment = exercise.equipment.some((eq: string) => equipment.includes(eq));
      if (!hasRequiredEquipment) return false;
    }
    
    // Prefer similar mechanics type
    if (exercise.mechanicsType !== currentExercise.mechanicsType) {
      // Allow different mechanics type but prioritize same type later
      return true;
    }
    
    return true;
  });
  
  if (compatibleExercises.length === 0) {
    console.warn(' no compatible exercises found for substitution');
    return null;
  }
  
  // Sort deterministically and pick the first
  const sorted = sortExercisesDeterministically(compatibleExercises as ExerciseDBItem[]);
  const newExercise = sorted[0] as ExerciseDBItem;
  
  if (!newExercise) {
    console.warn('No exercises found after shuffling');
    return null;
  }
  
  // Record substitution
  const substitution: ExerciseSubstitution = {
    originalExerciseId: currentExerciseId,
    newExerciseId: newExercise.id,
    timestamp: Date.now()
  };
  
  if (!exerciseSubstitutionHistory[planId]) {
    exerciseSubstitutionHistory[planId] = [];
  }
  
  // Clean up old substitutions (older than 1 hour)
  exerciseSubstitutionHistory[planId] = exerciseSubstitutionHistory[planId].filter(
    sub => Date.now() - sub.timestamp < 3600000
  );
  
  exerciseSubstitutionHistory[planId].push(substitution);
  
  console.log(`Substituted ${currentExercise.name} with ${newExercise.name}`);
  
  return newExercise;
}