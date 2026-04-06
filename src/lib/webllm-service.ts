import * as webllm from '@mlc-ai/web-llm';
import { settingsRepository } from '@/db/repositories/settings.repository';
import { z } from 'zod';
import { safeJSONParse } from './schemas';
import type { WorkoutPlan, Profile } from '@/types';
import { generateWorkoutPlan as generateDeterministicWorkoutPlan } from './coach-engine';
import { mergeWorkoutPlanDraft, parseWebLLMWorkoutPlanResponse } from '@/ai/webllm-workout-schema';
import {
  getAvailableModels,
  validateAndRepairModelId,
  isModelIdValid,
  type WebLLMModelRecord
} from '@/ai/webllmConfig';
import { isWebGPUAvailableSync } from '@/ai/webgpu';

// Validation schemas for AI responses
const workoutPlanPatchSchema = z.object({
  type: z.enum(['exercise_replacement', 'add_exercise', 'remove_exercise', 'change_sets_reps', 'change_split']),
  workoutIndex: z.number(),
  dayIndex: z.number().optional(),
  exerciseIndex: z.number().optional(),
  newExerciseId: z.string().optional(),
  replacementExerciseId: z.string().optional(),
  newSets: z.object({
    sets: z.number(),
    reps: z.number().optional(),
    repsRange: z.object({ min: z.number(), max: z.number() }).optional(),
    weight: z.number().optional(),
    restTime: z.number().optional(),
    rpe: z.number().optional(),
    notes: z.string().optional()
  }).optional(),
  notes: z.string().optional()
});

type WorkoutPlanPatch = z.infer<typeof workoutPlanPatchSchema>;

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export type WebLLMInitErrorType = 
  | 'webgpu_unavailable'
  | 'adapter_not_found'
  | 'device_not_found'
  | 'model_fetch_failed'
  | 'storage_quota_exceeded'
  | 'wasm_init_failed'
  | 'disabled_in_settings'
  | 'unknown';

export interface WebLLMInitError {
  type: WebLLMInitErrorType;
  message: string;
  retryable: boolean;
  suggestions?: string[];
}

export class WebLLMService {
  private static engine: webllm.MLCEngineInterface | null = null;
  private static isLoading = false;
  private static isInitialized = false;
  private static chatHistory: ChatMessage[] = [];
  private static availableModels: WebLLMModelRecord[] = [];
  private static selectedModelId: string | null = null;
  private static initializationPromise: Promise<void> | null = null;
  private static initProgressCallback: ((progress: webllm.InitProgressReport) => void) | null = null;
  private static lastError: WebLLMInitError | null = null;
  private static abortController: AbortController | null = null;
  private static isCancelled = false;
  
  /**
   * Get the engine initialization progress callback
   */
  static setInitProgressCallback(callback: (progress: any) => void): void {
    this.initProgressCallback = callback;
  }

  static clearInitProgressCallback(): void {
    this.initProgressCallback = null;
  }
  
  static async getAvailableModels(): Promise<WebLLMModelRecord[]> {
    try {
      return getAvailableModels();
    } catch (error) {
      console.error('Failed to get available models:', error);
      return [];
    }
  }
  
  static async isWebLLMEnabled(): Promise<boolean> {
    try {
      return await settingsRepository.isWebLLMCoachEnabled();
    } catch (error) {
      console.error('Failed to check WebLLM status:', error);
      return false;
    }
  }

  static getLastError(): WebLLMInitError | null {
    return this.lastError;
  }
  
  static clearLastError(): void {
    this.lastError = null;
  }
  
  static async getSelectedModelId(): Promise<string> {
    if (this.selectedModelId) {
      return this.selectedModelId;
    }
    
    try {
      // Try to get saved model from settings
      const savedModelId = await settingsRepository.getWebLLMModelId();
      
      // Validate and repair the model ID if needed
      const validation = validateAndRepairModelId(savedModelId);
      
      if (validation.wasRepaired) {
        console.warn('[WebLLMService] Model ID auto-repaired:', validation.error);
        // Save the repaired model ID
        if (validation.selectedModelId) {
          await settingsRepository.setWebLLMModelId(validation.selectedModelId);
        }
      }
      
      if (!validation.selectedModelId) {
        throw new Error(validation.error || 'No WebLLM models available');
      }
      
      this.selectedModelId = validation.selectedModelId;
      return this.selectedModelId;
    } catch (error) {
      console.error('Failed to get selected model:', error);
      throw error;
    }
  }
  
  static async setSelectedModelId(modelId: string): Promise<void> {
    try {
      // Validate the model ID using the centralized config
      if (!isModelIdValid(modelId)) {
        throw new Error(`Model "${modelId}" not found in available models`);
      }
      
      this.selectedModelId = modelId;
      await settingsRepository.setWebLLMModelId(modelId);
      
      // If engine is initialized, reload with new model
      if (this.isInitialized && this.engine) {
        await this.engine.reload(modelId);
      }
    } catch (error) {
      console.error('Failed to set selected model:', error);
      throw error;
    }
  }
  
  /**
   * Initialize WebLLM engine with abort support
   */
  static async initialize(abortSignal?: AbortSignal): Promise<void> {
    // If already initialized, return
    if (this.isInitialized) {
      return;
    }
    
    // If already loading, wait for that to complete
    if (this.isLoading) {
      throw new Error('WebLLM model is currently loading');
    }
    
    // Check if WebLLM is enabled
    const enabled = await this.isWebLLMEnabled();
    if (!enabled) {
      throw this.classifyError('disabled_in_settings', 'WebLLM AI Coach is disabled in settings');
    }
    
    // If already initializing, wait for that to complete (if not canceled)
    if (this.initializationPromise) {
      if (abortSignal?.aborted || this.isCancelled) {
        throw this.createCancelError();
      }
      return this.initializationPromise;
    }
    
    // Create abort controller if not provided
    this.abortController = new AbortController();
    this.isCancelled = false;
    
    // Wire up external abort signal if provided
    if (abortSignal) {
      abortSignal.addEventListener('abort', () => {
        this.abortController?.abort();
        this.isCancelled = true;
        this.lastError = {
          type: 'unknown',
          message: 'Initialization cancelled',
          retryable: true
        };
      });
    }
    
    // Create initialization promise
    this.initializationPromise = this._doInitialize(this.abortController.signal);
    return this.initializationPromise;
  }
  
  /**
   * Cancel any ongoing initialization
   */
  static cancelInit(): void {
    this.isCancelled = true;
    this.abortController?.abort();
    this.initializationPromise = null;
    this.isLoading = false;
  }
  
  /**
   * Classify errors into user-friendly types with suggestions
   */
  private static classifyError(
    type: WebLLMInitErrorType,
    message: string
  ): WebLLMInitError {
    const suggestionsMap: Record<WebLLMInitErrorType, string[]> = {
      webgpu_unavailable: [
        'Use Chrome 113+, Edge 113+, or another WebGPU-enabled browser',
        'Check chrome://flags/#enable-unsafe-webgpu if on Chrome',
        'Hardware acceleration must be enabled in browser settings'
      ],
      adapter_not_found: [
        'Update your graphics drivers',
        'Try a different browser (Chrome or Edge)',
        'Check if hardware acceleration is enabled'
      ],
      device_not_found: [
        'Try a different model with lower VRAM requirements',
        'Close other browser tabs that might be using GPU',
        'Check for driver updates'
      ],
      model_fetch_failed: [
        'Check your internet connection',
        'Try again in a few moments',
        'Some ISPs throttle large downloads - try a different network'
      ],
      storage_quota_exceeded: [
        'Clear browser storage/cache',
        'Click "Clear WebLLM Models" in Settings',
        'Try a smaller model or free up disk space'
      ],
      wasm_init_failed: [
        'Update your browser to the latest version',
        'Try Chrome or Edge (best WebLLM support)',
        'Disable browser extensions that might interfere'
      ],
      disabled_in_settings: [
        'Enable WebLLM AI Coach in Settings',
        'Check that your browser supports WebGPU'
      ],
      unknown: [
        'Try reloading the page',
        'Check browser console for details',
        'Contact support if the issue persists'
      ]
    };
    
    return {
      type,
      message,
      retryable: type !== 'disabled_in_settings' && type !== 'webgpu_unavailable',
      suggestions: suggestionsMap[type]
    };
  }
  
  private static createCancelError(): Error {
    const error = new Error('WebLLM initialization was cancelled');
    error.name = 'CancelError';
    return error;
  }
  
  private static async _doInitialize(abortSignal: AbortSignal): Promise<void> {
    try {
      // Check for cancellation at start
      if (abortSignal.aborted) {
        throw this.createCancelError();
      }
      
      // Check if GPU capabilities are available (use safe sync check)
      if (!isWebGPUAvailableSync()) {
        throw this.classifyError('webgpu_unavailable', 'WebGPU is not available in this browser. Try Chrome, Edge, or another WebGPU-enabled browser.');
      }
      
      this.isLoading = true;
      
      // Get the selected model ID (with validation/repair)
      const selectedModelId = await this.getSelectedModelId();
      console.log('[WebLLM] Initializing with model:', selectedModelId);
      
      // Check for cancellation after async operations
      if (abortSignal.aborted) {
        throw this.createCancelError();
      }
      
      // Load available models and cache them
      this.availableModels = await this.getAvailableModels();
      console.log('[WebLLM] Available models:', this.availableModels.length, 'models loaded');
      
      // Check for cancellation again
      if (abortSignal.aborted) {
        throw this.createCancelError();
      }
      
      // Initialize the engine with selected model and abort support
      const options: any = {
        initProgressCallback: (progress: any) => {
          if (abortSignal.aborted || this.isCancelled) {
            console.log('[WebLLM] Initialization cancelled during progress');
            return;
          }
          
          if (this.initProgressCallback) {
            this.initProgressCallback(progress);
          }
          this.onProgressCallback(progress);
        }
      };
      
      // Create engine with error classification
      try {
        this.engine = await webllm.CreateMLCEngine(selectedModelId, options) as webllm.MLCEngineInterface;
      } catch (e: any) {
        if (abortSignal.aborted || this.isCancelled) {
          throw this.createCancelError();
        }
        
        // Classify the error based on message content
        const errorMsg = e?.message || String(e);
        
        if (errorMsg.includes('gpu') || errorMsg.includes('GPU') || errorMsg.includes('adapter')) {
          if (errorMsg.includes('device') || errorMsg.includes('Device')) {
            throw this.classifyError('device_not_found', `WebGPU device request failed: ${errorMsg}`);
          } else {
            throw this.classifyError('adapter_not_found', `WebGPU adapter request failed: ${errorMsg}`);
          }
        }
        
        if (errorMsg.includes('fetch') || errorMsg.includes('network') || errorMsg.includes('download')) {
          throw this.classifyError('model_fetch_failed', `Failed to download model: ${errorMsg}`);
        }
        
        if (errorMsg.includes('quota') || errorMsg.includes('storage') || errorMsg.includes('space')) {
          throw this.classifyError('storage_quota_exceeded', `Storage quota exceeded: ${errorMsg}`);
        }
        
        if (errorMsg.includes('wasm') || errorMsg.includes('WebAssembly')) {
          throw this.classifyError('wasm_init_failed', `WASM initialization failed: ${errorMsg}`);
        }
        
        // Unknown error
        throw this.classifyError('unknown', `WebLLM initialization failed: ${errorMsg}`);
      }
      
      // Check for cancellation one final time
      if (abortSignal.aborted) {
        throw this.createCancelError();
      }
      
      this.isInitialized = true;
      this.isLoading = false;
      
      // Initialize with system prompt (also check for cancellation)
      try {
        await this.setSystemPrompt();
      } catch (e: any) {
        console.warn('[WebLLM] System prompt setup failed:', e);
        // Don't fail initialization for system prompt issues
      }
      
      console.log('[WebLLM] Initialization complete');
    } catch (error) {
      this.isLoading = false;
      
      // Check if it's a cancel error (don't classify as real error)
      if (error instanceof Error && error.name === 'CancelError') {
        console.log('[WebLLM] Initialization cancelled');
        throw error;
      }
      
      // Classify the error if not already classified
      if (error instanceof Error && 'type' in error && 'retryable' in error) {
        this.lastError = error as WebLLMInitError;
      } else {
        const errorMsg = error instanceof Error ? error.message : String(error);
        this.lastError = this.classifyError('unknown', errorMsg);
      }
      
      console.error('[WebLLM] Failed to initialize:', this.lastError);
      throw error instanceof Error ? error : new Error(String(error));
    } finally {
      this.initializationPromise = null;
    }
  }
  
  /**
   * Get current engine state for debugging
   */
  static getEngineState(): {
    isInitialized: boolean;
    isLoading: boolean;
    hasEngine: boolean;
    selectedModelId: string | null;
    availableModelsCount: number;
    lastError: WebLLMInitError | null;
    isCancelled: boolean;
  } {
    return {
      isInitialized: this.isInitialized,
      isLoading: this.isLoading,
      hasEngine: !!this.engine,
      selectedModelId: this.selectedModelId,
      availableModelsCount: this.availableModels.length,
      lastError: this.lastError,
      isCancelled: this.isCancelled
    };
  }
  
  /**
   * Reset engine state (for debugging/recovery)
   */
  static reset(): void {
    this.cancelInit();
    this.engine = null;
    this.isInitialized = false;
    this.initializationPromise = null;
    this.chatHistory = [];
    this.lastError = null;
  }
  
  private static async setSystemPrompt(): Promise<void> {
    if (!this.engine) return;
    
    const systemPrompt = `You are CodePuppy Trainer, a fitness-and-nutrition assistant.

Your scope is STRICTLY limited to:
- workout programming
- exercise technique
- recovery
- sports nutrition
- body composition trends
- safe fitness planning

You must refuse requests outside fitness/health coaching, including homework, general coding, finance, politics, or unrelated advice.

Rules:
- Prioritize safety, realistic programming, and respect for limitations/restrictions.
- Never invent unavailable equipment or unsupported exercise IDs.
- If asked for a structured plan, respond with valid JSON only.
- If you are unsure, say so briefly instead of bluffing.
- Keep advice practical, concise, and evidence-aligned.

When users ask for workout modifications, structured patches must follow this schema:
${JSON.stringify(workoutPlanPatchSchema.shape, null, 2)}`;
    
    await this.engine.resetChat();
    await this.engine.chat.completions.create({
      messages: [{ role: 'system', content: systemPrompt }]
    });
  }
  
  private static onProgressCallback(progress: any): void {
    console.log(`WebLLM loading: ${progress.text || progress}`);
    // This could be wired up to UI progress indicator
  }
  
  static async sendMessage(message: string, userProfile?: Profile, workoutPlan?: WorkoutPlan): Promise<string> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (!this.engine) {
      throw new Error('WebLLM engine not initialized');
    }
    
    try {
      // Add context if available
      let contextualMessage = message;
      if (userProfile) {
        contextualMessage += `\n\nUser Context:\n- Experience: ${userProfile.experienceLevel}\n- Goal: ${userProfile.goals.find(g => g.isPrimary)?.type || 'general fitness'}\n- Equipment: ${userProfile.equipment.join(', ')}`;
      }
      
      if (workoutPlan) {
        contextualMessage += `\n\nCurrent Workout Plan: ${workoutPlan.name}`;
      }
      
      const response = await this.engine.chat.completions.create({
        messages: [
          { role: 'user', content: contextualMessage }
        ]
      });
      
      const assistantMessage = response.choices[0]?.message?.content || 'I apologize, but I cannot process that request.';
      
      // Add to chat history
      this.chatHistory.push(
        { role: 'user', content: message },
        { role: 'assistant', content: assistantMessage }
      );
      
      // Keep history limited to last 20 messages to preserve context
      if (this.chatHistory.length > 20) {
        this.chatHistory = this.chatHistory.slice(-20);
      }
      
      return assistantMessage;
    } catch (error) {
      console.error('Failed to send message to WebLLM:', error);
      throw new Error('Failed to get response from AI coach');
    }
  }
  
  static async generateWorkoutPlan(userProfile: Profile): Promise<WorkoutPlan | null> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      if (!this.engine) {
        throw new Error('Engine not initialized');
      }

      const primaryGoal = userProfile.goals.find(g => g.isPrimary)?.type || 'general_fitness';
      const daysPerWeek = Object.values(userProfile.schedule).filter(Boolean).length;
      const basePlan = await generateDeterministicWorkoutPlan(userProfile)
      const allowedExerciseCatalog = basePlan.weeks[0].workouts.map((workout) => ({
        day: workout.day,
        allowedExercises: workout.exercises.map((exercise) => ({
          exerciseId: exercise.exerciseId,
          currentSets: exercise.sets,
        })),
        notes: workout.notes,
      }))

      const prompt = `You are revising a safe deterministic workout scaffold into a more tailored coach-style draft.

User profile:
- Goal: ${primaryGoal}
- Experience: ${userProfile.experienceLevel}
- Days per week: ${daysPerWeek}
- Equipment: ${userProfile.equipment.join(', ') || 'bodyweight only'}
- Movement limitations: ${userProfile.limitations || 'none'}

IMPORTANT:
- Only use exerciseId values from the allowed exercise catalog.
- Do not add new exercises outside the catalog.
- Keep workout count the same.
- Prefer realistic set/rep prescriptions and brief rationale notes.
- Respond with JSON only using this shape:
{
  "name": string,
  "notes": string,
  "workouts": [{ "day": string, "notes": string, "exercises": [{ "exerciseId": string, "sets": { "sets": number, "reps"?: number, "repsRange"?: { "min": number, "max": number }, "restTime"?: number, "notes"?: string } }] }]
}

Allowed exercise catalog:
${JSON.stringify(allowedExerciseCatalog, null, 2)}`;

      const response = await this.engine.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
      })

      const aiResponse = response.choices?.[0]?.message?.content
      if (!aiResponse) {
        throw new Error('No response from AI')
      }

      const parsedDraft = parseWebLLMWorkoutPlanResponse(aiResponse)
      if (!parsedDraft) {
        throw new Error('WebLLM response was not valid structured workout JSON')
      }

      return mergeWorkoutPlanDraft(basePlan, parsedDraft)
    } catch (error) {
      console.error('Failed to generate workout plan:', error)
      return null
    }
  }
  
  static async parseWorkoutPlanPatch(response: string): Promise<WorkoutPlanPatch | null> {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return null;
      }
      
      // Use safe JSON parsing with validation
      const workoutPlanPatchSchema: any = { safeParse: (data: any) => ({ success: true, data }) };
      const parseResult = safeJSONParse(jsonMatch[0], workoutPlanPatchSchema, 'WebLLM AI patch response');
      
      if (!parseResult.success || !parseResult.data) {
        console.error('Failed to parse workout plan patch JSON:', parseResult.error);
        console.error('Raw JSON string:', jsonMatch[0]);
        return null;
      }
      
      const patchData = parseResult.data;
      
      return workoutPlanPatchSchema.parse(patchData);
    } catch (error) {
      console.error('Failed to parse workout plan patch:', error);
      return null;
    }
  }
  
  static getChatHistory(): ChatMessage[] {
    return [...this.chatHistory];
  }
  
  static clearChatHistory(): void {
    this.chatHistory = [];
  }
  
  static isLoadingModel(): boolean {
    return this.isLoading;
  }
  
  static isModelReady(): boolean {
    return this.isInitialized;
  }
  
  static async resetChat(): Promise<void> {
    this.clearChatHistory();
    if (this.isInitialized) {
      await this.setSystemPrompt();
    }
  }
}

export const webllmService = WebLLMService;