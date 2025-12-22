import Dexie, { Table } from 'dexie';
import type {
  Profile,
  WorkoutPlan,
  WorkoutLog,
  NutritionLog,
  WeightLog,
  FoodItem,
  MealTemplate,
  WeeklyCheckIn,
  InjuryAssessment,
  Settings,
  ExerciseDBItem
} from '@/types';

export class CodePuppyDB extends Dexie {
  // Tables
  profiles!: Table<Profile>;
  workoutPlans!: Table<WorkoutPlan>;
  workoutLogs!: Table<WorkoutLog>;
  nutritionLogs!: Table<NutritionLog>;
  weightLogs!: Table<WeightLog>;
  foodItems!: Table<FoodItem>;
  mealTemplates!: Table<MealTemplate>;
  weeklyCheckIns!: Table<WeeklyCheckIn>;
  injuryAssessments!: Table<InjuryAssessment>;
  settings!: Table<Settings>;
  exercises!: Table<ExerciseDBItem>;

  constructor() {
    super('CodePuppyTrainerDB');

    // Schema version 1
    this.version(1).stores({
      // Core profile data
      profiles: 'id, createdAt, updatedAt, age, activityLevel, experienceLevel',
      
      // Workout related
      workoutPlans: '++id, name, generatedBy, createdAt, updatedAt',
      workoutLogs: '++id, date, workoutPlanId, createdAt, updatedAt',
      
      // Nutrition related
      nutritionLogs: '++id, date, createdAt, updatedAt',
      foodItems: '++id, name, barcode, source, createdAt, updatedAt',
      mealTemplates: '++id, name, createdAt, updatedAt',
      
      // Tracking
      weightLogs: '++id, date, weightKg, createdAt, updatedAt',
      weeklyCheckIns: '++id, createdAt',
      
      // Safety
      injuryAssessments: '++id, createdAt, area, severity',
      
      // Settings
      settings: 'id, createdAt, updatedAt',
      
      // Exercise Database
      exercises: 'id, name, bodyPart, category, equipment, difficulty, [name+bodyPart]',
      
      // Custom Exercises  
      customExercises: '++id, name, createdAt, updatedAt'
    });

    // Schema version 2 - Add indexes for better performance
    this.version(2).stores({
      profiles: 'id, createdAt, updatedAt, age, activityLevel, experienceLevel',
      workoutPlans: '++id, name, generatedBy, createdAt, updatedAt',
      workoutLogs: '++id, date, workoutPlanId, createdAt, updatedAt, [date+workoutPlanId]',
      nutritionLogs: '++id, date, createdAt, updatedAt, [date]',
      foodItems: '++id, name, barcode, source, createdAt, updatedAt, [name+source]',
      mealTemplates: '++id, name, createdAt, updatedAt',
      weightLogs: '++id, date, weightKg, createdAt, updatedAt, [date+weightKg]',
      weeklyCheckIns: '++id, createdAt, [createdAt]',
      injuryAssessments: '++id, createdAt, area, severity, [area+severity]',
      
      // Settings
      settings: 'id, createdAt, updatedAt',
      
      // Exercise Database
      exercises: 'id, name, bodyPart, category, equipment, difficulty, [name+bodyPart]',
      
      // Custom Exercises
      customExercises: '++id, name, createdAt, updatedAt'
    });

    // Schema version 3 - Add PWA cache and sync timestamps
    this.version(3).stores({
      profiles: 'id, createdAt, updatedAt, age, activityLevel, experienceLevel, lastSync',
      workoutPlans: '++id, name, generatedBy, createdAt, updatedAt, lastSync',
      workoutLogs: '++id, date, workoutPlanId, createdAt, updatedAt, [date+workoutPlanId], lastSync',
      nutritionLogs: '++id, date, createdAt, updatedAt, [date], lastSync',
      foodItems: '++id, name, barcode, source, createdAt, updatedAt, [name+source], lastSync',
      mealTemplates: '++id, name, createdAt, updatedAt, lastSync',
      weightLogs: '++id, date, weightKg, createdAt, updatedAt, [date+weightKg], lastSync',
      weeklyCheckIns: '++id, createdAt, [createdAt], lastSync',
      injuryAssessments: '++id, createdAt, area, severity, [area+severity], lastSync',
      
      // Settings
      settings: 'id, createdAt, updatedAt, lastSync',
      
      // Exercise Database
      exercises: 'id, name, bodyPart, category, equipment, difficulty, [name+bodyPart], lastSync',
      
      // Custom Exercises
      customExercises: '++id, name, createdAt, updatedAt, lastSync'
    });

    // Schema version 4 - Use date as primary key for weight logs (one entry per day)
    this.version(4).stores({
      profiles: 'id, createdAt, updatedAt, age, activityLevel, experienceLevel, lastSync',
      workoutPlans: '++id, name, generatedBy, createdAt, updatedAt, lastSync',
      workoutLogs: '++id, date, workoutPlanId, createdAt, updatedAt, [date+workoutPlanId], lastSync',
      nutritionLogs: '++id, date, createdAt, updatedAt, [date], lastSync',
      foodItems: '++id, name, barcode, source, createdAt, updatedAt, [name+source], lastSync',
      mealTemplates: '++id, name, createdAt, updatedAt, lastSync',
      weightLogs: 'id, date, weightKg, createdAt, updatedAt, lastSync', // Date is now primary key
      weeklyCheckIns: '++id, createdAt, [createdAt], lastSync',
      injuryAssessments: '++id, createdAt, area, severity, [area+severity], lastSync',
      
      // Settings
      settings: 'id, createdAt, updatedAt, lastSync',
      
      // Exercise Database
      exercises: 'id, name, bodyPart, category, equipment, difficulty, [name+bodyPart], lastSync',
      
      // Custom Exercises
      customExercises: '++id, name, createdAt, updatedAt, lastSync'
    }).upgrade(tx => {
      // Migrate existing weight logs to use date as primary key
      return tx.table('weightLogs').toCollection().modify(log => {
        // Set the ID to be the date string for primary key constraint
        log.id = log.date;
      });
    });
  }
}

// Create a singleton instance
export const db = new CodePuppyDB();

// Database helper functions
export const initDatabase = async (): Promise<void> => {
  try {
    await db.open();
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
};

// Import repositories
import { profileRepository } from './repositories/profile.repository';
import { workoutRepository } from './repositories/workout.repository';
import { nutritionRepository } from './repositories/nutrition.repository';
import { progressRepository } from './repositories/progress.repository';
import { settingsRepository } from './repositories/settings.repository';

// Export all tables for easy access
export const tables = {
  profiles: db.profiles,
  workoutPlans: db.workoutPlans,
  workoutLogs: db.workoutLogs,
  nutritionLogs: db.nutritionLogs,
  weightLogs: db.weightLogs,
  foodItems: db.foodItems,
  mealTemplates: db.mealTemplates,
  weeklyCheckIns: db.weeklyCheckIns,
  injuryAssessments: db.injuryAssessments,
  settings: db.settings,
  exercises: db.exercises
} as const;

// Export repositories for convenient usage
export const repositories = {
  profile: profileRepository,
  workout: workoutRepository,
  nutrition: nutritionRepository,
  progress: progressRepository,
  settings: settingsRepository
} as const;

// Database utility functions
export const clearAllData = async (): Promise<void> => {
  try {
    // First clear all database tables
    await db.transaction('rw', db.tables, async () => {
      await Promise.all(
        db.tables.map(table => table.clear())
      );
    });
    console.log('All data cleared from database');
    
    // Clear localStorage and sessionStorage
    localStorage.clear();
    sessionStorage.clear();
    console.log('Local storage cleared');
    
    // Clear service worker caches if available
    if ('caches' in window) {
      try {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
        console.log('Service worker caches cleared');
      } catch (error) {
        console.warn('Failed to clear caches:', error);
      }
    }
    
    // Unregister service workers
    if ('serviceWorker' in navigator) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(
          registrations.map(registration => registration.unregister())
        );
        console.log('Service workers unregistered');
      } catch (error) {
        console.warn('Failed to unregister service workers:', error);
      }
    }
    
    console.log('All data and caches cleared successfully');
  } catch (error) {
    console.error('Failed to clear all data:', error);
    throw error;
  }
};

export const exportAllData = async (): Promise<any> => {
  try {
    const data: any = {};
    
    for (const tableName of db.tables.map(table => table.name)) {
      const table = db.table(tableName);
      data[tableName] = await table.toArray();
    }
    
    return {
      version: db.verno,
      exportedAt: new Date().toISOString(),
      data
    };
  } catch (error) {
    console.error('Failed to export data:', error);
    throw error;
  }
};

export const importAllData = async (importData: any): Promise<void> => {
  try {
    if (!importData.data) {
      throw new Error('Invalid import data format');
    }

    await db.transaction('rw', db.tables, async () => {
      // Clear existing data first
      await Promise.all(
        db.tables.map(table => table.clear())
      );
      
      // Import new data
      for (const [tableName, records] of Object.entries(importData.data)) {
        const table = db.table(tableName);
        if (Array.isArray(records) && records.length > 0) {
          await table.bulkAdd(records);
        }
      }
    });
    
    console.log('Data imported successfully');
  } catch (error) {
    console.error('Failed to import data:', error);
    throw error;
  }
};