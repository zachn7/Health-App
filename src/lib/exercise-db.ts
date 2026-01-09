import { db } from '@/db';
import type { ExerciseDBItem, ExperienceLevel } from '@/types';
// @ts-ignore
import exercisesData from '@/assets/data/exercises.json';

// Map the external exercise data to our internal format
const mapExerciseToInternal = (externalExercise: any): ExerciseDBItem => {
  const mapDifficulty = (level: string): ExperienceLevel => {
    switch (level?.toLowerCase()) {
      case 'beginner': return 'beginner';
      case 'intermediate': return 'intermediate'; 
      case 'advanced': return 'advanced';
      default: return 'beginner';
    }
  };
  
  const mapForceType = (force: string): 'push' | 'pull' | 'static' | undefined => {
    switch (force?.toLowerCase()) {
      case 'push': return 'push';
      case 'pull': return 'pull';
      case 'static': return 'static';
      default: return undefined;
    }
  };
  
  const mapMechanics = (mechanic: string): 'compound' | 'isolation' | undefined => {
    switch (mechanic?.toLowerCase()) {
      case 'compound': return 'compound';
      case 'isolation': return 'isolation';
      default: return undefined;
    }
  };
  
  // Generate a safe ID from the name
  const id = externalExercise.name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-');
  
  return {
    id,
    name: externalExercise.name || 'Unknown Exercise',
    bodyPart: externalExercise.primaryMuscles?.[0] || 'full body',
    category: externalExercise.category || 'strength',
    equipment: [externalExercise.equipment || 'body only'],
    targetMuscles: externalExercise.primaryMuscles || [],
    synergistMuscles: externalExercise.secondaryMuscles || [],
    stabilizerMuscles: [], // Not available in this dataset
    instructions: externalExercise.instructions || [],
    difficulty: mapDifficulty(externalExercise.level),
    forceType: mapForceType(externalExercise.force),
    mechanicsType: mapMechanics(externalExercise.mechanic)
  };
};

export class ExerciseDBService {
  private static initialized = false;
  
  static async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      // Check if exercises are already loaded
      const existingCount = await db.table('exercises').count();
      console.log(`Existing exercises count: ${existingCount}`);
      
      if (existingCount === 0) {
        console.log('Loading exercise database...');
        
        // Map and load external exercise data
        const mappedExercises = exercisesData.map(mapExerciseToInternal);
        console.log(`Mapped ${mappedExercises.length} exercises from JSON`);
        
        // Add to database in batches to avoid blocking
        const BATCH_SIZE = 100;
        for (let i = 0; i < mappedExercises.length; i += BATCH_SIZE) {
          const batch = mappedExercises.slice(i, i + BATCH_SIZE);
          await db.table('exercises').bulkPut(batch);
          console.log(`Loaded batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(mappedExercises.length/BATCH_SIZE)}`);
        }
        
        console.log(`Successfully loaded ${mappedExercises.length} exercises into database`);
        
        // Verify some sample exercises
        const sampleExercises = await db.table('exercises').limit(5).toArray();
        console.log('Sample exercises:', sampleExercises.map(e => ({ id: e.id, name: e.name, bodyPart: e.bodyPart })));
        
      } else {
        console.log(`Exercises already loaded: ${existingCount} exercises found`);
      }
      
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize exercise database:', error);
      throw error;
    }
  }
  
  static async searchExercises(query: string): Promise<ExerciseDBItem[]> {
    await this.initialize();
    
    const trimmedQuery = query?.trim() || '';
    
    // Empty search - return all exercises
    if (!trimmedQuery) {
      console.log('Empty search, returning all exercises');
      const allExercises = await db.table('exercises').toArray();
      console.log(`Returning ${allExercises.length} exercises`);
      return allExercises;
    }
    
    try {
      const searchLower = trimmedQuery.toLowerCase();
      console.log(`Searching exercises for: "${searchLower}"`);
      
      // Tokenize query for multi-word matching (e.g., "incline bench" -> ["incline", "bench"])
      const searchTokens = searchLower.split(/\s+/).filter(token => token.length > 0);
      console.log(`Search tokens:`, searchTokens);
      
      // If single word, use indexed search for performance
      if (searchTokens.length === 1) {
        // Try starts-with matches first (prioritize relevance)
        let results = await db.table('exercises')
          .filter(exercise => 
            exercise.name.toLowerCase().startsWith(searchLower) ||
            exercise.bodyPart.toLowerCase().startsWith(searchLower)
          )
          .toArray();
        
        // Add substring matches (lower priority)
        if (true) { // Always add substring matches
          const allExercises = await db.table('exercises').toArray();
          const substringResults = allExercises.filter(exercise => 
            exercise.name.toLowerCase().includes(searchLower) ||
            exercise.bodyPart.toLowerCase().includes(searchLower) ||
            exercise.equipment.some((e: string) => e.toLowerCase().includes(searchLower)) ||
            exercise.targetMuscles.some((m: string) => m.toLowerCase().includes(searchLower))
          ).filter(ex => !results.find(r => r.id === ex.id));
          results = [...results, ...substringResults];
        }
        
        console.log(`Found ${results.length} exercises for single word query`);
        return results;
      }
      
      // Multi-word query: token-based matching
      // Match if ALL tokens are found somewhere in name/bodyPart/equipment
      const allExercises = await db.table('exercises').toArray();
      
      const matchedExercises = allExercises.filter(exercise => {
        // Create searchable string combining all exercise properties
        const searchableText = [
          exercise.name,
          exercise.bodyPart,
          ...exercise.equipment,
          ...exercise.targetMuscles,
          ...exercise.synergistMuscles
        ].join(' ').toLowerCase();
        
        // Check if ALL search tokens are found somewhere in the searchable text
        return searchTokens.every(token => searchableText.includes(token));
      });
      
      // Sort by how many tokens were matched (more matches = better relevance)
      const scoredExercises = matchedExercises.map(exercise => {
        const searchableText = [
          exercise.name,
          exercise.bodyPart,
          ...exercise.equipment
        ].join(' ').toLowerCase();
        
        const matchCount = searchTokens.reduce((count, token) => {
          return count + (searchableText.includes(token) ? 1 : 0);
        }, 0);
        
        return { exercise, matchCount };
      });
      
      // Sort by match count (descending), then by name alphabetically
      scoredExercises.sort((a, b) => {
        if (b.matchCount !== a.matchCount) {
          return b.matchCount - a.matchCount;
        }
        return a.exercise.name.localeCompare(b.exercise.name);
      });
      
      const results = scoredExercises.map(se => se.exercise);
      
      console.log(`Found ${results.length} exercises for multi-word query "${searchLower}"`);
      return results;
      
    } catch (error) {
      console.error('Failed to search exercises:', error);
      return [];
    }
  }
  
  static async getExercisesByBodyPart(bodyPart: string): Promise<ExerciseDBItem[]> {
    await this.initialize();
    
    try {
      return await db.table('exercises')
        .where('bodyPart')
        .equalsIgnoreCase(bodyPart)
        .toArray();
    } catch (error) {
      console.error('Failed to get exercises by body part:', error);
      return [];
    }
  }
  
  static async getExercisesByEquipment(equipment: string): Promise<ExerciseDBItem[]> {
    await this.initialize();
    
    try {
      return await db.table('exercises')
        .where('equipment')
        .anyOf([equipment])
        .toArray();
    } catch (error) {
      console.error('Failed to get exercises by equipment:', error);
      return [];
    }
  }
  
  static async getExercisesByDifficulty(difficulty: ExperienceLevel): Promise<ExerciseDBItem[]> {
    await this.initialize();
    
    try {
      return await db.table('exercises')
        .where('difficulty')
        .equals(difficulty)
        .toArray();
    } catch (error) {
      console.error('Failed to get exercises by difficulty:', error);
      return [];
    }
  }
  
  static async getAllBodyParts(): Promise<string[]> {
    await this.initialize();
    
    try {
      const exercises = await db.table('exercises').toArray();
      const bodyParts = [...new Set(exercises.map(e => e.bodyPart))];
      console.log(`Found ${bodyParts.length} body parts:`, bodyParts);
      return bodyParts.sort();
    } catch (error) {
      console.error('Failed to get body parts:', error);
      return [];
    }
  }
  
  static async getAllEquipment(): Promise<string[]> {
    await this.initialize();
    
    try {
      const exercises = await db.table('exercises').toArray();
      const equipment = [...new Set(exercises.flatMap(e => e.equipment))];
      return equipment.sort();
    } catch (error) {
      console.error('Failed to get equipment:', error);
      return [];
    }
  }
  
  static async getExerciseById(id: string): Promise<ExerciseDBItem | null> {
    await this.initialize();
    
    try {
      return await db.table('exercises').get(id);
    } catch (error) {
      console.error('Failed to get exercise by ID:', error);
      return null;
    }
  }
  
  static async addCustomExercise(exercise: Omit<ExerciseDBItem, 'id'>): Promise<string> {
    await this.initialize();
    
    try {
      // Generate ID from name with timestamp to avoid conflicts
      const id = `custom-${Date.now()}-${exercise.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
      
      const customExercise: ExerciseDBItem = {
        ...exercise,
        id
      };
      
      await db.table('exercises').put(customExercise);
      return id;
    } catch (error) {
      console.error('Failed to add custom exercise:', error);
      throw error;
    }
  }
  
  static async getCustomExercises(): Promise<ExerciseDBItem[]> {
    await this.initialize();
    
    try {
      return await db.table('exercises')
        .filter(exercise => exercise.id.startsWith('custom-'))
        .toArray();
    } catch (error) {
      console.error('Failed to get custom exercises:', error);
      return [];
    }
  }
}

// Initialize the exercises table in the database schema
export const initializeExerciseSchema = () => {
  // This would ideally be done when initializing the database
  // For now, we'll use the existing foodItems table as a reference
  // and add exercises table dynamically
};