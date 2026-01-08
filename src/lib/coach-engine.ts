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
  
  // Get all available exercises from the database
  const allExercises = await db.table('exercises').toArray();
  
  // Filter exercises by available equipment
  const availableExercises = allExercises.filter((exercise: ExerciseDBItem) => 
    exercise.equipment.some((eq: string) => equipment.includes(eq))
  );
  
  console.log(`Found ${allExercises.length} total exercises, ${availableExercises.length} match equipment`);
  
  // Determine training frequency based on schedule
  const trainingDays = Object.values(schedule).filter(Boolean).length;
  
  // Generate weekly plan
  const weeks: any[] = [];
  
  // Week 1
  const week1 = {
    week: 1,
    workouts: [] as any[]
  };
  
  const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  
  let workoutIndex = 0;
  for (const day of dayNames) {
    if (schedule[day as keyof typeof schedule]) {
      const workout = await generateDayWorkout(
        workoutIndex, 
        trainingDays, 
        availableExercises, 
        experienceLevel, 
        primaryGoal
      );
      week1.workouts.push({
        day: day.charAt(0).toUpperCase() + day.slice(1),
        exercises: workout,
        notes: getDayNotes(primaryGoal, experienceLevel, workoutIndex)
      });
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

// Shuffle array for randomness
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

async function generateDayWorkout(
  dayIndex: number,
  totalDays: number,
  exercises: ExerciseDBItem[],
  experienceLevel: ExperienceLevel,
  primaryGoal: GoalType
): Promise<any[]> {
  const workout: any[] = [];
  
  // Determine body part focus based on day
  const bodyPartDay = dayIndex % getWorkoutSplit(totalDays);
  const targetBodyParts = getTargetBodyParts(bodyPartDay);
  
  console.log(`Day ${dayIndex}: Body part day ${bodyPartDay}, targets: ${targetBodyParts.join(', ')}`);
  
  // Filter exercises by target body parts
  let targetExercises = exercises.filter(ex => 
    targetBodyParts.includes(ex.bodyPart) ||
    ex.targetMuscles.some(m => targetBodyParts.includes(m))
  );
  
  console.log(`Found ${targetExercises.length} exercises matching target body parts`);
  
  // Prioritize compound exercises
  const compoundExercises = shuffleArray(
    targetExercises.filter(ex => ex.mechanicsType === 'compound' || ex.category === 'strength')
  ).slice(0, 3);
  
  // Add isolation exercises
  const isolationExercises = shuffleArray(
    targetExercises.filter(ex => ex.mechanicsType === 'isolation')
  ).slice(0, 2);
  
  // Combine them
  const selectedExercises = [...compoundExercises, ...isolationExercises];
  
  console.log(`Selected ${selectedExercises.length} exercises for day ${dayIndex}`);
  
  // Create workout entries
  selectedExercises.forEach(exercise => {
    workout.push({
      exerciseId: exercise.id,
      sets: getExerciseSets(exercise, experienceLevel, primaryGoal)
    });
  });
  
  return workout;
}

function getWorkoutSplit(totalDays: number): number {
  if (totalDays <= 3) return 1; // Full body
  if (totalDays <= 4) return 2; // Upper/Lower
  return 3; // Push/Pull/Legs
}

function getTargetBodyParts(bodyPartDay: number): string[] {
  if (bodyPartDay === 0) {
    return ['chest', 'shoulders', 'arms']; // Push day
  } else if (bodyPartDay === 1) {
    return ['back', 'arms']; // Pull day
  } else {
    return ['legs']; // Leg day
  }
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

function getDayNotes(_primaryGoal: GoalType, experienceLevel: ExperienceLevel, dayIndex: number): string {
  const bodyPartDay = dayIndex % 3;
  const notes = [];
  
  if (bodyPartDay === 0) {
    notes.push('Push day - chest, shoulders, triceps');
  } else if (bodyPartDay === 1) {
    notes.push('Pull day - back, biceps, rear delts');
  } else {
    notes.push('Leg day - quads, hamstrings, glutes, calves');
  }
  
  if (experienceLevel === ExperienceLevel.BEGINNER && bodyPartDay === 2) {
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
  
  // Shuffle and pick one
  const shuffled = shuffleArray(compatibleExercises as ExerciseDBItem[]);
  const newExercise = shuffled[0] as ExerciseDBItem;
  
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