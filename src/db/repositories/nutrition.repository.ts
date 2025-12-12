import { db } from '../index';
import type { NutritionLog, FoodItem, MealTemplate } from '@/types';

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
}

export const nutritionRepository = new NutritionRepository();