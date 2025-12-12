import type { Profile, WorkoutPlan, MacroTargets } from '../types';
import { ActivityLevel, GoalType, ExperienceLevel } from '../types';
import exercisesData from '../assets/data/exercises.seed.json';

interface Exercise {
  id: string;
  name: string;
  bodyPart: string;
  equipment: string[];
  category: string;
  difficulty: string;
  instructions: string[];
  cues: string[];
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
  const primaryGoal = profile.goals[0]?.type || GoalType.MAINTENANCE;
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
export function generateWorkoutPlan(profile: Profile): WorkoutPlan {
  const { experienceLevel, goals, equipment, schedule } = profile;
  const primaryGoal = goals[0]?.type || GoalType.GENERAL_FITNESS;
  
  // Determine training frequency based on schedule
  const trainingDays = Object.values(schedule).filter(Boolean).length;
  
  // Select exercises based on available equipment and goals
  const availableExercises = exercisesData.filter(exercise => 
    exercise.equipment.some(eq => equipment.includes(eq))
  );
  
  // Generate weekly plan
  const weeks: any[] = [];
  
  // Week 1
  const week1: any = {
    week: 1,
    workouts: []
  };
  
  const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  
  dayNames.forEach((day, index) => {
    if (schedule[day as keyof typeof schedule]) {
      const workout = generateDayWorkout(index, trainingDays, availableExercises, experienceLevel, primaryGoal);
      week1.workouts.push({
        day: day.charAt(0).toUpperCase() + day.slice(1),
        exercises: workout,
        notes: getDayNotes(primaryGoal, experienceLevel, index)
      });
    }
  });
  
  weeks.push(week1);
  
  // Generate 4 weeks total with progression
  for (let week = 2; week <= 4; week++) {
    const weekPlan = JSON.parse(JSON.stringify(week1));
    weekPlan.week = week;
    
    // Apply progression
    weekPlan.workouts.forEach((workout: any) => {
      workout.exercises.forEach((exercise: any) => {
        // Increase reps or add small weight progression
        if (week % 2 === 0 && exercise.sets.reps) {
          exercise.sets.reps += Math.floor(exercise.sets.reps * 0.05);
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

function generateDayWorkout(
  dayIndex: number,
  totalDays: number,
  exercises: Exercise[],
  experienceLevel: ExperienceLevel,
  primaryGoal: GoalType
): any[] {
  const workout: any[] = [];
  
  // Determine body part focus based on day
  const bodyPartDay = dayIndex % getWorkoutSplit(totalDays);
  const targetBodyParts = getTargetBodyParts(bodyPartDay);
  
  // Filter exercises by target body parts
  const targetExercises = exercises.filter(ex => 
    targetBodyParts.includes(ex.bodyPart)
  );
  
  // Select 4-6 exercises per workout
  const exerciseCount = Math.min(6, Math.max(4, Math.floor(targetExercises.length / 2)));
  const selectedExercises = targetExercises.slice(0, exerciseCount);
  
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
    return ['chest', 'shoulders', 'triceps']; // Push day
  } else if (bodyPartDay === 1) {
    return ['back', 'biceps']; // Pull day
  } else {
    return ['legs']; // Leg day
  }
}

function getExerciseSets(
  exercise: Exercise,
  experienceLevel: ExperienceLevel,
  goal: GoalType
): any {
  const baseSets = experienceLevel === 'beginner' ? 3 : 4;
  const baseReps = getBaseReps(goal, exercise.category);
  
  return {
    sets: baseSets,
    reps: baseReps,
    restTime: exercise.category === 'compound' ? 90 : 60,
    notes: `Focus on proper form. ${exercise.cues[0]}`
  };
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