import { useState, useEffect } from 'react';
import { Shield, Eye, EyeOff, Key, Brain, AlertCircle, CheckCircle2, X, Monitor, GitBranch, Clock, Package, Activity, Cpu, Zap, RefreshCw } from 'lucide-react';
import { Settings as SettingsType } from '@/types';
import { db } from '@/db';
import { webllmService } from '@/lib/webllm-service';

export default function Settings() {
  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [tempApiKey, setTempApiKey] = useState('');
  const [showSaveToast, setShowSaveToast] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [webgpuAvailable, setWebgpuAvailable] = useState(false);
  const [swControllerStatus, setSwControllerStatus] = useState<boolean | null>(null);
  const [buildInfo, setBuildInfo] = useState<typeof __BUILD_INFO__ | null>(null);
  const [webGPUDiagnostics, setWebGPUDiagnostics] = useState<any>(null);
  const [webLLMStatus, setWebLLMStatus] = useState<any>(null);
  
  useEffect(() => {
    loadSettings();
    checkWebGPU();
    loadAIDiagnostics();
    loadBuildInfo();
    checkServiceWorkerController();
    
    // Check for environment variable in development
    const envApiKey = import.meta.env.VITE_FDC_API_KEY;
    if (envApiKey && !apiKey) {
      setApiKey(envApiKey);
      setTempApiKey(envApiKey);
    }
  }, []);
  
  const loadBuildInfo = () => {
    try {
      // Build info is injected at build time
      setBuildInfo(__BUILD_INFO__);
    } catch (error) {
      console.error('Failed to load build info:', error);
    }
  };

  const checkServiceWorkerController = () => {
    try {
      if ('serviceWorker' in navigator) {
        setSwControllerStatus(!!navigator.serviceWorker.controller);
        
        // Listen for controller changes
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          setSwControllerStatus(!!navigator.serviceWorker.controller);
        });
      } else {
        setSwControllerStatus(false);
      }
    } catch (error) {
      console.error('Failed to check SW controller:', error);
      setSwControllerStatus(false);
    }
  };

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
  
  const checkWebGPU = async () => {
    try {
      const available = 'gpu' in navigator && await (navigator as any).gpu?.requestAdapter();
      setWebgpuAvailable(!!available);
    } catch (error) {
      console.error('WebGPU detection failed:', error);
      setWebgpuAvailable(false);
    }
  };

  const loadAIDiagnostics = async () => {
    // Comprehensive WebGPU diagnostics
    const gpuInfo: any = {
      navigatorGPU: typeof navigator !== 'undefined' && 'gpu' in navigator,
      adapter: null,
      adapterError: null,
      device: null,
      deviceError: null,
      lastChecked: new Date().toISOString()
    };

    if (gpuInfo.navigatorGPU) {
      try {
        const adapter = await (navigator as any).gpu?.requestAdapter();
        if (adapter) {
          const adapterInfo = await adapter.requestAdapterInfo();
          gpuInfo.adapter = {
            vendor: adapterInfo.vendor || 'Unknown',
            architecture: adapterInfo.architecture || 'Unknown',
            device: adapterInfo.device || 'Unknown',
            description: adapterInfo.description || ''
          };
          adapter.destroy?.();
        } else {
          gpuInfo.adapterError = 'No GPU adapter available';
        }
      } catch (error: any) {
        gpuInfo.adapterError = error?.message || 'Failed to request GPU adapter';
      }
    } else {
      gpuInfo.adapterError = 'navigator.gpu not available';
    }

    setWebGPUDiagnostics(gpuInfo);

    // WebLLM status
    try {
      const enabled = await webllmService.isWebLLMEnabled();
      const lastError = await webllmService.getLastError();
      const selectedModel = await webllmService.getSelectedModelId();
      
      setWebLLMStatus({
        enabled,
        lastError: lastError?.message || null,
        selectedModel,
        checkedAt: new Date().toISOString()
      });
    } catch (error: any) {
      setWebLLMStatus({
        enabled: false,
        lastError: error?.message || 'Failed to check WebLLM status',
        selectedModel: null,
        checkedAt: new Date().toISOString()
      });
    }
  };

  const refreshAIDiagnostics = async () => {
    await loadAIDiagnostics();
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
      setSaveMessage('Settings saved successfully!');
      setShowSaveToast(true);
      
      // Log success in development
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Settings saved:', {
          hasApiKey: !!updatedSettings.fdcApiKey,
          usdaEnabled: updatedSettings.enableUSDALookups,
          webllmEnabled: updatedSettings.enableWebLLMCoach,
          timestamp: updatedSettings.updatedAt
        });
      }
      
      // Hide toast after 3 seconds
      setTimeout(() => setShowSaveToast(false), 3000);
      
    } catch (error) {
      console.error('Failed to save settings:', error);
      setSaveMessage('Failed to save settings. Please try again.');
      setShowSaveToast(true);
      
      setTimeout(() => setShowSaveToast(false), 5000);
    } finally {
      setIsSaving(false);
    }
  };
  
  const toggleWebLLMCoach = async () => {
    if (!settings) return;
    
    // Check WebGPU availability before enabling
    if (!settings.enableWebLLMCoach && !webgpuAvailable) {
      setSaveMessage('WebGPU is not available in your browser. WebLLM requires WebGPU support.');
      setShowSaveToast(true);
      setTimeout(() => setShowSaveToast(false), 5000);
      return;
    }
    
    try {
      const updatedSettings: SettingsType = {
        ...settings,
        enableWebLLMCoach: !settings.enableWebLLMCoach,
        updatedAt: new Date().toISOString()
      };
      
      await db.settings.put(updatedSettings);
      setSettings(updatedSettings);
      setSaveMessage(
        updatedSettings.enableWebLLMCoach 
          ? 'WebLLM Coach enabled. Models will load when you visit the Coach page.'
          : 'WebLLM Coach disabled.'
      );
      setShowSaveToast(true);
      
      setTimeout(() => setShowSaveToast(false), 3000);
      
    } catch (error) {
      console.error('Failed to toggle WebLLM coach:', error);
      setSaveMessage('Failed to toggle WebLLM Coach.');
      setShowSaveToast(true);
      
      setTimeout(() => setShowSaveToast(false), 5000);
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
              <div className="flex-1">
                <div className="font-medium text-gray-900">Enable AI Coach</div>
                <div className="text-sm text-gray-600">
                  Allow the AI coach to generate and modify workout plans
                </div>
                {!webgpuAvailable && (
                  <div className="mt-2 flex items-center gap-2 text-sm text-orange-600">
                    <AlertCircle className="h-4 w-4" />
                    <span>WebGPU not available - requires WebGPU-enabled browser</span>
                  </div>
                )}
                {webgpuAvailable && (
                  <div className="mt-2 flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>WebGPU support detected</span>
                  </div>
                )}
              </div>
              <button
                onClick={toggleWebLLMCoach}
                disabled={!webgpuAvailable && !settings?.enableWebLLMCoach}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  !webgpuAvailable && !settings?.enableWebLLMCoach
                    ? 'bg-gray-100 cursor-not-allowed'
                    : settings?.enableWebLLMCoach 
                    ? 'bg-primary-600' 
                    : 'bg-gray-200'
                }`}
                title={!webgpuAvailable && !settings?.enableWebLLMCoach ? 'WebGPU not available' : ''}
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
                  <p className="mt-1">
                    <a 
                      href="https://caniuse.com/webgpu" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-700 underline"
                    >
                      Check WebGPU browser compatibility
                    </a>
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* AI Diagnostics Panel */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Cpu className="h-5 w-5 text-primary-600" />
              <h2 className="text-xl font-semibold text-gray-900">AI Diagnostics</h2>
            </div>
            <button
              onClick={refreshAIDiagnostics}
              className="btn btn-secondary btn-sm flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
          
          <div className="space-y-4">
            {/* WebGPU Status */}
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-gray-900 flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  WebGPU Capability
                </h3>
                {webGPUDiagnostics?.navigatorGPU ? (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 text-xs rounded-full">
                    <CheckCircle2 className="h-3 w-3" />
                    Available
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-50 text-red-700 text-xs rounded-full">
                    <X className="h-3 w-3" />
                    Not Available
                  </span>
                )}
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">navigator.gpu:</span>
                  <span className={webGPUDiagnostics?.navigatorGPU ? 'text-green-600' : 'text-red-600'}>
                    {webGPUDiagnostics?.navigatorGPU ? 'EXISTS' : 'MISSING'}
                  </span>
                </div>
                
                {webGPUDiagnostics?.adapter ? (
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                    <div className="font-medium text-gray-900 mb-2">GPU Adapter Info:</div>
                    <div className="space-y-1 text-xs text-gray-600">
                      <div className="flex justify-between">
                        <span>Vendor:</span>
                        <span className="font-mono">{webGPUDiagnostics.adapter.vendor}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Device:</span>
                        <span className="font-mono">{webGPUDiagnostics.adapter.device}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Architecture:</span>
                        <span className="font-mono">{webGPUDiagnostics.adapter.architecture}</span>
                      </div>
                      {webGPUDiagnostics.adapter.description && (
                        <div className="mt-2 pt-2 border-t border-gray-200">
                          <span className="text-gray-500">{webGPUDiagnostics.adapter.description}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  webGPUDiagnostics?.adapterError && (
                    <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                      <div className="flex items-start gap-2 text-red-700">
                        <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="font-medium mb-1">WebGPU Error:</div>
                          <div className="text-sm">{webGPUDiagnostics.adapterError}</div>
                        </div>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
            
            {/* WebLLM Status */}
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-gray-900 flex items-center gap-2">
                  <Brain className="h-4 w-4" />
                  WebLLM Status
                </h3>
                {webLLMStatus?.enabled ? (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full">
                    <CheckCircle2 className="h-3 w-3" />
                    Enabled
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-50 text-gray-700 text-xs rounded-full">
                    <X className="h-3 w-3" />
                    Disabled
                  </span>
                )}
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">AI Coach:</span>
                  <span className={webLLMStatus?.enabled ? 'text-blue-600' : 'text-gray-600'}>
                    {webLLMStatus?.enabled ? 'ENABLED' : 'DISABLED'}
                  </span>
                </div>
                
                {webLLMStatus?.selectedModel && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Selected Model:</span>
                    <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                      {webLLMStatus.selectedModel}
                    </span>
                  </div>
                )}
                
                {webLLMStatus?.lastError && (
                  <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                    <div className="flex items-start gap-2 text-yellow-700">
                      <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-medium mb-1">Last Error:</div>
                        <div className="text-sm">{webLLMStatus.lastError}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* WebGPU Troubleshooting */}
            {!webGPUDiagnostics?.navigatorGPU && (
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  How to Enable WebGPU
                </h4>
                <ul className="space-y-2 text-sm text-blue-800">
                  <li>
                    <strong>Chrome/Edge:</strong> Update to the latest version. WebGPU is enabled by default in Chrome 113+.
                  </li>
                  <li>
                    <strong>Firefox:</strong> navigate to about:config and set dom.webgpu.enabled to true.
                  </li>
                  <li>
                    <strong>Hardware Acceleration:</strong> Make sure graphics acceleration is enabled in your browser settings.
                  </li>
                  <li>
                    <strong>Restart:</strong> After making changes, restart your browser completely.
                  </li>
                </ul>
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
      
      {/* Toast Notification */}
      {showSaveToast && (
        <div className="fixed bottom-4 right-4 flex items-center gap-3 p-4 rounded-lg shadow-lg z-50 animate-pulse bg-white border border-gray-200">
          <div className="flex items-center gap-2">
            {saveMessage.includes('successfully') || saveMessage.includes('enabled') ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            ) : (
              <AlertCircle className="h-5 w-5 text-yellow-600" />
            )}
            <span className={`text-sm ${
              saveMessage.includes('successfully') || saveMessage.includes('enabled') 
                ? 'text-green-700' 
                : 'text-yellow-700'
            }`}>
              {saveMessage}
            </span>
          </div>
          <button
            onClick={() => setShowSaveToast(false)}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      
      {/* Build Information - Always Visible */}
      {buildInfo && (
        <div className="mt-8 bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-blue-600">Build Information</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-gray-400" />
              <div>
                <div className="font-medium text-gray-900">Commit SHA</div>
                <div className="text-gray-600 font-mono">{buildInfo.commitSha}</div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-400" />
              <div>
                <div className="font-medium text-gray-900">Build Time</div>
                <div className="text-gray-600">{new Date(buildInfo.buildTimestamp).toLocaleString()}</div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-gray-400" />
              <div>
                <div className="font-medium text-gray-900">App Version</div>
                <div className="text-gray-600">v{buildInfo.appVersion}</div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-gray-400" />
              <div>
                <div className="font-medium text-gray-900">Build Run</div>
                <div className="text-gray-600 font-mono">#{buildInfo.buildRun || 'dev'}</div>
              </div>
            </div>
            
            <div className="flex items-center gap-2 md:col-span-2">
              <Activity className="h-4 w-4 text-gray-400" />
              <div>
                <div className="font-medium text-gray-900">Service Worker</div>
                <div className="flex items-center gap-2">
                  {swControllerStatus === null ? (
                    <span className="text-gray-500">Checking...</span>
                  ) : swControllerStatus ? (
                    <>
                      <span className="text-green-600">Active</span>
                      <span className="text-gray-500 text-xs">(controlling page)</span>
                    </>
                  ) : (
                    <>
                      <span className="text-orange-600">Inactive</span>
                      <span className="text-gray-500 text-xs">(not controlling)</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2 md:col-span-2">
              <div className="flex-1">
                <div className="font-medium text-gray-900">Environment</div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    buildInfo.isProduction 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {buildInfo.isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}
                  </span>
                  {buildInfo.isProduction && !swControllerStatus && (
                    <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700">
                      SW Disabled (Temporary)
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* DEV-only Diagnostics */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-8 bg-gray-900 text-gray-100 rounded-lg p-6 font-mono text-sm">
          <div className="flex items-center gap-2 mb-4">
            <Monitor className="h-5 w-5 text-green-400" />
            <h2 className="text-lg font-semibold text-green-400">Development Diagnostics</h2>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400">WebGPU Available:</span>
              <span className={webgpuAvailable ? 'text-green-400' : 'text-red-400'}>
                {webgpuAvailable ? 'YES' : 'NO'}
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-400">navigator.gpu:</span>
              <span className="text-yellow-400">
                {typeof navigator !== 'undefined' && 'gpu' in navigator ? 'EXISTS' : 'MISSING'}
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-400">FDC API Key Set:</span>
              <span className={apiKey ? 'text-green-400' : 'text-gray-400'}>
                {apiKey ? 'YES (' + apiKey.length + ' chars)' : 'NO'}
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-400">USDA Lookups Enabled:</span>
              <span className={settings?.enableUSDALookups ? 'text-green-400' : 'text-gray-400'}>
                {settings?.enableUSDALookups ? 'YES' : 'NO'}
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-400">WebLLM Coach Enabled:</span>
              <span className={settings?.enableWebLLMCoach ? 'text-green-400' : 'text-gray-400'}>
                {settings?.enableWebLLMCoach ? 'YES' : 'NO'}
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-400">Last Updated:</span>
              <span className="text-blue-400">
                {settings?.updatedAt ? new Date(settings.updatedAt).toLocaleTimeString() : 'NEVER'}
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-400">Storage Backend:</span>
              <span className="text-purple-400">IndexedDB</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}