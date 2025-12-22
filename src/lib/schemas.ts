import { z } from 'zod';

// Zod schemas for validation
export const ExerciseSetSchema = z.object({
  sets: z.number().min(1).max(10),
  reps: z.number().min(1).max(50).optional(),
  repsRange: z.object({
    min: z.number().min(1),
    max: z.number().min(1)
  }).optional(),
  weight: z.number().min(0).max(1000).optional(),
  restTime: z.number().min(0).max(600).optional(),
  notes: z.string().max(500).optional()
});

export const ExerciseLogEntrySchema = z.object({
  exerciseId: z.string().min(1),
  exerciseName: z.string().min(1).max(100),
  sets: z.array(ExerciseSetSchema)
});

export const CurrentWorkoutSchema = z.object({
  workoutPlanId: z.string().optional(),
  exercises: z.array(z.object({
    exerciseId: z.string().min(1),
    sets: ExerciseSetSchema
  })),
  notes: z.string().max(1000).optional()
});

export const WorkoutPlanSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  notes: z.string().max(2000).optional(),
  weeks: z.array(z.object({
    week: z.number().min(1),
    workouts: z.array(z.object({
      day: z.string().min(1).max(50),
      exercises: z.array(z.object({
        exerciseId: z.string().min(1),
        sets: ExerciseSetSchema
      })),
      notes: z.string().max(1000).optional()
    }))
  })).min(1),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
});

// Safe JSON parsing with validation
export function safeJSONParse<T>(jsonString: string, schema: z.ZodSchema<T>, context: string): { success: boolean; data?: T; error?: string } {
  // DEV: Log the raw value being parsed
  if (process.env.NODE_ENV === 'development') {
    console.log(`[DEV] Safe JSON Parse - Context: ${context}`);
    console.log(`[DEV] Raw input type:`, typeof jsonString);
    console.log(`[DEV] Raw input length:`, jsonString?.length || 0);
    console.log(`[DEV] Raw input preview:`, jsonString?.substring(0, 200) + (jsonString?.length > 200 ? '...' : ''));
    
    // Check if it looks like HTML
    if (typeof jsonString === 'string' && jsonString.trim().startsWith('<')) {
      console.error(`[DEV] ⚠️  Detected HTML content instead of JSON in ${context}`);
      console.error(`[DEV] HTML preview:`, jsonString.substring(0, 500));
      return { success: false, error: `Received HTML page instead of JSON data in ${context}` };
    }
  }
  
  // Check for undefined/null
  if (jsonString === null || jsonString === undefined) {
    const error = `Null/undefined data received in ${context}`;
    console.error(`[DEV] Safe JSON Parse - ${error}`);
    return { success: false, error };
  }
  
  // Check type
  if (typeof jsonString !== 'string') {
    const error = `Expected string but got ${typeof jsonString} in ${context}`;
    console.error(`[DEV] Safe JSON Parse - ${error}`);
    console.error(`[DEV] Received data:`, jsonString);
    return { success: false, error };
  }
  
  // Check for empty string
  if (jsonString.trim() === '') {
    const error = `Empty string received in ${context}`;
    console.error(`[DEV] Safe JSON Parse - ${error}`);
    return { success: false, error };
  }
  
  try {
    const parsed = JSON.parse(jsonString);
    
    // DEV: Log successful parse
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEV] ✅ JSON.parse successful in ${context}`);
      console.log(`[DEV] Parsed data type:`, typeof parsed);
      console.log(`[DEV] Parsed data keys:`, Object.keys(parsed || {}));
    }
    
    // Validate with schema
    const validationResult = schema.safeParse(parsed);
    
    if (!validationResult.success) {
      const error = `Schema validation failed in ${context}: ${validationResult.error.message}`;
      console.error(`[DEV] ❌ Schema validation failed in ${context}`);
      console.error(`[DEV] Validation errors:`, validationResult.error.flatten());
      console.error(`[DEV] Invalid data:`, parsed);
      return { success: false, error };
    }
    
    // DEV: Log successful validation
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEV] ✅ Schema validation successful in ${context}`);
    }
    
    return { success: true, data: validationResult.data };
    
  } catch (parseError) {
    const error = parseError instanceof Error ? parseError.message : 'Unknown parse error';
    console.error(`[DEV] ❌ JSON.parse failed in ${context}`);
    console.error(`[DEV] Parse error:`, error);
    
    // Log helpful debugging info
    if (process.env.NODE_ENV === 'development') {
      console.error(`[DEV] First 100 chars:`, jsonString.substring(0, 100));
      
      // Check for common JSON error patterns
      if (jsonString.includes('<!DOCTYPE')) {
        console.error(`[DEV] 💡 This looks like an HTML page. Check routing/fetch issues.`);
      }
      if (jsonString.includes('Unexpected token')) {
        console.error(`[DEV] 💡 Double encoded JSON or invalid characters detected.`);
      }
    }
    
    return { success: false, error: `JSON parse error in ${context}: ${error}` };
  }
}

// Safe JSON stringify with validation
export function safeJSONStringify<T>(data: T, schema: z.ZodSchema<T>, context: string): { success: boolean; result?: string; error?: string } {
  try {
    // Validate data first
    const validationResult = schema.safeParse(data);
    if (!validationResult.success) {
      const error = `Schema validation failed in ${context}: ${validationResult.error.message}`;
      console.error(`[DEV] Stringify validation failed in ${context}:`, validationResult.error.flatten());
      return { success: false, error };
    }
    
    const result = JSON.stringify(validationResult.data);
    return { success: true, result };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[DEV] JSON.stringify failed in ${context}:`, errorMessage);
    return { success: false, error: `JSON stringify error in ${context}: ${errorMessage}` };
  }
}
