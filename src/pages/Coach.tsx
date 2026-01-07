import { useState, useEffect } from 'react';
import { repositories } from '../db';
import { calculateTDEE, calculateMacroTargets, generateWorkoutPlan } from '../lib/coach-engine';
import { webllmService } from '../lib/webllm-service';
import { formatWeight } from '../lib/unit-conversions';
import { getWebGPUDiagnostics } from '../ai/webgpu';
import { validateAndRepairModelId, getAvailableModels } from '../ai/webllmConfig';
import { Brain, Send, Loader2, AlertCircle } from 'lucide-react';
import type { Profile, WorkoutPlan } from '../types';

export default function Coach() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [currentPlan, setCurrentPlan] = useState<WorkoutPlan | null>(null);
  const [tdee, setTdee] = useState<{ bmr: number; tdee: number } | null>(null);
  const [macroTargets, setMacroTargets] = useState<any>(null);
  const [generatedPlan, setGeneratedPlan] = useState<WorkoutPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [selectedGoalId, setSelectedGoalId] = useState<string>('');
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [exercises, setExercises] = useState<any[]>([]);
  const [webllmEnabled, setWebLLMEnabled] = useState(false);
  const [webllmModelLoading, setWebLLMModelLoading] = useState(false);
  const [webllmModelReady, setWebLLMModelReady] = useState(false);
  const [showAIChat, setShowAIChat] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [chatMessages, setChatMessages] = useState<{role: 'user' | 'assistant'; content: string}[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [webllmError, setWebLLMError] = useState<string | null>(null);
  const [availableModels, setAvailableModels] = useState<any[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [hasWebGPU, setHasWebGPU] = useState<boolean | null>(null);
  const [webGPUChecked, setWebGPUChecked] = useState(false);
  const [modelValidationWarning, setModelValidationWarning] = useState<string | null>(null);
  
  const [checkIn, setCheckIn] = useState({
    adherenceRating: 3,
    energyLevel: 3,
    sleepQuality: 3,
    soreness: 3,
    notes: ''
  });

  useEffect(() => {
    loadCoachData();
    loadWebLLMStatus();
    checkWebGPUSupport();
    
    // Load chat history from localStorage
    loadChatHistory();
  }, []);
  
  useEffect(() => {
    // Only load models when WebLLM is enabled AND WebGPU is available
    if (webllmEnabled && hasWebGPU && availableModels.length === 0) {
      loadWebLLMModels();
    }
    
    // If WebLLM enabled but no WebGPU, show clear message
    if (webllmEnabled && hasWebGPU === false) {
      setWebLLMError('WebGPU is not available in your browser. AI Coach requires WebGPU support. Please use Chrome, Edge, or another WebGPU-enabled browser.');
    }
  }, [webllmEnabled, hasWebGPU]);

  const checkWebGPUSupport = async () => {
    try {
      // Use the ultra-safe diagnostics function that never throws
      const diagnostics = await getWebGPUDiagnostics();
      
      setHasWebGPU(diagnostics.ok && diagnostics.adapterAcquired);
      console.log('[Coach] WebGPU diagnostics:', diagnostics);
      
      // Set error if adapter available but device not
      if (diagnostics.adapterAcquired && !diagnostics.deviceAcquired) {
        setWebLLMError(
          `WebGPU adapter found but device request failed: ${diagnostics.errorDetails || diagnostics.error}`
        );
      }
    } catch (error) {
      console.error('[Coach] Error checking WebGPU support:', error);
      setHasWebGPU(false);
    } finally {
      setWebGPUChecked(true);
    }
  };

  const loadWebLLMStatus = async () => {
    try {
      const enabled = await webllmService.isWebLLMEnabled();
      setWebLLMEnabled(enabled);
    } catch (error) {
      console.error('Failed to load WebLLM status:', error);
      setWebLLMEnabled(false);
    }
  };

  const loadWebLLMModels = async () => {
    try {
      const models = getAvailableModels();
      setAvailableModels(models);
      console.log('[Coach] Available models:', models.length, 'models loaded');
      
      // Get and validate the selected model ID (with auto-repair)
      const currentModel = await webllmService.getSelectedModelId();
      setSelectedModelId(currentModel);
      
      // Validate model and check if it was auto-repaired
      const validation = validateAndRepairModelId(currentModel);
      if (validation.wasRepaired) {
        console.warn('[Coach] Model ID was auto-repaired:', validation.error);
        setModelValidationWarning(`AI model selection was reset to a supported default (${validation.selectedModelId}).`);
      }
      
      // If no models available, show appropriate warning
      if (models.length === 0) {
        setModelValidationWarning('No WebLLM models are available. Please check your browser compatibility.');
      }
    } catch (error) {
      console.error('[Coach] Failed to load WebLLM models:', error);
      setModelValidationWarning('Failed to load WebLLM models. Please try refreshing the page or check your browser compatibility.');
    }
  };

  const handleModelChange = async (modelId: string) => {
    try {
      const model = availableModels.find(m => m.model_id === modelId);
      if (!model) {
        throw new Error(`Model "${modelId}" not found in available models`);
      }
      
      setModelValidationWarning(null);
      await webllmService.setSelectedModelId(modelId);
      setSelectedModelId(modelId);
      console.log('Model changed to:', modelId);
      
      // If model was already loaded, we might need to reload the engine
      if (webllmModelReady) {
        setModelValidationWarning(`Model selection updated to "${modelId}". Reloading AI engine...`);
        // The user might need to reinitialize if the engine was already loaded
        setWebLLMModelReady(false);
      }
    } catch (error) {
      console.error('Failed to change model:', error);
      setWebLLMError(error instanceof Error ? error.message : 'Failed to change model');
    }
  };

  const loadCoachData = async () => {
    try {
      const userProfile = await repositories.profile.get();
      setProfile(userProfile || null);

      if (userProfile) {
        // Load current workout plan
        const plans = await repositories.workout.getWorkoutPlans();
        if (plans.length > 0) {
          setCurrentPlan(plans[0]);
        }

        // Calculate TDEE and macros
        const tdeeResult = calculateTDEE(userProfile);
        setTdee(tdeeResult);
        
        const macros = calculateMacroTargets(userProfile, tdeeResult.tdee);
        setMacroTargets(macros);
        
        // Set default selected goal (first one or highest priority)
        if (userProfile.goals.length > 0) {
          const highestPriorityGoal = userProfile.goals.reduce((prev, current) => 
            (prev.priority > current.priority) ? prev : current
          );
          setSelectedGoalId(highestPriorityGoal.id);
        }
        
        // Load exercise data for names
        try {
          const exercisesResponse = await fetch('/src/assets/data/exercises.seed.json');
          const exercisesData = await exercisesResponse.json();
          setExercises(exercisesData);
        } catch (error) {
          console.warn('Failed to load exercises data:', error);
        }
      }
    } catch (error) {
      console.error('Failed to load coach data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getExerciseName = (exerciseId: string): string => {
    const exercise = exercises.find(ex => ex.id === exerciseId);
    return exercise?.name || `Exercise ${exerciseId}`;
  };

  const generateNewPlan = async () => {
    if (!profile) return;

    setGenerating(true);
    setGenerationError(null);
    try {
      console.log('Generating workout plan for profile:', profile.id, 'goal:', selectedGoalId);
      const newPlan = generateWorkoutPlan(profile, selectedGoalId);
      console.log('Workout plan generated successfully:', newPlan.name);
      setGeneratedPlan(newPlan);
    } catch (error) {
      console.error('Failed to generate plan:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setGenerationError(`Failed to generate workout plan: ${errorMessage}`);
      
      // In development, show more details
      if (process.env.NODE_ENV === 'development') {
        console.error('Plan generation failure details:', {
          profile: profile,
          selectedGoalId,
          error,
          stack: error instanceof Error ? error.stack : 'No stack trace'
        });
      }
    } finally {
      setGenerating(false);
    }
  };

  const saveGeneratedPlan = async () => {
    if (!generatedPlan) return;

    try {
      console.log('Saving workout plan:', generatedPlan);
      
      // Validate the plan structure before saving
      if (!generatedPlan.name || !generatedPlan.weeks || generatedPlan.weeks.length === 0) {
        throw new Error('Invalid workout plan structure');
      }
      
      const savedPlan = await repositories.workout.createWorkoutPlan(generatedPlan);
      console.log('Workout plan saved successfully:', savedPlan.id);
      
      setCurrentPlan(savedPlan);
      setGeneratedPlan(null);
      
      // Show success message instead of alert
      const successDiv = document.createElement('div');
      successDiv.className = 'fixed top-4 right-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg z-50';
      successDiv.innerHTML = '✓ Workout plan saved successfully!';
      document.body.appendChild(successDiv);
      setTimeout(() => document.body.removeChild(successDiv), 3000);
    } catch (error) {
      console.error('Failed to save plan:', error);
      
      // Enhanced error reporting
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorDetails = {
        errorMessage,
        planStructure: {
          hasName: !!generatedPlan.name,
          hasWeeks: !!generatedPlan.weeks,
          weekCount: generatedPlan.weeks?.length || 0,
          firstWeekWorkouts: generatedPlan.weeks?.[0]?.workouts?.length || 0
        }
      };
      
      console.error('Plan save error details:', errorDetails);
      
      // Show error in UI instead of alert
      const errorDiv = document.createElement('div');
      errorDiv.className = 'fixed top-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg z-50';
      errorDiv.innerHTML = `✗ Failed to save workout plan: ${errorMessage}`;
      document.body.appendChild(errorDiv);
      setTimeout(() => document.body.removeChild(errorDiv), 5000);
    }
  };

  const submitCheckIn = async () => {
    try {
      await repositories.progress.createWeeklyCheckIn({
        id: crypto.randomUUID(),
        ...checkIn,
        createdAt: new Date().toISOString()
      });
      
      alert('Weekly check-in submitted successfully!');
      setShowCheckIn(false);
      setCheckIn({
        adherenceRating: 3,
        energyLevel: 3,
        sleepQuality: 3,
        soreness: 3,
        notes: ''
      });
    } catch (error) {
      console.error('Failed to submit check-in:', error);
      alert('Failed to submit check-in. Please try again.');
    }
  };
  
  const initializeWebLLM = async () => {
    // Check WebGPU availability first
    if (hasWebGPU === false) {
      setWebLLMError('WebGPU is not available in your browser. AI Coach requires WebGPU support.');
      return;
    }
    
    setWebLLMModelLoading(true);
    setWebLLMError(null);
    setModelValidationWarning(null);
    
    try {
      // Set up progress callback for better UX
      webllmService.setInitProgressCallback((progress) => {
        console.log('WebLLM init progress:', progress);
        // Could show progress details to user if needed
      });
      
      await webllmService.initialize();
      setWebLLMModelReady(true);
      
      // Check if the loaded model matches what we expected
      const engineState = webllmService.getEngineState();
      const selectedModel = availableModels.find(m => m.model_id === selectedModelId);
      
      if (!selectedModel || !availableModels.some(m => m.model_id === engineState.selectedModelId)) {
        setModelValidationWarning(`Model loaded: ${engineState.selectedModelId}`);
      }
    } catch (error) {
      console.error('Failed to initialize WebLLM:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to initialize AI model';
      setWebLLMError(errorMessage);
      
      // Ensure model loading state is reset on error
      setWebLLMModelReady(false);
      
      // Try to detect specific issues for better user guidance
      if (errorMessage.includes('WebGPU') || errorMessage.includes('gpu')) {
        setWebLLMError('WebGPU is not available in your browser. AI Coach requires WebGPU support. Please use Chrome, Edge, or another WebGPU-enabled browser.');
      } else if (errorMessage.includes('disabled')) {
        setWebLLMError('WebLLM Coach is disabled. Please enable it in Settings.');
      } else if (errorMessage.includes('model') || errorMessage.includes('model_id')) {
        setWebLLMError('The AI model could not be loaded. Please try selecting a different model or refresh the page.');
      }
    } finally {
      webllmService.clearInitProgressCallback();
      setWebLLMModelLoading(false);
    }
  };
  
  const loadChatHistory = () => {
    try {
      const saved = localStorage.getItem('ai-coach-chat-history');
      if (saved) {
        const parsed = JSON.parse(saved);
        setChatMessages(parsed.messages || []);
        setShowAIChat(parsed.messages && parsed.messages.length > 0);
      }
    } catch (error) {
      console.warn('Failed to load chat history:', error);
    }
  };
  
  const saveChatHistory = (messages: typeof chatMessages) => {
    try {
      localStorage.setItem('ai-coach-chat-history', JSON.stringify({
        messages,
        savedAt: new Date().toISOString()
      }));
    } catch (error) {
      console.warn('Failed to save chat history:', error);
    }
  };
  
  const clearChatHistory = () => {
    setChatMessages([]);
    setShowAIChat(false);
    localStorage.removeItem('ai-coach-chat-history');
  };
  
  const sendMessage = async () => {
    if (!chatMessage.trim() || !webllmModelReady) return;
    
    const userMessage = chatMessage;
    setChatMessage('');
    setChatLoading(true);
    
    // Add user message to chat
    const updatedMessages = [...chatMessages, { role: 'user' as const, content: userMessage }];
    setChatMessages(updatedMessages);
    saveChatHistory(updatedMessages);
    
    try {
      const response = await webllmService.sendMessage(userMessage, profile!, currentPlan || undefined);
      const finalMessages = [...updatedMessages, { role: 'assistant' as const, content: response }];
      setChatMessages(finalMessages);
      saveChatHistory(finalMessages);
    } catch (error) {
      console.error('Failed to send message to AI:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorMessages = [...updatedMessages, { 
        role: 'assistant' as const, 
        content: `I apologize, but I encountered an error: ${errorMessage}. Please try again or check if WebGPU is available.`
      }];
      setChatMessages(errorMessages);
      saveChatHistory(errorMessages);
    } finally {
      setChatLoading(false);
    }
  };
  
  const generateWithWebLLM = async () => {
    if (!profile || !webllmModelReady) return;
    
    setGenerating(true);
    setGenerationError(null);
    try {
      const newPlan = await webllmService.generateWorkoutPlan(profile);
      if (newPlan) {
        setGeneratedPlan(newPlan);
      } else {
        throw new Error('AI failed to generate a valid workout plan');
      }
    } catch (error) {
      console.error('Failed to generate plan with WebLLM:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setGenerationError(`AI plan generation failed: ${errorMessage}`);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">Loading coach...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="card text-center py-12">
          <h2 className="text-xl font-medium text-gray-900 mb-4">Profile Required</h2>
          <p className="text-gray-600 mb-6">Please complete your profile to get personalized coaching</p>
          <a href="#/profile" className="btn btn-primary">
            Go to Profile
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">AI Coach</h1>
        <p className="mt-2 text-gray-600">Your personal training assistant</p>
      </div>

      <div className="space-y-6">
        {/* WebGPU Status Warning */}
        {webllmEnabled && webGPUChecked && hasWebGPU === false && (
          <div className="card bg-red-50 border-red-200">
            <div className="flex items-start">
              <AlertCircle className="w-5 h-5 text-red-600 mr-3 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-medium text-red-900">WebGPU Not Available</h3>
                <p className="text-sm text-red-700 mt-1">
                  The AI Coach requires WebGPU support, which is not available in your current browser. 
                  Please use Chrome, Edge, or another WebGPU-enabled browser.
                </p>
                <a 
                  href="https://caniuse.com/webgpu" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs text-red-600 hover:text-red-800 underline mt-2 inline-block"
                >
                  Check WebGPU browser support →
                </a>
              </div>
            </div>
          </div>
        )}
        
        {/* AI Coach Section */}
        {webllmEnabled && (
          <div className="card">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-medium text-gray-900">AI Coach Chat</h2>
              <div className="flex items-center space-x-2">
                {!webllmModelReady && !webllmModelLoading && (
                  <>
                    <select
                      value={selectedModelId}
                      onChange={(e) => handleModelChange(e.target.value)}
                      className="input text-sm max-w-xs"
                      disabled={availableModels.length === 0}
                    >
                      {availableModels.length === 0 && (
                        <option value="">Loading models...</option>
                      )}
                      {availableModels.map((model) => (
                        <option key={model.model_id} value={model.model_id}>
                          {model.model_id}
                          {model.low_resource_required && ' (Low Resource)'}
                          {model.required_features.length > 0 && ' (Requires: ' + model.required_features.join(', ') + ')'}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={initializeWebLLM}
                      className="btn btn-primary text-sm"
                      disabled={availableModels.length === 0}
                    >
                      <Brain className="w-4 h-4 mr-1" />
                      Load AI Coach
                    </button>
                  </>
                )}
                {webllmModelLoading && (
                  <div className="flex items-center text-sm text-gray-600">
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    Loading AI Model...
                  </div>
                )}
                {webllmModelReady && (
                  <>
                    <select
                      value={selectedModelId}
                      onChange={(e) => handleModelChange(e.target.value)}
                      className="input text-sm max-w-xs"
                    >
                      {availableModels.map((model) => (
                        <option key={model.model_id} value={model.model_id}>
                          {model.model_id}
                        </option>
                      ))}
                    </select>
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      AI Ready
                    </span>
                  </>
                )}
              </div>
            </div>
            
            {/* Model Validation Warning */}
            {modelValidationWarning && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start">
                  <AlertCircle className="w-4 h-4 mt-0.5 text-yellow-600 mr-2" />
                  <div className="text-sm text-yellow-800">
                    <div className="font-medium">Model Selection Issue</div>
                    <div>{modelValidationWarning}</div>
                    <button
                      onClick={() => setModelValidationWarning(null)}
                      className="text-xs text-yellow-600 hover:text-yellow-800 underline mt-1"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {/* DEV Diagnostics Panel */}
            {process.env.NODE_ENV === 'development' && (
              <div className="mb-4 p-3 bg-gray-900 text-gray-100 border border-gray-700 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="text-sm font-medium text-green-400">DEV Diagnostics</h4>
                  <button
                    onClick={() => setShowDiagnostics(!showDiagnostics)}
                    className="text-xs text-gray-400 hover:text-gray-200"
                  >
                    {showDiagnostics ? 'Hide' : 'Show'}
                  </button>
                </div>
                {showDiagnostics && (
                  <div className="text-xs monospace space-y-1">
                    <div className="flex justify-between"><span className="text-gray-400">hasWebGPU:</span><span className={hasWebGPU ? 'text-green-400' : 'text-red-400'}>{hasWebGPU === null ? 'CHECKING...' : hasWebGPU ? 'TRUE' : 'FALSE'}</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">selectedModelId:</span><span className="text-yellow-400">{selectedModelId || 'NULL'}</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">modelListCount:</span><span className="text-blue-400">{availableModels.length}</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">modelIdFound:</span><span className={availableModels.some(m => m.model_id === selectedModelId) ? 'text-green-400' : 'text-red-400'}>{availableModels.some(m => m.model_id === selectedModelId) ? 'TRUE' : 'FALSE'}</span></div>
                    
                    {(() => {
                      const engineState = webllmService.getEngineState();
                      return (
                        <>
                          <div className="flex justify-between"><span className="text-gray-400">engineState.isInitialized:</span><span className={engineState.isInitialized ? 'text-green-400' : 'text-red-400'}>{engineState.isInitialized.toString()}</span></div>
                          <div className="flex justify-between"><span className="text-gray-400">engineState.isLoading:</span><span className={engineState.isLoading ? 'text-yellow-400' : 'text-green-400'}>{engineState.isLoading.toString()}</span></div>
                          <div className="flex justify-between"><span className="text-gray-400">engineState.hasEngine:</span><span className={engineState.hasEngine ? 'text-green-400' : 'text-red-400'}>{engineState.hasEngine.toString()}</span></div>
                          <div className="flex justify-between"><span className="text-gray-400">engineState.selectedModelId:</span><span className="text-blue-400">{engineState.selectedModelId || 'NULL'}</span></div>
                        </>
                      );
                    })()}
                    
                    <div className="flex justify-between"><span className="text-gray-400">webllmModelReady:</span><span className={webllmModelReady ? 'text-green-400' : 'text-red-400'}>{webllmModelReady.toString()}</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">webllmModelLoading:</span><span className={webllmModelLoading ? 'text-yellow-400' : 'text-green-400'}>{webllmModelLoading.toString()}</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">webllmEnabled:</span><span className={webllmEnabled ? 'text-green-400' : 'text-red-400'}>{webllmEnabled.toString()}</span></div>
                    
                    {/* DEBUG: Reset button */}
                    <div className="pt-2 border-t border-gray-700">
                      <button
                        onClick={() => {
                          webllmService.reset();
                          setWebLLMModelReady(false);
                          setWebLLMModelLoading(false);
                          setWebLLMError(null);
                          setModelValidationWarning(null);
                          setShowDiagnostics(false);
                        }}
                        className="text-xs text-red-400 hover:text-red-300 underline"
                      >
                        DEBUG: Reset WebLLM Engine
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {webllmError && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start">
                  <AlertCircle className="w-4 h-4 mt-0.5 text-yellow-600 mr-2" />
                  <div className="text-sm text-yellow-800">
                    <div className="font-medium">AI Model Error</div>
                    <div>{webllmError}</div>
                    <button
                      onClick={() => setWebLLMError(null)}
                      className="text-xs text-yellow-600 hover:text-yellow-800 underline mt-1"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {webllmModelReady && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-medium text-gray-900">
                    {showAIChat ? 'Chat with AI Coach' : 'AI Coach'}
                  </h3>
                  {chatMessages.length > 0 && (
                    <button
                      onClick={clearChatHistory}
                      className="text-sm text-gray-500 hover:text-gray-700 underline"
                    >
                      Clear Chat
                    </button>
                  )}
                </div>
                {!showAIChat ? (
                  <div className="text-center py-8">
                    <Brain className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-600 mb-4">
                      Your AI coach is ready! Ask questions about workouts, form, nutrition, or plan modifications.
                    </p>
                    <button
                      onClick={() => setShowAIChat(true)}
                      className="btn btn-primary"
                    >
                      Start Chatting
                    </button>
                  </div>
                ) : (
                  <div className="border rounded-lg">
                    {/* Chat Messages */}
                    <div className="h-96 overflow-y-auto p-4 space-y-4">
                      {chatMessages.length === 0 ? (
                        <div className="text-center text-gray-500 py-8">
                          <p>Start a conversation with your AI coach!</p>
                          <p className="text-sm mt-2">I can help with workout plans, exercise form, nutrition, and more.</p>
                        </div>
                      ) : (
                        chatMessages.map((message, index) => (
                          <div
                            key={index}
                            className={`flex ${
                              message.role === 'user' ? 'justify-end' : 'justify-start'
                            }`}
                          >
                            <div
                              className={`max-w-[80%] p-3 rounded-lg ${
                                message.role === 'user'
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-gray-100 text-gray-900'
                              }`}
                            >
                              <p className="whitespace-pre-wrap">{message.content}</p>
                            </div>
                          </div>
                        ))
                      )}
                      
                      {chatLoading && (
                        <div className="flex justify-start">
                          <div className="bg-gray-100 text-gray-900 p-3 rounded-lg">
                            <div className="flex items-center space-x-2">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>AI coach is thinking...</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Chat Input */}
                    <div className="border-t p-4">
                      <div className="flex space-x-2">
                        <input
                          type="text"
                          value={chatMessage}
                          onChange={(e) => setChatMessage(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                          placeholder="Ask about workouts, nutrition, or fitness advice..."
                          className="input flex-1"
                          disabled={chatLoading}
                        />
                        <button
                          onClick={sendMessage}
                          disabled={!chatMessage.trim() || chatLoading}
                          className="btn btn-primary"
                        >
                          {chatLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Send className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                      <div className="mt-2 flex justify-between">
                        <p className="text-xs text-gray-500">
                          Specialized for fitness coaching only
                        </p>
                        <button
                          onClick={() => {
                            setChatMessages([]);
                            webllmService.clearChatHistory();
                          }}
                          className="text-xs text-gray-500 hover:text-gray-700"
                        >
                          Clear Chat
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        
        {/* Fallback Coach UI when WebLLM is not available */}
        {(!webllmEnabled || webllmError || (hasWebGPU === false)) && (
          <div className="card">
            <div className="flex items-start space-x-4">
              <div className="p-3 bg-blue-100 rounded-full">
                <Brain className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-medium text-gray-900 mb-2">Coach Features</h2>
                
                {hasWebGPU === false && (
                  <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <div className="flex items-start">
                      <AlertCircle className="w-4 h-4 mt-0.5 text-orange-600 mr-2" />
                      <div className="text-sm text-orange-800">
                        <div className="font-medium">WebGPU Required for AI Features</div>
                        <div className="mt-1">
                          Your browser doesn't support WebGPU, which is required for the AI coach. 
                          Please use Chrome, Edge, or another WebGPU-enabled browser.
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {webllmError && (
                  <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-start">
                      <AlertCircle className="w-4 h-4 mt-0.5 text-yellow-600 mr-2" />
                      <div className="text-sm text-yellow-800">
                        <div className="font-medium">AI Features Unavailable</div>
                        <div className="mt-1">{webllmError}</div>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium text-gray-900 mb-2">Available Coach Features:</h3>
                    <ul className="space-y-2 text-sm text-gray-600">
                      <li className="flex items-start">
                        <span className="text-green-500 mr-2">✓</span>
                        <span>Workout plan generation using deterministic algorithms</span>
                      </li>
                      <li className="flex items-start">
                        <span className="text-green-500 mr-2">✓</span>
                        <span>Personalized macro calculations based on your profile</span>
                      </li>
                      <li className="flex items-start">
                        <span className="text-green-500 mr-2">✓</span>
                        <span>Exercise selection based on your equipment and goals</span>
                      </li>
                      <li className="flex items-start">
                        <span className="text-green-500 mr-2">✓</span>
                        <span>Weekly check-ins and progress tracking</span>
                      </li>
                    </ul>
                  </div>
                  
                  {!webllmEnabled && (
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                      <div className="text-sm text-gray-700">
                        <div className="font-medium mb-1">Enable AI Features</div>
                        <div>
                          Go to <a href="/#/settings" className="text-blue-600 hover:text-blue-700 underline">Settings</a> to enable the AI coach for personalized workout advice and plan modifications.
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {hasWebGPU === true && !webllmEnabled && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="text-sm text-green-700">
                        <div className="font-medium mb-1">WebGPU Supported!</div>
                        <div>Your browser supports AI features. Enable the AI Coach in Settings to get started.</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

      {/* Profile Summary */}
        <div className="card">
          <h2 className="text-xl font-medium text-gray-900 mb-4">Your Profile Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="text-sm text-gray-600">Age</div>
              <div className="font-medium">{profile.age || 'Not set'}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Weight</div>
              <div className="font-medium">{formatWeight(profile.weightKg, profile.preferredUnits)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Experience</div>
              <div className="font-medium capitalize">{profile.experienceLevel}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Activity Level</div>
              <div className="font-medium capitalize">{profile.activityLevel.replace('_', ' ')}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Primary Goal</div>
              <div className="font-medium capitalize">
                {profile.goals[0]?.type.replace('_', ' ') || 'Not set'}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Workout Days</div>
              <div className="font-medium">
                {Object.values(profile.schedule).filter(Boolean).length} per week
              </div>
            </div>
          </div>
        </div>

        {/* Nutrition Targets */}
        {macroTargets && (
          <div className="card">
            <h2 className="text-xl font-medium text-gray-900 mb-4">Daily Nutrition Targets</h2>
            <p className="text-sm text-gray-600 mb-4">
              Based on your profile and goals (BMR: {tdee ? Math.round(tdee.bmr) : 0} calories, TDEE: {tdee ? Math.round(tdee.tdee) : 0} calories)
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{macroTargets.calories}</div>
                <div className="text-sm text-gray-600">Calories</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{macroTargets.proteinG}g</div>
                <div className="text-sm text-gray-600">Protein</div>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">{macroTargets.carbsG}g</div>
                <div className="text-sm text-gray-600">Carbs</div>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{macroTargets.fatG}g</div>
                <div className="text-sm text-gray-600">Fat</div>
              </div>
            </div>
          </div>
        )}

        {/* Current Plan */}
        {currentPlan && (
          <div className="card">
            <h2 className="text-xl font-medium text-gray-900 mb-4">Current Workout Plan</h2>
            <div className="mb-4">
              <h3 className="font-medium">{currentPlan.name}</h3>
              <p className="text-sm text-gray-600">{currentPlan.weeks.length} weeks</p>
              {currentPlan.notes && (
                <p className="text-sm text-gray-600 mt-2">{currentPlan.notes}</p>
              )}
            </div>
            
            <div className="space-y-4">
              {currentPlan.weeks[0].workouts.map((workout, index) => (
                <div key={index} className="border-l-4 border-blue-500 pl-4">
                  <h4 className="font-medium">{workout.day}</h4>
                  <p className="text-sm text-gray-600">{workout.exercises.length} exercises</p>
                  {workout.notes && (
                    <p className="text-sm text-gray-600 italic mt-1">{workout.notes}</p>
                  )}
                </div>
              ))}
            </div>
            
            <div className="mt-6">
              <a href="#/workouts" className="btn btn-secondary">
                View Full Plan
              </a>
            </div>
          </div>
        )}

        {/* Generate New Plan */}
        <div className="card">
          <h2 className="text-xl font-medium text-gray-900 mb-4">Generate New Workout Plan</h2>
          <p className="text-gray-600 mb-6">
            Create a personalized 4-week workout plan based on your current profile
          </p>
          
          {profile.goals.length > 1 && (
            <div className="mb-4">
              <label className="label">Generate plan for:</label>
              <select
                value={selectedGoalId}
                onChange={(e) => setSelectedGoalId(e.target.value)}
                className="input max-w-xs"
              >
                {profile.goals.map(goal => (
                  <option key={goal.id} value={goal.id}>
                    {goal.type.replace('_', ' ').replace(/\w/g, l => l.toUpperCase())} {'★'.repeat(goal.priority)}
                  </option>
                ))}
              </select>
            </div>
          )}
          
          <div className="flex space-x-3">
            <button
              onClick={generateNewPlan}
              disabled={generating}
              className="btn btn-primary"
            >
              {generating ? 'Generating...' : 'Generate with Coach Engine'}
            </button>
            
            {webllmModelReady && (
              <button
                onClick={generateWithWebLLM}
                disabled={generating}
                className="btn btn-secondary"
              >
                <Brain className="w-4 h-4 mr-1" />
                {generating ? 'Generating...' : 'Generate with AI'}
              </button>
            )}
            
            {webllmEnabled && !webllmModelReady && (
              <button
                onClick={initializeWebLLM}
                disabled={webllmModelLoading}
                className="btn btn-secondary"
              >
                {webllmModelLoading ? (
                  <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Loading AI...</>
                ) : (
                  <><Brain className="w-4 h-4 mr-1" />Enable AI Generation</>
                )}
              </button>
            )}
          </div>
          
          {/* Error Display */}
          {generationError && (
            <div className="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
              <div className="font-medium">Plan Generation Failed</div>
              <div className="text-sm mt-1">{generationError}</div>
              <button
                onClick={() => setGenerationError(null)}
                className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
              >
                Dismiss
              </button>
              {process.env.NODE_ENV === 'development' && (
                <div className="mt-2 text-xs text-red-600">
                  Check the console for detailed error information.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Generated Plan Preview */}
        {generatedPlan && (
          <div className="card border-2 border-blue-500">
            <h2 className="text-xl font-medium text-gray-900 mb-4">New Workout Plan Preview</h2>
            <h3 className="font-medium mb-2">{generatedPlan.name}</h3>
            <p className="text-sm text-gray-600 mb-4">{generatedPlan.notes}</p>
            
            <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
              {generatedPlan.weeks[0].workouts.map((workout, index) => (
                <div key={index} className="bg-gray-50 p-3 rounded">
                  <div className="font-medium">{workout.day}</div>
                  <div className="text-sm text-gray-600">
                    {workout.exercises.length} exercises
                    {workout.exercises.length > 0 && (
                      <div className="mt-1 text-xs">
                        Types: {workout.exercises.map(ex => getExerciseName(ex.exerciseId)).join(', ')}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={saveGeneratedPlan}
                className="btn btn-primary"
              >
                Save Plan
              </button>
              <button
                onClick={() => setGeneratedPlan(null)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Weekly Check-in */}
        <div className="card">
          <h2 className="text-xl font-medium text-gray-900 mb-4">Weekly Check-in</h2>
          <p className="text-gray-600 mb-6">
            Report how your week went to help adjust your plan
          </p>
          
          {showCheckIn ? (
            <div className="space-y-4">
              <div>
                <label className="label">Workout Adherence (1-5)</label>
                <select
                  value={checkIn.adherenceRating}
                  onChange={(e) => setCheckIn({ ...checkIn, adherenceRating: parseInt(e.target.value) })}
                  className="input"
                >
                  <option value={1}>1 - Very Poor</option>
                  <option value={2}>2 - Poor</option>
                  <option value={3}>3 - Average</option>
                  <option value={4}>4 - Good</option>
                  <option value={5}>5 - Excellent</option>
                </select>
              </div>
              
              <div>
                <label className="label">Energy Level (1-5)</label>
                <select
                  value={checkIn.energyLevel}
                  onChange={(e) => setCheckIn({ ...checkIn, energyLevel: parseInt(e.target.value) })}
                  className="input"
                >
                  <option value={1}>1 - Very Low</option>
                  <option value={2}>2 - Low</option>
                  <option value={3}>3 - Normal</option>
                  <option value={4}>4 - High</option>
                  <option value={5}>5 - Very High</option>
                </select>
              </div>
              
              <div>
                <label className="label">Sleep Quality (1-5)</label>
                <select
                  value={checkIn.sleepQuality}
                  onChange={(e) => setCheckIn({ ...checkIn, sleepQuality: parseInt(e.target.value) })}
                  className="input"
                >
                  <option value={1}>1 - Very Poor</option>
                  <option value={2}>2 - Poor</option>
                  <option value={3}>3 - Average</option>
                  <option value={4}>4 - Good</option>
                  <option value={5}>5 - Excellent</option>
                </select>
              </div>
              
              <div>
                <label className="label"> Muscle Soreness (1-5)</label>
                <select
                  value={checkIn.soreness}
                  onChange={(e) => setCheckIn({ ...checkIn, soreness: parseInt(e.target.value) })}
                  className="input"
                >
                  <option value={1}>1 - No Soreness</option>
                  <option value={2}>2 - Minimal</option>
                  <option value={3}>3 - Normal</option>
                  <option value={4}>4 - High</option>
                  <option value={5}>5 - Very Sore</option>
                </select>
              </div>
              
              <div>
                <label className="label">Notes</label>
                <textarea
                  value={checkIn.notes}
                  onChange={(e) => setCheckIn({ ...checkIn, notes: e.target.value })}
                  className="input"
                  rows={3}
                  placeholder="Any challenges, wins, or observations..."
                />
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={submitCheckIn}
                  className="btn btn-primary"
                >
                  Submit Check-in
                </button>
                <button
                  onClick={() => setShowCheckIn(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowCheckIn(true)}
              className="btn btn-secondary"
            >
              Start Weekly Check-in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}