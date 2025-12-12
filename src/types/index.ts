export enum ActivityLevel {
  SEDENTARY = 'sedentary',
  LIGHT = 'light',
  MODERATE = 'moderate',
  ACTIVE = 'active',
  VERY_ACTIVE = 'very_active'
}

export enum ExperienceLevel {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced'
}

export enum GoalType {
  STRENGTH = 'strength',
  HYPERTROPHY = 'hypertrophy',
  FAT_LOSS = 'fat_loss',
  ENDURANCE = 'endurance',
  GENERAL_FITNESS = 'general_fitness'
}

export enum Sex {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other'
}

export enum PlanGenerationType {
  MANUAL = 'manual',
  COACH = 'coach'
}

export enum FoodSource {
  USER = 'user',
  BUNDLED = 'bundled',
  IMPORTED = 'imported'
}

export interface Goal {
  id: string;
  type: GoalType;
  targetDate?: string;
  priority: number;
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