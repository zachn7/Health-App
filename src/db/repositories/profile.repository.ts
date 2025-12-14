import { db } from '../index';
import type { Profile } from '@/types';

export class ProfileRepository {
  async create(profile: Profile): Promise<Profile> {
    const now = new Date().toISOString();
    const newProfile: Profile = {
      ...profile,
      id: profile.id || crypto.randomUUID(),
      createdAt: profile.createdAt || now,
      updatedAt: now,
    };
    
    await db.profiles.put(newProfile);
    return newProfile;
  }

  async get(): Promise<Profile | undefined> {
    return await db.profiles.toCollection().first();
  }

  async save(profile: Profile): Promise<Profile> {
    // Check if profile already exists
    const existing = await this.get();
    if (existing && existing.id !== profile.id) {
      // Update existing profile with new data but keep existing ID
      const updatedProfile = { ...profile, id: existing.id };
      return this.update(updatedProfile);
    } else {
      // Create or update profile
      return this.create(profile);
    }
  }

  async update(profile: Profile): Promise<Profile> {
    const now = new Date().toISOString();
    const updatedProfile: Profile = {
      ...profile,
      updatedAt: now,
    };
    
    await db.profiles.put(updatedProfile);
    return updatedProfile;
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