import { db } from '../index';
import type { WorkoutPlan, WorkoutLog } from '@/types';

export class WorkoutRepository {
  // Workout Plans
  async createWorkoutPlan(plan: Omit<WorkoutPlan, 'id' | 'createdAt' | 'updatedAt'>): Promise<WorkoutPlan> {
    const now = new Date().toISOString();
    const newPlan: WorkoutPlan = {
      ...plan,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    
    await db.workoutPlans.add(newPlan);
    return newPlan;
  }

  async getWorkoutPlans(): Promise<WorkoutPlan[]> {
    return await db.workoutPlans.toArray();
  }

  async getWorkoutPlan(id: string): Promise<WorkoutPlan | undefined> {
    return await db.workoutPlans.get(id);
  }

  async updateWorkoutPlan(id: string, updates: Partial<WorkoutPlan>): Promise<WorkoutPlan> {
    const now = new Date().toISOString();
    const updatedPlan = { ...updates, updatedAt: now };
    
    await db.workoutPlans.update(id, updatedPlan);
    const plan = await db.workoutPlans.get(id);
    if (!plan) throw new Error('Workout plan not found');
    return plan;
  }

  async deleteWorkoutPlan(id: string): Promise<void> {
    await db.workoutPlans.delete(id);
  }

  // Workout Logs
  async createWorkoutLog(log: Omit<WorkoutLog, 'id' | 'createdAt' | 'updatedAt'>): Promise<WorkoutLog> {
    const now = new Date().toISOString();
    const newLog: WorkoutLog = {
      ...log,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    
    await db.workoutLogs.add(newLog);
    return newLog;
  }

  async getWorkoutLogs(): Promise<WorkoutLog[]> {
    return await db.workoutLogs.orderBy('date').reverse().toArray();
  }

  async getWorkoutLog(id: string): Promise<WorkoutLog | undefined> {
    return await db.workoutLogs.get(id);
  }

  async getWorkoutLogsByDateRange(startDate: string, endDate: string): Promise<WorkoutLog[]> {
    return await db.workoutLogs
      .where('date')
      .between(startDate, endDate, true, true)
      .toArray();
  }

  async updateWorkoutLog(id: string, updates: Partial<WorkoutLog>): Promise<WorkoutLog> {
    const now = new Date().toISOString();
    const updatedLog = { ...updates, updatedAt: now };
    
    await db.workoutLogs.update(id, updatedLog);
    const log = await db.workoutLogs.get(id);
    if (!log) throw new Error('Workout log not found');
    return log;
  }

  async deleteWorkoutLog(id: string): Promise<void> {
    await db.workoutLogs.delete(id);
  }

  async getTodaysWorkout(): Promise<WorkoutLog | undefined> {
    const today = new Date().toISOString().split('T')[0];
    return await db.workoutLogs.where('date').equals(today).first();
  }
}

export const workoutRepository = new WorkoutRepository();