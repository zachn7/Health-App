import { db } from '../index';
import type { WeightLog, WeeklyCheckIn } from '@/types';

export class ProgressRepository {
  // Weight Logs
  async createWeightLog(log: Omit<WeightLog, 'id' | 'createdAt' | 'updatedAt'>): Promise<WeightLog> {
    const now = new Date().toISOString();
    const newLog: WeightLog = {
      ...log,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    
    await db.weightLogs.add(newLog);
    return newLog;
  }

  async getWeightLogs(): Promise<WeightLog[]> {
    return await db.weightLogs.orderBy('date').reverse().toArray();
  }

  async getWeightLog(id: string): Promise<WeightLog | undefined> {
    return await db.weightLogs.get(id);
  }

  async getLatestWeightLog(): Promise<WeightLog | undefined> {
    return await db.weightLogs.orderBy('date').reverse().first();
  }

  async getWeightLogsByDateRange(startDate: string, endDate: string): Promise<WeightLog[]> {
    return await db.weightLogs
      .where('date')
      .between(startDate, endDate, true, true)
      .toArray();
  }

  async updateWeightLog(id: string, updates: Partial<WeightLog>): Promise<WeightLog> {
    const now = new Date().toISOString();
    const updatedLog = { ...updates, updatedAt: now };
    
    await db.weightLogs.update(id, updatedLog);
    const log = await db.weightLogs.get(id);
    if (!log) throw new Error('Weight log not found');
    return log;
  }

  async deleteWeightLog(id: string): Promise<void> {
    await db.weightLogs.delete(id);
  }

  // Weekly Check-ins
  async createWeeklyCheckIn(checkIn: WeeklyCheckIn): Promise<WeeklyCheckIn> {
    const newCheckIn: WeeklyCheckIn = {
      ...checkIn,
      id: crypto.randomUUID(),
    };
    
    await db.weeklyCheckIns.add(newCheckIn);
    return newCheckIn;
  }

  async getWeeklyCheckIns(): Promise<WeeklyCheckIn[]> {
    return await db.weeklyCheckIns.orderBy('createdAt').reverse().toArray();
  }

  async getWeeklyCheckIn(id: string): Promise<WeeklyCheckIn | undefined> {
    return await db.weeklyCheckIns.get(id);
  }

  async getLatestWeeklyCheckIn(): Promise<WeeklyCheckIn | undefined> {
    return await db.weeklyCheckIns.orderBy('createdAt').reverse().first();
  }

  async deleteWeeklyCheckIn(id: string): Promise<void> {
    await db.weeklyCheckIns.delete(id);
  }

  // Analytics helpers
  async getWeightTrend(days: number = 30): Promise<{
    current: number | null;
    previous: number | null;
    trend: 'up' | 'down' | 'stable' | null;
    trendAmount: number;
    average: number;
  }> {
    const logs = await this.getWeightLogs();
    if (logs.length === 0) {
      return { current: null, previous: null, trend: null, trendAmount: 0, average: 0 };
    }

    const sortedLogs = logs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const current = sortedLogs[sortedLogs.length - 1].weightKg;
    
    const previousIndex = Math.max(0, sortedLogs.length - Math.min(days, sortedLogs.length));
    const previous = sortedLogs[previousIndex].weightKg;

    const trendAmount = current - previous;
    const trend = Math.abs(trendAmount) < 0.1 ? 'stable' : trendAmount > 0 ? 'up' : 'down';
    
    const average = sortedLogs.reduce((sum, log) => sum + log.weightKg, 0) / sortedLogs.length;

    return {
      current,
      previous,
      trend,
      trendAmount,
      average
    };
  }

  async getWeeklyWorkoutAdherence(): Promise<number> {
    // This would need to be calculated based on planned vs actual workouts
    // For now, return a placeholder
    return 0.75; // 75% adherence placeholder
  }

  async getNutritionAdherence(): Promise<{
    targetCalories: number;
    averageCalories: number;
    adherence: number;
  }> {
    // This would integrate with the nutrition repository
    // For now, return placeholder data
    return {
      targetCalories: 2000,
      averageCalories: 1850,
      adherence: 0.925 // 92.5% adherence
    };
  }
}

export const progressRepository = new ProgressRepository();