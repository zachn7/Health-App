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

export interface WorkoutLog {
  id: string;
  date: string;
  workoutPlanId?: string;
  entries: ExerciseLogEntry[];
  cardioEntries: CardioLogEntry[];
  sessionNotes?: string;
  duration: number;
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