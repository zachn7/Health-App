import { db } from '../index';
import type { Profile } from '@/types';

export class ProfileRepository {
  async create(profile: Omit<Profile, 'id' | 'createdAt' | 'updatedAt'>): Promise<Profile> {
    const now = new Date().toISOString();
    const newProfile: Profile = {
      ...profile,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    
    await db.profiles.add(newProfile);
    return newProfile;
  }

  async get(): Promise<Profile | undefined> {
    return await db.profiles.toCollection().first();
  }

  async update(id: string, updates: Partial<Profile>): Promise<Profile> {
    const now = new Date().toISOString();
    const updatedProfile = { ...updates, updatedAt: now };
    
    await db.profiles.update(id, updatedProfile);
    const profile = await db.profiles.get(id);
    if (!profile) throw new Error('Profile not found');
    return profile;
  }

  async delete(id: string): Promise<void> {
    await db.profiles.delete(id);
  }

  async exists(): Promise<boolean> {
    const count = await db.profiles.count();
    return count > 0;
  }
}

export const profileRepository = new ProfileRepository();