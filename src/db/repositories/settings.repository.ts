import { db } from '../index';
import type { Settings } from '@/types';

class SettingsRepository {
  async getSettings(): Promise<Settings | null> {
    try {
      const settings = await db.settings.toArray();
      return settings.length > 0 ? settings[0] : null;
    } catch (error) {
      console.error('Failed to get settings:', error);
      return null;
    }
  }
  
  async saveSettings(settings: Settings): Promise<void> {
    try {
      await db.settings.put(settings);
    } catch (error) {
      console.error('Failed to save settings:', error);
      throw error;
    }
  }
  
  async updateSettings(updates: Partial<Settings>): Promise<Settings | null> {
    try {
      const currentSettings = await this.getSettings();
      if (!currentSettings) {
        throw new Error('No settings found');
      }
      
      const updatedSettings: Settings = {
        ...currentSettings,
        ...updates,
        updatedAt: new Date().toISOString()
      };
      
      await db.settings.put(updatedSettings);
      return updatedSettings;
    } catch (error) {
      console.error('Failed to update settings:', error);
      throw error;
    }
  }
  
  async getFdcApiKey(): Promise<string | undefined> {
    const settings = await this.getSettings();
    return settings?.fdcApiKey;
  }
  
  async isUSDALookupsEnabled(): Promise<boolean> {
    const settings = await this.getSettings();
    return settings?.enableUSDALookups || false;
  }
  
  async isWebLLMCoachEnabled(): Promise<boolean> {
    const settings = await this.getSettings();
    return settings?.enableWebLLMCoach || false;
  }
  
  async getWebLLMModelId(): Promise<string | null> {
    const settings = await this.getSettings();
    return settings?.webllmModelId || null;
  }
  
  async setWebLLMModelId(modelId: string | null): Promise<void> {
    await this.updateSettings({ webllmModelId: modelId || undefined });
  }
}

export const settingsRepository = new SettingsRepository();