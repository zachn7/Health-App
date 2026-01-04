import { db } from '../index';
import type { NutritionLog, FoodItem, MealTemplate, MealPlan } from '@/types';

// Per-day async queue to serialize operations and prevent race conditions
const dayLogQueues: Map<string, Promise<NutritionLog>> = new Map();

export class NutritionRepository {
  // Food Items
  async createFoodItem(food: Omit<FoodItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<FoodItem> {
    const now = new Date().toISOString();
    const newFood: FoodItem = {
      ...food,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    
    await db.foodItems.add(newFood);
    return newFood;
  }

  async getFoodItems(): Promise<FoodItem[]> {
    return await db.foodItems.orderBy('name').toArray();
  }

  async getFoodItem(id: string): Promise<FoodItem | undefined> {
    return await db.foodItems.get(id);
  }

  async searchFoodItems(query: string): Promise<FoodItem[]> {
    const lowerQuery = query.toLowerCase();
    return await db.foodItems
      .filter(food => food.name.toLowerCase().includes(lowerQuery))
      .limit(50)
      .toArray();
  }

  async updateFoodItem(id: string, updates: Partial<FoodItem>): Promise<FoodItem> {
    const now = new Date().toISOString();
    const updatedFood = { ...updates, updatedAt: now };
    
    await db.foodItems.update(id, updatedFood);
    const food = await db.foodItems.get(id);
    if (!food) throw new Error('Food item not found');
    return food;
  }

  async deleteFoodItem(id: string): Promise<void> {
    await db.foodItems.delete(id);
  }

  // Nutrition Logs
  async createNutritionLog(log: Omit<NutritionLog, 'id' | 'createdAt' | 'updatedAt'>): Promise<NutritionLog> {
    const now = new Date().toISOString();
    const newLog: NutritionLog = {
      ...log,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    
    await db.nutritionLogs.add(newLog);
    return newLog;
  }

  async getNutritionLogs(): Promise<NutritionLog[]> {
    return await db.nutritionLogs.orderBy('date').reverse().toArray();
  }

  async getNutritionLog(date: string): Promise<NutritionLog | undefined> {
    return await db.nutritionLogs.where('date').equals(date).first();
  }

  async getNutritionLogsByDateRange(startDate: string, endDate: string): Promise<NutritionLog[]> {
    return await db.nutritionLogs
      .where('date')
      .between(startDate, endDate, true, true)
      .toArray();
  }

  async updateNutritionLog(id: string, updates: Partial<NutritionLog>): Promise<NutritionLog> {
    const now = new Date().toISOString();
    const updatedLog = { ...updates, updatedAt: now };
    
    await db.nutritionLogs.update(id, updatedLog);
    const log = await db.nutritionLogs.get(id);
    if (!log) throw new Error('Nutrition log not found');
    return log;
  }

  async deleteNutritionLog(id: string): Promise<void> {
    await db.nutritionLogs.delete(id);
  }

  // Meal Templates
  async createMealTemplate(template: Omit<MealTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<MealTemplate> {
    const now = new Date().toISOString();
    const newTemplate: MealTemplate = {
      ...template,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    
    await db.mealTemplates.add(newTemplate);
    return newTemplate;
  }

  async getMealTemplates(): Promise<MealTemplate[]> {
    return await db.mealTemplates.orderBy('name').toArray();
  }

  async getMealTemplate(id: string): Promise<MealTemplate | undefined> {
    return await db.mealTemplates.get(id);
  }

  async updateMealTemplate(id: string, updates: Partial<MealTemplate>): Promise<MealTemplate> {
    const now = new Date().toISOString();
    const updatedTemplate = { ...updates, updatedAt: now };
    
    await db.mealTemplates.update(id, updatedTemplate);
    const template = await db.mealTemplates.get(id);
    if (!template) throw new Error('Meal template not found');
    return template;
  }

  async deleteMealTemplate(id: string): Promise<void> {
    await db.mealTemplates.delete(id);
  }

  // Helper methods
  async getTodaysNutrition(): Promise<NutritionLog | undefined> {
    const today = new Date().toISOString().split('T')[0];
    return await this.getNutritionLog(today);
  }

  /**
   * Atomically get or create a nutrition log for a given date
   * Ensures only one log per date exists and always returns a valid log
   */
  async getOrCreateDayLog(date: string): Promise<NutritionLog> {
    // First try to get existing log
    const existingLog = await this.getNutritionLog(date);
    if (existingLog) {
      return existingLog;
    }

    // Create new log for the date
    const now = new Date().toISOString();
    const newLog: NutritionLog = {
      id: crypto.randomUUID(),
      date,
      items: [],
      totals: {
        calories: 0,
        proteinG: 0,
        carbsG: 0,
        fatG: 0,
        fiberG: 0,
        sugarG: 0,
        sodiumMg: 0
      },
      createdAt: now,
      updatedAt: now
    };

    await db.nutritionLogs.add(newLog);
    return newLog;
  }

  /**
   * Add food item to day log with queue-based serialization
   * Uses per-day queue to prevent race conditions during rapid adds
   */
  async addFoodToDayLog(date: string, foodLogItem: any): Promise<NutritionLog> {
    // Get or create the queue for this date
    let queuePromise = dayLogQueues.get(date);

    if (!queuePromise) {
      // Start with getOrCreate operation
      queuePromise = this.getOrCreateDayLog(date);
      dayLogQueues.set(date, queuePromise);

      // Clean up queue after it resolves
      queuePromise.finally(() => {
        dayLogQueues.delete(date);
      });
    }

    // Chain our add operation onto the existing queue
    const finalPromise = queuePromise.then(async (log) => {
      // Read latest log from DB (not from the queued state) to prevent lost updates
      const latestLog = await this.getNutritionLog(date);
      const targetLog = latestLog || log;

      // Add the new item
      const updatedItems = [...(targetLog.items || []), foodLogItem];
      const updatedLog: NutritionLog = {
        ...targetLog,
        items: updatedItems,
        totals: this.calculateTotals(updatedItems),
        updatedAt: new Date().toISOString()
      };

      await db.nutritionLogs.put(updatedLog);
      return updatedLog;
    });

    // Update the queue promise for the next operation
    dayLogQueues.set(date, finalPromise);

    return finalPromise;
  }

  /**
   * Update food item in day log with queue-based serialization
   */
  async updateFoodInDayLog(date: string, foodItemId: string, updates: Partial<any>): Promise<NutritionLog> {
    const log = await this.getOrCreateDayLog(date);
    const updatedItems = (log.items || []).map(item => 
      item.id === foodItemId ? { ...item, ...updates } : item
    );
    
    const updatedLog: NutritionLog = {
      ...log,
      items: updatedItems,
      totals: this.calculateTotals(updatedItems),
      updatedAt: new Date().toISOString()
    };

    await db.nutritionLogs.put(updatedLog);
    return updatedLog;
  }

  /**
   * Delete food item from day log with queue-based serialization
   */
  async deleteFoodFromDayLog(date: string, foodItemId: string): Promise<NutritionLog | null> {
    const log = await this.getNutritionLog(date);
    if (!log) {
      throw new Error('Nutrition log not found for date');
    }

    const updatedItems = (log.items || []).filter(item => item.id !== foodItemId);

    if (updatedItems.length === 0) {
      // Delete the entire log if no items left
      await this.deleteNutritionLog(log.id);
      return null;
    }

    const updatedLog: NutritionLog = {
      ...log,
      items: updatedItems,
      totals: this.calculateTotals(updatedItems),
      updatedAt: new Date().toISOString()
    };

    await db.nutritionLogs.put(updatedLog);
    return updatedLog;
  }

  /**
   * Calculate macro totals from food log items
   */
  private calculateTotals(items: any[]): {
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    fiberG: number;
    sugarG: number;
    sodiumMg: number;
  } {
    return items.reduce(
      (totals, item) => ({
        calories: totals.calories + (item.calories || 0),
        proteinG: totals.proteinG + (item.proteinG || 0),
        carbsG: totals.carbsG + (item.carbsG || 0),
        fatG: totals.fatG + (item.fatG || 0),
        fiberG: (totals.fiberG || 0) + ((item.fiberG || 0)),
        sugarG: (totals.sugarG || 0) + ((item.sugarG || 0)),
        sodiumMg: (totals.sodiumMg || 0) + ((item.sodiumMg || 0))
      }),
      {
        calories: 0,
        proteinG: 0,
        carbsG: 0,
        fatG: 0,
        fiberG: 0,
        sugarG: 0,
        sodiumMg: 0
      }
    );
  }

  async getWeeklyNutritionTotals(startDate: string, endDate: string): Promise<{
    totalCalories: number;
    totalProtein: number;
    totalCarbs: number;
    totalFat: number;
    daysLogged: number;
  }> {
    const logs = await this.getNutritionLogsByDateRange(startDate, endDate);
    
    return logs.reduce(
      (totals, log) => ({
        totalCalories: totals.totalCalories + log.totals.calories,
        totalProtein: totals.totalProtein + log.totals.proteinG,
        totalCarbs: totals.totalCarbs + log.totals.carbsG,
        totalFat: totals.totalFat + log.totals.fatG,
        daysLogged: totals.daysLogged + 1
      }),
      { totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0, daysLogged: 0 }
    );
  }

  // Meal Plans
  async createMealPlan(plan: Omit<MealPlan, 'id' | 'createdAt' | 'updatedAt'>): Promise<MealPlan> {
    const now = new Date().toISOString();
    const newPlan: MealPlan = {
      ...plan,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    
    await db.mealPlans.add(newPlan);
    return newPlan;
  }

  async getMealPlans(): Promise<MealPlan[]> {
    return await db.mealPlans.orderBy('createdAt').reverse().toArray();
  }

  async getMealPlan(id: string): Promise<MealPlan | undefined> {
    return await db.mealPlans.get(id);
  }

  async updateMealPlan(id: string, updates: Partial<MealPlan>): Promise<MealPlan> {
    const now = new Date().toISOString();
    const updatedPlan = { ...updates, updatedAt: now };
    
    await db.mealPlans.update(id, updatedPlan);
    const plan = await db.mealPlans.get(id);
    if (!plan) throw new Error('Meal plan not found');
    return plan;
  }

  async deleteMealPlan(id: string): Promise<void> {
    await db.mealPlans.delete(id);
  }

  async getMealPlansByDateRange(startDate: string, endDate: string): Promise<MealPlan[]> {
    const plans = await this.getMealPlans();
    return plans.filter(plan => 
      plan.startDate >= startDate && plan.endDate <= endDate
    );
  }

  /**
   * Import a single meal from a meal plan into a day's nutrition log
   */
  async importMealPlanMeal(date: string, mealFoods: any[]): Promise<NutritionLog> {
    // Convert meal plan foods to food log items
    const foodLogItems = mealFoods.map(food => ({
      id: crypto.randomUUID(),
      name: food.name,
      servingSize: food.servingSize || '1 serving',
      quantidade: food.quantidade || 1,
      calories: food.calories || 0,
      proteinG: food.proteinG || 0,
      carbsG: food.carbsG || 0,
      fatG: food.fatG || 0,
      fiberG: food.fiberG,
      sugarG: food.sugarG,
      sodiumMg: food.sodiumMg,
      baseUnit: food.baseUnit || 'serving',
      servingGrams: food.servingGrams || 100,
      computedTotalGrams: food.computedTotalGrams || (food.quantidade || 1) * (food.servingGrams || 100),
      fdcId: food.fdcId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }));

    // Queue all imports atomically
    let finalPromise: Promise<NutritionLog> = Promise.resolve(
      (await this.getOrCreateDayLog(date))
    );

    for (const foodLogItem of foodLogItems) {
      finalPromise = finalPromise.then(async (log) => {
        const latestLog = await this.getNutritionLog(date);
        const targetLog = latestLog || log;

        const updatedItems = [...(targetLog.items || []), foodLogItem];
        const updatedLog: NutritionLog = {
          ...targetLog,
          items: updatedItems,
          totals: this.calculateTotals(updatedItems),
          updatedAt: new Date().toISOString()
        };

        await db.nutritionLogs.put(updatedLog);
        return updatedLog;
      });
    }

    return finalPromise;
  }

  /**
   * Import all meals from a meal plan day into a day's nutrition log
   */
  async importMealPlanDay(date: string, mealPlanDay: any): Promise<NutritionLog> {
    // Flatten all foods from all meals in the day
    const allFoods: any[] = [];
    for (const meal of mealPlanDay.meals) {
      allFoods.push(...meal.foods);
    }

    return this.importMealPlanMeal(date, allFoods);
  }
}

export const nutritionRepository = new NutritionRepository();