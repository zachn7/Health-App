import { webllmService } from '@/lib/webllm-service'
import type { AssistantProvider, AssistantRequest, AssistantResponse, PlanGenerationResult } from '@/ai/types'
import type { MealPlan } from '@/types'
import { DeterministicAssistantProvider } from './deterministic'

function makeFallbackProvider(getMealTemplates: () => Promise<any[]>) {
  return new DeterministicAssistantProvider(getMealTemplates)
}

export class WebLLMAssistantProvider implements AssistantProvider {
  id: AssistantProvider['id'] = 'webllm'
  private readonly fallback: DeterministicAssistantProvider

  constructor(getMealTemplates: () => Promise<any[]>) {
    this.fallback = makeFallbackProvider(getMealTemplates)
  }

  async isAvailable(): Promise<boolean> {
    return await webllmService.isWebLLMEnabled()
  }

  async sendMessage(request: AssistantRequest): Promise<AssistantResponse> {
    if (!(await this.isAvailable())) {
      return this.fallback.sendMessage(request)
    }

    try {
      await webllmService.initialize()
      const reply = await webllmService.sendMessage(request.message, request.context.profile)
      return {
        provider: this.id,
        intent: 'general_coaching',
        message: reply,
      }
    } catch (error) {
      console.warn('[WebLLMAssistantProvider] Falling back to deterministic sendMessage:', error)
      return this.fallback.sendMessage(request)
    }
  }

  async generateWorkoutPlan(context: AssistantRequest['context']): Promise<PlanGenerationResult> {
    if (!(await this.isAvailable())) {
      return this.fallback.generateWorkoutPlan(context)
    }

    try {
      await webllmService.initialize()
      const workoutPlan = await webllmService.generateWorkoutPlan(context.profile)
      if (!workoutPlan) {
        throw new Error('WebLLM returned no workout plan')
      }

      return {
        provider: this.id,
        rationale: `Generated with WebLLM using your profile, schedule, equipment, and saved limitations. This is still constrained to safe in-app plan structure validation rather than free-form chaos.`,
        workoutPlan,
      }
    } catch (error) {
      console.warn('[WebLLMAssistantProvider] Falling back to deterministic workout generation:', error)
      return this.fallback.generateWorkoutPlan(context)
    }
  }

  async generateMealPlan(context: AssistantRequest['context']): Promise<PlanGenerationResult> {
    const fallbackResult = await this.fallback.generateMealPlan(context)
    return {
      ...fallbackResult,
      provider: this.id,
      rationale: `WebLLM meal generation is not fully wired yet, so I used the deterministic planner with your saved context as a safe fallback instead of hallucinating a nutrition disaster.`,
      mealPlan: fallbackResult.mealPlan as MealPlan,
    }
  }
}
