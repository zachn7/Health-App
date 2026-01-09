export const ActivityLevel = {
  SEDENTARY: 'sedentary',
  LIGHT: 'light',
  MODERATE: 'moderate',
  ACTIVE: 'active',
  VERY_ACTIVE: 'very_active'
} as const;

export type ActivityLevel = typeof ActivityLevel[keyof typeof ActivityLevel];

export const ExperienceLevel = {
  BEGINNER: 'beginner',
  INTERMEDIATE: 'intermediate',
  ADVANCED: 'advanced'
} as const;

export type ExperienceLevel = typeof ExperienceLevel[keyof typeof ExperienceLevel];

export const GoalType = {
  STRENGTH: 'strength',
  HYPERTROPHY: 'hypertrophy',
  FAT_LOSS: 'fat_loss',
  ENDURANCE: 'endurance',
  GENERAL_FITNESS: 'general_fitness',
  MAINTENANCE: 'general_fitness'
} as const;

export type GoalType = typeof GoalType[keyof typeof GoalType];

export const Sex = {
  MALE: 'male',
  FEMALE: 'female',
  OTHER: 'other'
} as const;

export type Sex = typeof Sex[keyof typeof Sex];

export const PlanGenerationType = {
  MANUAL: 'manual',
  COACH: 'coach'
} as const;

export type PlanGenerationType = typeof PlanGenerationType[keyof typeof PlanGenerationType];

export const FoodSource = {
  USER: 'user',
  BUNDLED: 'bundled',
  IMPORTED: 'imported'
} as const;

export type FoodSource = typeof FoodSource[keyof typeof FoodSource];

export type UnitSystem = 'metric' | 'imperial';

export type GeneratorMode = 'profile' | 'custom';

export interface GeneratorOptions {
  mode: GeneratorMode;
  goalType: GoalType;
  daysPerWeek: number;
  experienceLevel: ExperienceLevel;
  equipment: string[];
}

export interface Goal {
  id: string;
  type: GoalType;
  targetDate?: string;
  priority: number;
  isPrimary?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Schedule {
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
  preferredTime?: 'morning' | 'afternoon' | 'evening';
  workoutDuration?: number; // minutes
}

export interface Profile {
  id: string;
  createdAt: string;
  updatedAt: string;
  age?: number;
  sex?: Sex;
  heightCm: number;
  weightKg: number;
  preferredUnits: UnitSystem;
  activityLevel: ActivityLevel;
  experienceLevel: ExperienceLevel;
  goals: Goal[];
  equipment: string[];
  schedule: Schedule;
  limitations?: string;
  macroSplit?: {
    protein: number;
    carbs: number;
    fat: number;
  };
}

export interface Exercise {
  id: string;
  name: string;
  bodyPart: string;
  equipment: string[];
  instructions: string[];
  cues: string[];
  difficulty: ExperienceLevel;
  category: string;
}

export interface ExerciseSet {
  sets: number;
  reps?: number;
  repsRange?: { min: number; max: number };
  weight?: number;
  restTime?: number;
  rpe?: number;
  notes?: string;
}

export interface PlanWeek {
  week: number;
  workouts: {
    day: string;
    exercises: {
      exerciseId: string;
      sets: ExerciseSet;
    }[];
    notes?: string;
  }[];
}

export interface WorkoutPlan {
  id: string;
  name: string;
  weeks: PlanWeek[];
  generatedBy: PlanGenerationType;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  generationSeed?: number; // Seed used for deterministic generation
}

export interface ExerciseLogEntry {
  exerciseId: string;
  exerciseName: string;
  sets: {
    set: number;
    reps: number;
    weight?: number;
    rpe?: number;
  }[];
  notes?: string;
}

export interface CardioLogEntry {
  type: string;
  duration: number;
  distance?: number;
  pace?: number;
  calories?: number;
  notes?: string;
}

export interface TimeEntry {
  id: string;
  startTime: string; // ISO string
  endTime?: string; // ISO string (undefined if timer is running)
  duration?: number; // Duration in minutes (calculated when endTime is set)
}

export interface WorkoutLog {
  id: string;
  date: string;
  workoutPlanId?: string;
  entries: ExerciseLogEntry[];
  cardioEntries: CardioLogEntry[];
  sessionNotes?: string;
  duration: number;
  timeEntries?: TimeEntry[]; // Optional timer entries
  createdAt: string;
  updatedAt: string;
}

export interface MacroTotals {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG?: number;
  sugarG?: number;
  sodiumMg?: number;
}

export interface FoodLogItem {
  id: string;
  name: string;
  servingSize: string;
  quantidade: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG?: number;
  sugarG?: number;
  sodiumMg?: number;
  barcode?: string;
  // Canonical serving model
  servingGrams: number; // grams per unit (gramsPerUnit in canonical model)
  baseUnit: 'serving' | 'grams'; // Unit being measured
  fdcId?: number; // USDA FDC ID for reference
  computedTotalGrams: number; // Precomputed: quantidade * servingGrams (total grams invariant)
  createdAt?: string;
  updatedAt?: string;
}

export interface NutritionLog {
  id: string;
  date: string;
  items: FoodLogItem[];
  totals: MacroTotals;
  createdAt: string;
  updatedAt: string;
}

export interface WeightLog {
  id: string;
  date: string;
  weightKg: number;
  bodyFat?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FoodItem {
  id: string;
  name: string;
  servingSize: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG?: number;
  sugarG?: number;
  sodiumMg?: number;
  barcode?: string;
  source: FoodSource;
  createdAt?: string;
  updatedAt?: string;
}

export interface MealTemplate {
  id: string;
  name: string;
  items: Omit<FoodLogItem, 'id'>[];
  createdAt: string;
  updatedAt: string;
}

// Meal Plan Types
export type MealPlanGenerationType = 'ai_webllm' | 'offline_basic';

export interface MealPlanConstraints {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  mealsPerDay: number;
  dietaryPreferences?: string[]; // e.g., ['vegetarian', 'gluten-free']
  excludedFoods?: string[];
  budget?: 'low' | 'medium' | 'high';
  timeAvailable?: 'minimal' | 'moderate' | 'flexible';
}

export interface MealPlanFood {
  id: string;
  name: string;
  servingSize: string;
  quantidade: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  baseUnit: 'serving' | 'grams';
  servingGrams: number;
  computedTotalGrams: number;
  fdcId?: number;
}

export interface MealPlanMeal {
  id: string;
  label: string; // e.g., 'Breakfast', 'Lunch', 'Dinner', 'Snack'
  mealId?: string; // Reference to saved MealTemplate (if used)
  inlineMealSnapshot?: MealPlanFood[]; // Snapshot of foods if created directly
  foods: MealPlanFood[]; // Always populated for ease of use
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface MealPlanDay {
  id: string;
  date: string; // YYYY-MM-DD
  meals: MealPlanMeal[];
  totals: {
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
  };
}

export interface MealPlan {
  id: string;
  name: string;
  startDate: string; // YYYY-MM-DD
   endDate: string; // YYYY-MM-DD
   days: MealPlanDay[];
  generationType: MealPlanGenerationType;
  constraintsSnapshot: MealPlanConstraints;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// Coach Engine Types
export interface WeeklyCheckIn {
  id: string;
  adherenceRating: number; // 1-5 scale
  energyLevel: number; // 1-5 scale
  sleepQuality: number; // 1-5 scale
  soreness: number; // 1-5 scale
  notes?: string;
  createdAt: string;
}

export interface TDEECalculation {
  bmr: number;
  tdee: number;
  method: 'mifflin_st_jeor';
}

export interface MacroTargets {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface InjuryAssessment {
  exerciseId?: string;
  area: string;
  description: string;
  severity: 'minor' | 'moderate' | 'severe';
  redFlags: string[];
  recommendation: string;
  seekMedicalAttention: boolean;
  createdAt: string;
}

// Settings Types
export interface Settings {
  id: string;
  createdAt: string;
  updatedAt: string;
  // USDA FoodData Central
  fdcApiKey?: string;
  enableUSDALookups: boolean;
  // WebLLM AI Coach
  enableWebLLMCoach: boolean;
  webllmModelId?: string;
  // Future settings can be added here
}

// Exercise DB Types
export interface ExerciseDBItem {
  id: string;
  name: string;
  bodyPart: string;
  category: string;
  equipment: string[];
  targetMuscles: string[];
  synergistMuscles: string[];
  stabilizerMuscles: string[];
  instructions: string[];
  difficulty: ExperienceLevel;
  forceType?: 'push' | 'pull' | 'static';
  mechanicsType?: 'compound' | 'isolation';
}