import * as webllm from '@mlc-ai/web-llm';
import { settingsRepository } from '@/db/repositories/settings.repository';
import { z } from 'zod';
import type { WorkoutPlan, Profile } from '@/types';

export interface WebLLMModelRecord {
  model_id: string;
  model_lib: string;
  model_url: string;
  estimated_vram_bytes: number;
  low_resource_required: boolean;
  required_features: string[];
  [key: string]: any;
}

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

export class WebLLMService {
  private static engine: webllm.MLCEngineInterface | null = null;
  private static isLoading = false;
  private static isInitialized = false;
  private static chatHistory: ChatMessage[] = [];
  private static availableModels: WebLLMModelRecord[] = [];
  private static selectedModelId: string | null = null;
  
  // static getAvailableModels(): WebLLMModelRecord[] {
  //   // Return models from webllm.prebuiltAppConfig.model_list
  //   try {
  //     return webllm.prebuiltAppConfig.model_list as WebLLMModelRecord[];
  //   } catch (error) {
  //     console.error('Failed to get available models:', error);
  //     return [];
  //   }
  // }
  
  static async getAvailableModels(): Promise<WebLLMModelRecord[]> {
    try {
      // Access the prebuiltAppConfig.model_list from webllm
      const models = (webllm as any).prebuiltAppConfig?.model_list || [];
      console.log('WebLLM models from prebuiltAppConfig:', models.map((m: any) => m.model_id));
      return models;
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
  
  static async getSelectedModelId(): Promise<string> {
    if (this.selectedModelId) {
      return this.selectedModelId;
    }
    
    try {
      // Try to get saved model from settings
      const savedModelId = await settingsRepository.getWebLLMModelId();
      const availableModels = await this.getAvailableModels();
      
      if (savedModelId) {
        // Validate that the saved model is still available
        const modelExists = availableModels.some(model => model.model_id === savedModelId);
        
        if (modelExists) {
          this.selectedModelId = savedModelId;
          return savedModelId;
        } else {
          console.warn(`Saved model ${savedModelId} not found in available models, falling back to default`);
          console.warn('Available models:', availableModels.map(m => m.model_id));
          // Clear the invalid model and fallback
          await settingsRepository.setWebLLMModelId(null);
        }
      }
      
      // Fallback to first available safe model that ends with -MLC (standard naming)
      let defaultModel = availableModels.find(model => model.model_id.endsWith('-MLC'));
      
      // If no -MLC model, try safe models
      if (!defaultModel) {
        const safeModels = availableModels.filter(model => !model.low_resource_required && model.required_features.length === 0);
        defaultModel = safeModels.length > 0 ? safeModels[0] : availableModels[0];
      }
      
      if (defaultModel) {
        this.selectedModelId = defaultModel.model_id;
        await settingsRepository.setWebLLMModelId(this.selectedModelId);
        console.log('Defaulted to model:', this.selectedModelId);
        return this.selectedModelId;
      }
      
      throw new Error('No WebLLM models available');
    } catch (error) {
      console.error('Failed to get selected model:', error);
      throw error;
    }
  }
  
  static async setSelectedModelId(modelId: string): Promise<void> {
    try {
      const availableModels = await this.getAvailableModels();
      const modelExists = availableModels.some(model => model.model_id === modelId);
      
      if (!modelExists) {
        throw new Error(`Model ${modelId} not found in available models`);
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
  
  static async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    const enabled = await this.isWebLLMEnabled();
    if (!enabled) {
      throw new Error('WebLLM AI Coach is disabled in settings');
    }
    
    if (this.isLoading) {
      throw new Error('WebLLM model is currently loading');
    }
    
    try {
      // Check if GPU capabilities are available
      if (!('gpu' in navigator)) {
        throw new Error('WebGPU is not available in this browser. Try Chrome, Edge, or another WebGPU-enabled browser.');
      }
      
      this.isLoading = true;
      
      // Get the selected model ID (with fallback to first available)
      const selectedModelId = await this.getSelectedModelId();
      console.log('Initializing WebLLM with model:', selectedModelId);
      
      // Load available models and cache them
      this.availableModels = await this.getAvailableModels();
      console.log('Available models:', this.availableModels.map(m => m.model_id));
      
      // Initialize the engine with selected model
      this.engine = await webllm.CreateMLCEngine(
        selectedModelId,
        { initProgressCallback: this.onProgressCallback.bind(this) }
      ) as webllm.MLCEngineInterface;
      
      this.isInitialized = true;
      this.isLoading = false;
      
      // Initialize with system prompt
      await this.setSystemPrompt();
    } catch (error) {
      this.isLoading = false;
      console.error('Failed to initialize WebLLM:', error);
      throw error;
    }
  }
  
  private static async setSystemPrompt(): Promise<void> {
    if (!this.engine) return;
    
    const systemPrompt = `You are CodePuppy Trainer, an experienced fitness coach specializing in workout plan creation and modification. 

Your expertise is strictly limited to fitness, exercise, nutrition, and training advice. You must refuse any non-fitness related requests. 

Core responsibilities:
1. Generate or modify workout plans based on user goals, experience level, equipment, and limitations
2. Provide exercise technique guidance and injury prevention advice
3. Help with nutrition tracking and macro calculations for fitness goals
4. Answer questions about workout programming, periodization, and recovery

When users ask for plan modifications, respond with structured JSON patches following this schema:
${JSON.stringify(workoutPlanPatchSchema.shape, null, 2)}

Rules:
- Always prioritize safety and proper form
- Consider user's equipment, experience level, and limitations
- Request clarification if information is insufficient
- Keep responses concise and actionable
- For structural changes to workouts, provide JSON patches
- For nutrition questions, focus on fitness-related nutrition only

If a request falls outside your fitness expertise, politely refuse and suggest asking a domain expert.`;
    
    await this.engine.resetChat();
    await this.engine.chat.completions.create({
      messages: [{ role: 'system', content: systemPrompt }]
    });
  }
  
  private static onProgressCallback(progress: webllm.InitProgressReport): void {
    console.log(`WebLLM loading: ${progress.text}`);
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
      const primaryGoal = userProfile.goals.find(g => g.isPrimary)?.type || 'general_fitness';
      const daysPerWeek = Object.values(userProfile.schedule).filter(Boolean).length;
      
      const prompt = `Generate a ${daysPerWeek}-day workout plan for:
- Goal: ${primaryGoal}
- Experience: ${userProfile.experienceLevel}
- Available equipment: ${userProfile.equipment.join(', ') || 'bodyweight only'}
- Limitations: ${userProfile.limitations || 'none'}

Respond with a structured workout plan in JSON format. Each day should include appropriate exercises for the goal and experience level.`;
      
      if (!this.engine) {
        throw new Error('Engine not initialized');
      }
      
      const response = await this.engine.chat.completions.create({
        messages: [{ role: 'user', content: prompt }]
      });
      
      const aiResponse = response.choices?.[0]?.message?.content;
      if (!aiResponse) {
        throw new Error('No response from AI');
      }
      
      // Try to extract JSON from response
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }
      
      let planData;
      try {
        planData = JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        console.error('Failed to parse AI response JSON:', parseError);
        console.error('Raw JSON string:', jsonMatch[0]);
        throw new Error('Invalid JSON format in AI response');
      }
      
      // Convert to our format (simplified for now)
      const workoutPlan: WorkoutPlan = {
        id: `ai-plan-${Date.now()}`,
        name: `AI Generated Plan - ${primaryGoal}`,
        weeks: [
          {
            week: 1,
            workouts: planData.workouts || []
          }
        ],
        generatedBy: 'coach',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      return workoutPlan;
    } catch (error) {
      console.error('Failed to generate workout plan:', error);
      return null;
    }
  }
  
  static async parseWorkoutPlanPatch(response: string): Promise<WorkoutPlanPatch | null> {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return null;
      }
      
      let patchData;
      try {
        patchData = JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        console.error('Failed to parse workout plan patch JSON:', parseError);
        console.error('Raw JSON string:', jsonMatch[0]);
        return null;
      }
      
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