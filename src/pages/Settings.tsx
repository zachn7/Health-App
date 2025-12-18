import { useState, useEffect } from 'react';
import { Shield, Eye, EyeOff, Key, Brain, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Settings as SettingsType } from '@/types';
import { db } from '@/db';

export default function Settings() {
  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [tempApiKey, setTempApiKey] = useState('');
  
  useEffect(() => {
    loadSettings();
    
    // Check for environment variable in development
    const envApiKey = import.meta.env.VITE_FDC_API_KEY;
    if (envApiKey && !apiKey) {
      setApiKey(envApiKey);
      setTempApiKey(envApiKey);
    }
  }, []);
  
  const loadSettings = async () => {
    try {
      const allSettings = await db.settings.toArray();
      if (allSettings.length > 0) {
        const currentSettings = allSettings[0];
        setSettings(currentSettings);
        setApiKey(currentSettings.fdcApiKey || '');
        setTempApiKey(currentSettings.fdcApiKey || '');
      } else {
        // Initialize default settings
        const defaultSettings: SettingsType = {
          id: 'user-settings',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          enableUSDALookups: false,
          enableWebLLMCoach: false
        };
        await db.settings.add(defaultSettings);
        setSettings(defaultSettings);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const saveSettings = async () => {
    if (!settings) return;
    
    setIsSaving(true);
    try {
      const updatedSettings: SettingsType = {
        ...settings,
        fdcApiKey: tempApiKey || undefined,
        enableUSDALookups: !!(tempApiKey && tempApiKey.trim()),
        updatedAt: new Date().toISOString()
      };
      
      await db.settings.put(updatedSettings);
      setSettings(updatedSettings);
      setApiKey(tempApiKey || '');
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setIsSaving(false);
    }
  };
  
  const toggleWebLLMCoach = async () => {
    if (!settings) return;
    
    try {
      const updatedSettings: SettingsType = {
        ...settings,
        enableWebLLMCoach: !settings.enableWebLLMCoach,
        updatedAt: new Date().toISOString()
      };
      
      await db.settings.put(updatedSettings);
      setSettings(updatedSettings);
    } catch (error) {
      console.error('Failed to toggle WebLLM coach:', error);
    }
  };
  
  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
        <p className="text-gray-600">
          Configure your integrations and preferences. All settings are stored locally in your browser.
        </p>
      </div>
      
      <div className="space-y-6">
        {/* USDA FoodData Central Settings */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Key className="h-5 w-5 text-primary-600" />
              <h2 className="text-xl font-semibold text-gray-900">USDA FoodData Central</h2>
            </div>
            <p className="text-gray-600 text-sm">
              Search the USDA FoodData Central database for nutritional information. 
              Requires a free API key from USDA.
            </p>
          </div>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="fdc-api-key" className="block text-sm font-medium text-gray-700 mb-2">
                API Key
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  id="fdc-api-key"
                  value={tempApiKey}
                  onChange={(e) => setTempApiKey(e.target.value)}
                  placeholder="Enter your USDA FDC API key"
                  className="w-full px-4 py-2 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  {showApiKey ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              <div className="mt-2 text-sm text-gray-600">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 text-yellow-500" />
                  <div>
                    <p>Your API key is stored locally and never uploaded to our servers.</p>
                    <p className="mt-1">
                      Get your free key at{' '}
                      <a 
                        href="https://fdc.nal.usda.gov/data-key-access.html" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary-600 hover:text-primary-700 underline"
                      >
                        USDA FoodData Central
                      </a>
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            {apiKey && (
              <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="text-green-700 text-sm">USDA lookups are enabled</span>
              </div>
            )}
          </div>
        </div>
        
        {/* WebLLM AI Coach Settings */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="h-5 w-5 text-primary-600" />
              <h2 className="text-xl font-semibold text-gray-900">WebLLM AI Coach</h2>
            </div>
            <p className="text-gray-600 text-sm">
              Enable the in-browser AI coach powered by WebLLM. Runs entirely in your browser for privacy.
              Requires WebGPU support and may download models on first use.
            </p>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-900">Enable AI Coach</div>
                <div className="text-sm text-gray-600">
                  Allow the AI coach to generate and modify workout plans
                </div>
              </div>
              <button
                onClick={toggleWebLLMCoach}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings?.enableWebLLMCoach ? 'bg-primary-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings?.enableWebLLMCoach ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            
            {settings?.enableWebLLMCoach && (
              <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg">
                <AlertCircle className="h-4 w-4 mt-0.5 text-blue-600" />
                <div className="text-blue-700 text-sm">
                  <p>AI Coach will load models when you first open the Coach page.</p>
                  <p className="mt-1">This may take a few moments on first use.</p>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Storage Information */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="h-5 w-5 text-primary-600" />
            <h2 className="text-xl font-semibold text-gray-900">Privacy & Storage</h2>
          </div>
          <div className="space-y-3 text-sm text-gray-600">
            <p>
              • All settings are stored locally in your browser using IndexedDB
            </p>
            <p>
              • No data is sent to external servers except for API calls you explicitly enable
            </p>
            <p>
              • API keys are never committed to the repository or shared
            </p>
            <p>
              • You can export your data at any time from the Privacy settings
            </p>
          </div>
        </div>
      </div>
      
      {/* Save Button */}
      <div className="mt-8 flex justify-end">
        <button
          onClick={saveSettings}
          disabled={isSaving}
          className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSaving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}