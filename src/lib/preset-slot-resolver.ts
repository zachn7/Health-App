/**
 * Preset Slot Resolver
 * 
 * Maps workout preset slots to actual exercises from the exercise database.
 * Uses keyword matching and seeded randomness to create deterministic results.
 */

import { ExerciseDBService } from './exercise-db';
import type { WorkoutSlot } from '../types/presets';
import type { ExerciseDBItem } from '../types';

export interface ResolvedExercise {
  exerciseId: string;
  exerciseName: string;
  unresolved?: boolean; // If true, this is a placeholder
}

/**
 * Simple seeded random number generator
 * Ensures deterministic results for the same seed
 */
function seededRandom(seed: number): number {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

/**
 * Resolve a keyword to a group of exercises
 */
function getExerciseGroupForKeyword(keyword: string): string {
  const keywordLower = keyword.toLowerCase();
  
  // Primary body part / movement mappings
  const groupMap: Record<string, string> = {
    // Squat variations
    'squat': 'legs',
    'goblet': 'legs',
    'leg press': 'legs',
    'lunge': 'legs',
    'bulgarian': 'legs',
    'split squat': 'legs',
    
    // Push variations
    'push': 'push',
    'press': 'push',
    'bench': 'chest',
    'dumbbell press': 'chest',
    'incline': 'chest',
    'overhead': 'shoulders',
    'ohp': 'shoulders',
    'dip': 'chest',
    'pushup': 'chest',
    'floor press': 'chest',
    
    // Pull variations
    'pull': 'pull',
    'row': 'back',
    'bent over': 'back',
    'pullup': 'back',
    'lat': 'back',
    'chin up': 'back',
    'pull-apart': 'back',
    'inverted row': 'back',
    
    // Hinge/Deadlift
    'hinge': 'posterior',
    'deadlift': 'posterior',
    'romanian': 'posterior',
    'rdl': 'posterior',
    
    // Lateral/Side
    'lateral': 'shoulders',
    'side raise': 'shoulders',
    
    // Arms
    'bicep': 'biceps',
    'curl': 'biceps',
    'tricep': 'triceps',
    'extension': 'triceps',
    'skullcrusher': 'triceps',
    'pushdown': 'triceps',
    
    // Core
    'core': 'core',
    'plank': 'core',
    'crunch': 'core',
    'ab': 'core',
    'dead bug': 'core',
    'mountain climber': 'core',
    'russian twist': 'core',
    'leg raise': 'core',
    'hanging leg raise': 'core',
    
    // Glute/Posterior
    'glute': 'glutes',
    'hip thrust': 'glutes',
    'bridge': 'glutes',
    'pullthrough': 'glutes',
    
    // Calves
    'calve': 'calves',
    
    // Traps
    'trap': 'shoulders',
    'traps': 'shoulders',
    'shrug': 'shoulders',
    
    // Face pull
    'face pull': 'shoulders',
    'rear delt': 'shoulders',
  };
  
  // Direct keyword match
  for (const [key, value] of Object.entries(groupMap)) {
    if (keywordLower.includes(key)) {
      return value;
    }
  }
  
  // Default: try to match body part name directly
  const bodyParts = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'legs', 'core', 'glutes', 'calves'];
  for (const bodyPart of bodyParts) {
    if (keywordLower.includes(bodyPart)) {
      return bodyPart;
    }
  }
  
  return 'other';
}

/**
 * Check if an exercise matches equipment constraints
 */
function matchesEquipment(
  exercise: ExerciseDBItem,
  requiredEquipment: string[]
): boolean {
  if (requiredEquipment.length === 0) {
    return true; // No equipment constraint
  }
  
  // Bodyweight exercises are always allowed
  const isBodyweight = exercise.equipment.some(e => e === 'body only' || e === 'bodyweight');
  if (isBodyweight) {
    return requiredEquipment.includes('bodyweight') || requiredEquipment.length === 0;
  }
  
  // Check if exercise equipment matches any of the required equipment
  for (const exEquipment of exercise.equipment) {
    const exEquipLower = exEquipment.toLowerCase();
    for (const reqEquipment of requiredEquipment) {
      const reqLower = reqEquipment.toLowerCase();
      if (exEquipLower.includes(reqLower) || reqLower.includes(exEquipLower)) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Resolve a workout slot to a specific exercise
 */
export async function resolveWorkoutSlot(
  slot: WorkoutSlot,
  options: {
    presetId: string;
    dayIndex: number;
    slotIndex: number;
    equipment: string[];
  }
): Promise<ResolvedExercise> {
  const { presetId, dayIndex, slotIndex, equipment } = options;
  
  // Ensure exercise DB is loaded
  await ExerciseDBService.initialize();
  
  // Seed for deterministic selection: use presetId + dayIndex + slotIndex
  const seed = presetId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) + (dayIndex * 1000) + slotIndex;
  
  // Step 1: Try direct keyword matches first (highest priority)
  if (slot.keywords && slot.keywords.length > 0) {
    for (const keyword of slot.keywords) {
      const exercises = await ExerciseDBService.searchExercises(keyword);
      const filtered = exercises.filter(ex => matchesEquipment(ex, equipment));
      
      if (filtered.length > 0) {
        // Use seeded random to pick one
        const selectedIndex = Math.floor(seededRandom(seed) * filtered.length);
        const selectedExercise = filtered[selectedIndex];
        
        return {
          exerciseId: selectedExercise.id,
          exerciseName: selectedExercise.name,
        };
      }
    }
  }
  
  // Step 2: Try pattern matching using group mapping
  const group = getExerciseGroupForKeyword(slot.pattern);
  
  // Get exercises for this group
  const groupKeywords = [
    slot.pattern,
    slot.label,
    group,
  ];
  
  for (const keyword of groupKeywords) {
    const exercises = await ExerciseDBService.searchExercises(keyword);
    const filtered = exercises.filter(ex => matchesEquipment(ex, equipment));
    
    if (filtered.length > 0) {
      // Use seeded random to pick one
      const selectedIndex = Math.floor(seededRandom(seed + 100) * filtered.length);
      const selectedExercise = filtered[selectedIndex];
      
      return {
        exerciseId: selectedExercise.id,
        exerciseName: selectedExercise.name,
      };
    }
  }
  
  // Step 3: Try broader search with any keyword from the slot
  if (slot.keywords) {
    // Try to find any exercise
    const allExercises = await ExerciseDBService.searchExercises('');
    const filtered = allExercises.filter(ex => matchesEquipment(ex, equipment));
    
    if (filtered.length > 0) {
      // Find exercises that match any of the keywords
      const matched = filtered.filter(ex => {
        const nameLower = ex.name.toLowerCase();
        return slot.keywords!.some(kw => 
          nameLower.includes(kw.toLowerCase()) ||
          kw.toLowerCase().includes(nameLower)
        );
      });
      
      if (matched.length > 0) {
        const selectedIndex = Math.floor(seededRandom(seed + 200) * matched.length);
        const selectedExercise = matched[selectedIndex];
        
        return {
          exerciseId: selectedExercise.id,
          exerciseName: selectedExercise.name,
        };
      }
      
      // Fallback: pick any exercise that matches equipment
      const selectedIndex = Math.floor(seededRandom(seed + 300) * filtered.length);
      const selectedExercise = filtered[selectedIndex];
      
      return {
        exerciseId: selectedExercise.id,
        exerciseName: selectedExercise.name,
      };
    }
  }
  
  // Step 4: Create placeholder if nothing found
  return {
    exerciseId: `placeholder-${presetId}-${dayIndex}-${slotIndex}`,
    exerciseName: `${slot.label} (Select an exercise)`,
    unresolved: true,
  };
}

/**
 * Resolve an entire preset workout day to exercises
 */
export async function resolveWorkoutDay(
  presetId: string,
  dayIndex: number,
  slots: WorkoutSlot[],
  equipment: string[]
): Promise<{ resolved: ResolvedExercise[]; unresolvedCount: number }> {
  const resolved: ResolvedExercise[] = [];
  let unresolvedCount = 0;
  
  for (let slotIndex = 0; slotIndex < slots.length; slotIndex++) {
    const slot = slots[slotIndex];
    const result = await resolveWorkoutSlot(slot, {
      presetId,
      dayIndex,
      slotIndex,
      equipment,
    });
    
    if (result.unresolved) {
      unresolvedCount++;
    }
    
    resolved.push(result);
  }
  
  return { resolved, unresolvedCount };
}
