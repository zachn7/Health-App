import { db } from '../index';
import type { Settings } from '@/types';
import type { AIProviderId } from '@/ai/types';
import { emitSettingsChanged } from '@/lib/settings-events';

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
      emitSettingsChanged({ updatedAt: settings.updatedAt })
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
      emitSettingsChanged({ updatedAt: updatedSettings.updatedAt })
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

  async getAIProviderId(): Promise<AIProviderId> {
    const settings = await this.getSettings();
    return settings?.aiProvider || 'deterministic';
  }

  async setAIProviderId(providerId: AIProviderId): Promise<void> {
    await this.updateSettings({ aiProvider: providerId });
  }

  async getAIApiKey(): Promise<string | undefined> {
    const settings = await this.getSettings();
    return settings?.aiApiKey;
  }

  async setAIApiKey(apiKey: string | null): Promise<void> {
    await this.updateSettings({ aiApiKey: apiKey || undefined });
  }

  async getAIModelId(): Promise<string | undefined> {
    const settings = await this.getSettings();
    return settings?.aiModelId;
  }

  async setAIModelId(modelId: string | null): Promise<void> {
    await this.updateSettings({ aiModelId: modelId || undefined });
  }

  async getAIAllowLoggingActions(): Promise<boolean> {
    const settings = await this.getSettings();
    return settings?.aiAllowLoggingActions || false;
  }

  async setAIAllowLoggingActions(enabled: boolean): Promise<void> {
    await this.updateSettings({ aiAllowLoggingActions: enabled });
  }
}

export const settingsRepository = new SettingsRepository();