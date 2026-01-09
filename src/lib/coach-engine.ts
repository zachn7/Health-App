import type { Profile, WorkoutPlan, MacroTargets, ExerciseSet, ExerciseDBItem } from '../types';
import { ActivityLevel, GoalType, ExperienceLevel } from '../types';
import { ExerciseDBService } from './exercise-db';
import { db } from '@/db';

// ============================================
// SEEDED RANDOM NUMBER GENERATOR (Mulberry32)
// ============================================
// Generates a seeded random number generator function
function seededRandom(seed: number): () => number {
  return function() {
    var t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ============================================
// EXERCISE SCORING FOR STANDARD/EASY PREFERENCE
// ============================================
// Equipment allowlist: prefer these simple, common items
const PREFERRED_EQUIPMENT = ['body only', 'bodyweight', 'dumbbell', 'dumbbells', 'barbell', 'machine', 'cable', 'cable machine', 'bench'];

// Keywords that indicate simple/standard exercises
const SIMPLE_KEYWORDS = ['press', 'curl', 'row', 'squat', 'deadlift', 'bench', 'lunge', 'step-up', 'push', 'pull', 'extension', 'raise', 'fly', 'crunch', 'plank', 'bridge'];

// Advanced/complex keywords (de-prioritize but don't exclude)
const ADVANCED_KEYWORDS = ['snatch', 'clean', 'jerk', 'pistol', 'muscle-up', 'butterfly', 'sumo', ' Bulgarian', 'front squat', 'overhead press', 'good morning'];

/**
 * Score an exercise for program generation preference.
 * Higher scores = more preferred (simpler, more standard)
 * @param exercise - The exercise to score
 * @param equipmentPrefs - Available equipment (optional, for bonus points)
 * @returns Score between 0 and 100
 */
function scoreExerciseForProgram(
  exercise: ExerciseDBItem,
  equipmentPrefs: Set<string> = new Set()
): number {
  let score = 50; // Base score
  const nameLower = exercise.name.toLowerCase();
  const equipmentLower = exercise.equipment.map(e => e.toLowerCase());
  
  // Preference 1: Standard equipment (+15)
  const hasPreferredEquipment = equipmentLower.some(eq => PREFERRED_EQUIPMENT.includes(eq));
  if (hasPreferredEquipment) {
    score += 15;
  }
  
  // Bonus for matching user's equipment (+10)
  if (equipmentPrefs.size > 0) {
    const matchesUserEquipment = equipmentLower.some(eq => equipmentPrefs.has(eq));
    if (matchesUserEquipment) {
      score += 10;
    }
  }
  
  // Preference 2: Simple keywords (+10 each, max +20)
  const simpleCount = SIMPLE_KEYWORDS.filter(keyword => nameLower.includes(keyword)).length;
  score += Math.min(simpleCount * 10, 20);
  
  // Preference 3: Shorter, simpler names (+5 for names < 15 chars, +3 for 15-20)
  if (exercise.name.length < 15) {
    score += 5;
  } else if (exercise.name.length < 20) {
    score += 3;
  }
  
  // Preference 4: Beginner-friendly difficulty (+10)
  if (exercise.difficulty?.toLowerCase() === 'beginner') {
    score += 10;
  } else if (exercise.difficulty?.toLowerCase() === 'intermediate') {
    score += 5;
  }
  
  // De-prioritize advanced exercises (-15 each, max -30)
  const advancedCount = ADVANCED_KEYWORDS.filter(keyword => nameLower.includes(keyword)).length;
  score -= Math.min(advancedCount * 15, 30);
  
  // De-prioritize excessive equipment variety (-10 for >2 equipment types)
  if (equipmentLower.length > 2) {
    score -= 10;
  }
  
  // Clamp score between 0 and 100
  return Math.max(0, Math.min(100, score));
}

/**
 * Select exercises from candidates with weighted random selection based on scores.
 * Uses seeded RNG for reproducibility.
 * @param candidates - Candidate exercises
 * @param count - Number to select
 * @param seed - Random seed for selection
 * @param usedIds - IDs to avoid (already used)
 * @param equipmentPrefs - Equipment preferences for scoring bonus
 * @returns Selected exercises
 */
function selectExercisesWeighted(
  candidates: ExerciseDBItem[],
  count: number,
  seed: number,
  usedIds: Set<string> = new Set(),
  equipmentPrefs: Set<string> = new Set()
): ExerciseDBItem[] {
  const rng = seededRandom(seed);
  const selected: ExerciseDBItem[] = [];
  const available = candidates.filter(ex => !usedIds.has(ex.id));
  
  // Score all candidates with equipment preferences
  const scored = available.map(ex => ({
    exercise: ex,
    score: scoreExerciseForProgram(ex, equipmentPrefs)
  }));
  
  // Select based on weighted probability (higher score = more likely)
  for (let i = 0; i < count && scored.length > 0; i++) {
    // Calculate total score for probability
    const totalScore = scored.reduce((sum, s) => sum + s.score, 0);
    
    // Weighted random selection
    let random = rng() * totalScore;
    let selectedIndex = 0;
    
    for (let j = 0; j < scored.length; j++) {
      random -= scored[j].score;
      if (random <= 0) {
        selectedIndex = j;
        break;
      }
    }
    
    // Add selected exercise
    selected.push(scored[selectedIndex].exercise);
    usedIds.add(scored[selectedIndex].exercise.id);
    
    // Remove from scored pool
    scored.splice(selectedIndex, 1);
  }
  
  return selected;
}

type ExerciseSubstitutionHistory = Record<string, Set<string>>; // slot key -> set of used exercise IDs

// Track substitutions per exercise slot to avoid cycling back
const exerciseSubstitutionHistory: ExerciseSubstitutionHistory = {};

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
export async function generateWorkoutPlan(
  profile: Profile,
  goalId?: string,
  seed?: number
): Promise<WorkoutPlan> {
  const { experienceLevel, goals, equipment, schedule } = profile;
  const selectedGoal = goals.find(g => g.id === goalId) || goals.find(g => g.isPrimary) || goals[0];
  const primaryGoal = selectedGoal?.type || GoalType.GENERAL_FITNESS;
  
  // Generate or use provided seed for variety
  const generationSeed = seed ?? Math.floor(Math.random() * 4294967296);
  console.log('Generation seed:', generationSeed);
  
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
  
  // Create equipment preference set for scoring bonus
  const equipmentPrefs = new Set(normalizedEquipment);
  
  for (const day of dayNames) {
    if (schedule[day as keyof typeof schedule]) {
      // Use deterministic seed per day: base seed + day index
      const daySeed = generationSeed + workoutIndex * 1000;
      
      const { exercises: workout, newlyUsedIds } = await generateDayWorkout(
        workoutIndex, 
        trainingDays, 
        availableExercises, 
        experienceLevel, 
        primaryGoal,
        usedExerciseIds,
        equipmentPrefs,
        daySeed
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
    updatedAt: new Date().toISOString(),
    generationSeed // Store seed for reproducibility
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
  usedExerciseIds: Set<string> = new Set(),
  equipmentPrefs: Set<string> = new Set(),
  seed: number = Math.floor(Math.random() * 4294967296)
): Promise<{ exercises: any[]; newlyUsedIds: Set<string> }> {
  const workout: any[] = [];
  const newlyUsedIds: Set<string> = new Set();
  
  // Determine body part focus for this day
  const bodyPartFocus = getDayBodyPartFocus(dayIndex, totalDays);
  console.log(`Day ${dayIndex}: Focus on ${bodyPartFocus.join(', ')}`);
  
  // Determine target exercise count based on experience level
  const targetExerciseCount = experienceLevel === 'beginner' ? 4 : 6;
  
  // Get candidate exercises with cascading fallbacks
  let candidateExercises = getExercisesForBodyPart(bodyPartFocus, exercises, usedExerciseIds);
  
  console.log(`Found ${candidateExercises.length} candidate exercises for day ${dayIndex}`);
  
  // Fallback: if no exercises match the focus, use any available unused exercises
  if (candidateExercises.length === 0) {
    console.log(`No exercises for ${bodyPartFocus.join(', ')}. Using fallback...`);
    // Use all exercises that haven't been used yet
    candidateExercises = exercises.filter(ex => !usedExerciseIds.has(ex.id));
    
    // Still no exercises? Use ANY exercises (even if used - better than nothing)
    if (candidateExercises.length === 0) {
      console.warn(`Day ${dayIndex}: No available exercises. Using all exercises as last resort.`);
      candidateExercises = exercises;
    }
  }
  
  console.log(`Using weighted selection with seed ${seed}`);
  
  // Create a copy of usedExerciseIds for the selection
  const selectionUsedIds = new Set(usedExerciseIds);
  
  // Select exercises using weighted random selection based on scoring
  const selectedExercises = selectExercisesWeighted(
    candidateExercises,
    targetExerciseCount,
    seed,
    selectionUsedIds,
    equipmentPrefs // Pass equipment preferences for scoring bonus
  );
  
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
  _planId: string, // Not used for slot-based history (kept for backward compatibility)
  equipment?: string[],
  usedInCurrentDay?: Set<string>,
  slotKey?: string // Format: "${weekIndex}-${dayIndex}-${exerciseIndex}" for per-slot history
): Promise<ExerciseDBItem | null> {
  await ExerciseDBService.initialize();
  
  // Get the current exercise
  const currentExercise = await ExerciseDBService.getExerciseById(currentExerciseId);
  if (!currentExercise) {
    console.error('Current exercise not found:', currentExerciseId);
    return null;
  }
  
  // Get substitution history for this exercise slot (if slotKey provided)
  const slotHistory = slotKey ? (exerciseSubstitutionHistory[slotKey] || new Set<string>()) : null;
  
  // Always exclude current exercise from candidate pool
  const excludedExercises = new Set([currentExerciseId]);
  
  // Add slot history to exclusions
  if (slotHistory) {
    slotHistory.forEach(id => excludedExercises.add(id));
  }
  
  // Add exercises used in the current day to exclusions
  if (usedInCurrentDay) {
    usedInCurrentDay.forEach(id => excludedExercises.add(id));
  }
  
  // Get all exercises from the DB
  const allExercises = await db.table('exercises').toArray();
  
  // Normalize equipment names for better matching (same logic as generateWorkoutPlan)
  const EQUIPMENT_MAPPING: Record<string, string[]> = {
    'bodyweight': ['body only', 'bodyweight', 'body only'],
    'barbell': ['barbell'],
    'dumbbells': ['dumbbell', 'dumbbells'],
    'kettlebells': ['kettlebells'],
    'resistance bands': ['bands', 'resistance bands'],
    'cable machine': ['cable', 'cable machine'],
    'squat rack': ['barbell', 'squat rack'],
    'bench': ['barbell', 'bench', 'machine']
  };
  
  let normalizedEquipment: string[] = [];
  if (equipment && equipment.length > 0) {
    normalizedEquipment = equipment.flatMap(eq => 
      EQUIPMENT_MAPPING[eq.toLowerCase()] || [eq]
    ).map(eq => eq.toLowerCase());
    console.log('Substitute - Profile equipment:', equipment);
    console.log('Substitute - Normalized equipment:', normalizedEquipment);
  }
  
  console.log('Trying to find substitute for:', currentExercise.name);
  console.log('Current exercise equipment:', currentExercise.equipment);
  console.log('Current exercise bodyPart:', currentExercise.bodyPart);
  console.log('Current exercise targetMuscles:', currentExercise.targetMuscles);
  
  // Helper function to check if exercises share similar muscles/body part
  const musclesOverlap = (exercise: ExerciseDBItem): boolean => {
    // Check body part match (with normalization)
    const bodyPartsMatch = exercise.bodyPart.toLowerCase() === currentExercise.bodyPart.toLowerCase();
    
    // Check target muscle overlap
    const currentTargets = currentExercise.targetMuscles.map(m => m.toLowerCase());
    const exerciseTargets = exercise.targetMuscles.map(m => m.toLowerCase());
    const targetMusclesMatch = currentTargets.some((m: string) => 
      exerciseTargets.some((em: string) => 
        m.includes(em) || em.includes(m)
      )
    );
    
    return bodyPartsMatch || targetMusclesMatch;
  };
  
  function findCandidates(restrictEquipment: boolean): ExerciseDBItem[] {
    return allExercises.filter((exercise: ExerciseDBItem) => {
      // Skip excluded exercises (current, slot history, current day)
      if (excludedExercises.has(exercise.id)) return false;
      
      // Must have overlapping muscles or body part
      if (!musclesOverlap(exercise)) {
        return false;
      }
      
      // Check equipment match (if specified and restricting)
      if (restrictEquipment && normalizedEquipment.length > 0) {
        const exerciseEquipment = exercise.equipment.map(eq => eq.toLowerCase());
        const hasMatchingEquipment = exerciseEquipment.some((eq: string) => 
          normalizedEquipment.includes(eq)
        );
        if (!hasMatchingEquipment) return false;
      }
      
      return true;
    });
  }
  
  // Try 1: Same muscle/body part + matching equipment
  let candidates = findCandidates(true);
  console.log(`Step 1 - Equipment-restricted candidates: ${candidates.length} exercises`);
  
  // Try 2: Same muscle/body part, any equipment
  if (candidates.length === 0) {
    candidates = findCandidates(false);
    console.log(`Step 2 - Any equipment candidates: ${candidates.length} exercises`);
  }
  
  // Try 3: Any exercise from DB (last resort - still respect exclusions)
  if (candidates.length === 0) {
    console.log('Step 3 - Fallback to any available exercise');
    candidates = allExercises.filter((exercise: ExerciseDBItem) => {
      // Still exclude current and current day exercises
      if (exercise.id === currentExerciseId) return false;
      if (usedInCurrentDay && usedInCurrentDay.has(exercise.id)) {
        return false;
      }
      return true;
    });
    console.log(`Step 3 - Fallback candidates: ${candidates.length} exercises`);
  }
  
  if (candidates.length === 0) {
    console.warn('No compatible exercises found for substitution at all - this should not happen with a valid database');
    return null;
  }
  
  // Sort deterministically and pick the first
  const sorted = sortExercisesDeterministically(candidates as ExerciseDBItem[]);
  // Prefer same mechanics type if available
  const sameMechanics = sorted.filter(ex => ex.mechanicsType === currentExercise.mechanicsType);
  const candidatesToUse = sameMechanics.length > 0 ? sameMechanics : sorted;
  
  const newExercise = candidatesToUse[0] as ExerciseDBItem;
  
  if (!newExercise) {
    console.warn('No exercises found after sorting');
    return null;
  }
  
  // Record substitution in slot history (if slotKey provided)
  if (slotKey) {
    if (!exerciseSubstitutionHistory[slotKey]) {
      exerciseSubstitutionHistory[slotKey] = new Set<string>();
    }
    // Add current exercise to history so we don't go back to it
    exerciseSubstitutionHistory[slotKey].add(currentExerciseId);
    console.log(`Added ${currentExercise.name} to slot ${slotKey} history`);
  }
  
  console.log(`✅ Substituted ${currentExercise.name} with ${newExercise.name}`);
  console.log(`   Body part: ${currentExercise.bodyPart} -> ${newExercise.bodyPart}`);
  console.log(`   Equipment: ${currentExercise.equipment.join(', ')} -> ${newExercise.equipment.join(', ')}`);
  
  return newExercise;
}