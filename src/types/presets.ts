/**
 * Preset Data Types
 * 
 * Typed schemas for workout and meal presets.
 * All pre-built programs and meal plans use these structures.
 */

/**
 * Scientific evidence or reference backing a preset
 */
export interface EvidenceRef {
  /** Title of the research or source */
  title: string;
  /** Author or source name */
  source: string;
  /** Brief note about findings */
  note: string;
  /** Optional URL to full source */
  url?: string;
}

/**
 * A single exercise slot in a workout day
 */
export interface WorkoutSlot {
  /** Exercise pattern (can be specific exercise name or pattern like "compound movement") */
  pattern: string;
  /** Human-readable label for UI */
  label: string;
  /** Number of sets */
  sets: number;
  /** Rep range, can be a single value or range */
  reps: { min: number; max: number } | number;
  /** Reps in Reserve (RIR) - how close to failure */
  rir?: number;
  /** Keywords for exercise matching */
  keywords?: string[];
  /** Whether this slot is optional */
  optional?: boolean;
  /** Rest time in seconds */
  restSeconds?: number;
  /** Tempo note */
  tempo?: string;
}

/**
 * A single day in a workout preset
 */
export interface WorkoutPresetDay {
  /** Name of the day */
  name: string;
  /** Primary focus of the day */
  focus: string;
  /** Exercise slots for this day */
  slots: WorkoutSlot[];
}

/**
 * Full workout preset program
 */
export interface WorkoutPreset {
  /** Unique identifier */
  id: string;
  /** Program title */
  title: string;
  /** Short summary */
  summary: string;
  /** Tags for filtering and discovery */
  tags: string[];
  /** Program duration in weeks */
  durationWeeks: number;
  /** Days per week */
  daysPerWeek: number;
  /** Estimated session duration in minutes */
  sessionMinutes: number;
  /** Required equipment (empty = bodyweight) */
  equipment: string[];
  /** Experience level */
  level: 'beginner' | 'intermediate' | 'advanced';
  /** Primary goal type */
  goalType: 'strength' | 'hypertrophy' | 'general_fitness' | 'fat_loss' | 'endurance';
  /** Progression notes */
  progression: string;
  /** Workout days */
  days: WorkoutPresetDay[];
  /** Scientific backing */
  evidence: EvidenceRef[];
}

/**
 * A meal structure item (when/how to eat)
 */
export interface MealStructureItem {
  /** Which meal (e.g., "Breakfast", "Post-workout") */
  meal: string;
  /** Goal for this meal (e.g., "High protein", "Balanced") */
  goal: string;
  /** Example foods/ideas */
  examples: string[];
}

/**
 * Macro targets for a meal preset
 */
export interface MacroTargets {
  /** Protein percentage or grams */
  protein: number;
  /** Carbs percentage or grams */
  carbs: number;
  /** Fat percentage or grams */
  fat: number;
}

/**
 * Full meal preset plan
 */
export interface MealPreset {
  /** Unique identifier */
  id: string;
  /** Plan title */
  title: string;
  /** Short summary */
  summary: string;
  /** Tags for filtering */
  tags: string[];
  /** Number of main meals per day */
  mealsPerDay: number;
  /** Number of snacks per day */
  snacksPerDay: number;
  /** Macro ranges as percentages of total calories */
  macroRangesPercent: MacroTargets;
  /** Specific macro targets (optional) */
  targets?: MacroTargets;
  /** Meal structure examples */
  mealStructure: MealStructureItem[];
  /** Scientific backing */
  evidence: EvidenceRef[];
  /** Recommended calories (optional - user adjusts) */
  recommendedCalories?: number;
}
