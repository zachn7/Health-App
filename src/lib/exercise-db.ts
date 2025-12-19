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
    
    if (!query || query.trim().length === 0) {
      return [];
    }
    
    try {
      const searchLower = query.toLowerCase().trim();
      console.log(`Searching exercises for: "${searchLower}"`);
      
      // First try exact matches and starts-with
      let results = await db.table('exercises')
        .where('name')
        .startsWithIgnoreCase(searchLower)
        .or('bodyPart')
        .equalsIgnoreCase(searchLower)
        .or('equipment')
        .anyOf([searchLower])
        .limit(50)
        .toArray();
      
      // If no results, try contains search
      if (results.length === 0) {
        console.log('No starts-with matches, trying contains search...');
        const allExercises = await db.table('exercises').limit(200).toArray();
        results = allExercises.filter(exercise => 
          exercise.name.toLowerCase().includes(searchLower) ||
          exercise.bodyPart.toLowerCase().includes(searchLower) ||
          exercise.equipment.some((e: string) => e.toLowerCase().includes(searchLower)) ||
          exercise.targetMuscles.some((m: string) => m.toLowerCase().includes(searchLower))
        ).slice(0, 50);
      }
      
      console.log(`Found ${results.length} exercises for "${searchLower}"`);
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