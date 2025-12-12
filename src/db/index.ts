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
  InjuryAssessment
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

  constructor() {
    super('CodePuppyTrainerDB');

    // Schema version 1
    this.version(1).stores({
      // Core profile data
      profiles: '++id, createdAt, updatedAt, age, activityLevel, experienceLevel',
      
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
      injuryAssessments: '++id, createdAt, area, severity'
    });

    // Schema version 2 - Add indexes for better performance
    this.version(2).stores({
      profiles: '++id, createdAt, updatedAt, age, activityLevel, experienceLevel',
      workoutPlans: '++id, name, generatedBy, createdAt, updatedAt',
      workoutLogs: '++id, date, workoutPlanId, createdAt, updatedAt, [date+workoutPlanId]',
      nutritionLogs: '++id, date, createdAt, updatedAt, [date]',
      foodItems: '++id, name, barcode, source, createdAt, updatedAt, [name+source]',
      mealTemplates: '++id, name, createdAt, updatedAt',
      weightLogs: '++id, date, weightKg, createdAt, updatedAt, [date+weightKg]',
      weeklyCheckIns: '++id, createdAt, [createdAt]',
      injuryAssessments: '++id, createdAt, area, severity, [area+severity]'
    });

    // Schema version 3 - Add PWA cache and sync timestamps
    this.version(3).stores({
      profiles: '++id, createdAt, updatedAt, age, activityLevel, experienceLevel, lastSync',
      workoutPlans: '++id, name, generatedBy, createdAt, updatedAt, lastSync',
      workoutLogs: '++id, date, workoutPlanId, createdAt, updatedAt, [date+workoutPlanId], lastSync',
      nutritionLogs: '++id, date, createdAt, updatedAt, [date], lastSync',
      foodItems: '++id, name, barcode, source, createdAt, updatedAt, [name+source], lastSync',
      mealTemplates: '++id, name, createdAt, updatedAt, lastSync',
      weightLogs: '++id, date, weightKg, createdAt, updatedAt, [date+weightKg], lastSync',
      weeklyCheckIns: '++id, createdAt, [createdAt], lastSync',
      injuryAssessments: '++id, createdAt, area, severity, [area+severity], lastSync'
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
  injuryAssessments: db.injuryAssessments
} as const;

// Database utility functions
export const clearAllData = async (): Promise<void> => {
  try {
    await db.transaction('rw', db.tables, async () => {
      await Promise.all(
        db.tables.map(table => table.clear())
      );
    });
    console.log('All data cleared from database');
  } catch (error) {
    console.error('Failed to clear database:', error);
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