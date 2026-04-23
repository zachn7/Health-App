import type { AssistantProvider, AssistantRequest, AssistantResponse, PlanGenerationResult } from '@/ai/types'
import { DeterministicAssistantProvider } from './deterministic'
import { HostedProxyError, fetchJson, getHostedProxyBaseUrl } from '../hosted-proxy-client'

type OpenAIChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string } }>
}

function makeFallbackProvider(getMealTemplates: () => Promise<any[]>) {
  return new DeterministicAssistantProvider(getMealTemplates)
}

export class OpenAIProxyAssistantProvider implements AssistantProvider {
  id: AssistantProvider['id'] = 'openai_proxy'
  private readonly fallback: DeterministicAssistantProvider

  constructor(getMealTemplates: () => Promise<any[]>) {
    this.fallback = makeFallbackProvider(getMealTemplates)
  }

  async isAvailable(): Promise<boolean> {
    return getHostedProxyBaseUrl() !== null
  }

  private buildSystemPrompt(context: AssistantRequest['context']): string {
    const goal = context.profile.goals?.[0]?.type ?? 'general_fitness'
    const restrictions = context.preferenceSignals.dietaryRestrictions.join(', ') || 'none'
    const limitations = context.preferenceSignals.movementLimitations.join(', ') || 'none'

    return [
      'You are FitBud AI, a fitness, nutrition, and recovery coach for an offline-first app.',
      'Stay in fitness scope. Be practical. Keep answers concise and actionable.',
      `User goal: ${goal}. Dietary restrictions: ${restrictions}. Movement limitations: ${limitations}.`,
    ].join('\n')
  }

  async sendMessage(request: AssistantRequest): Promise<AssistantResponse> {
    const baseUrl = getHostedProxyBaseUrl()
    if (!baseUrl) {
      // Not available. Do not lie.
      return this.fallback.sendMessage(request)
    }

    try {
      const model = import.meta.env.VITE_AI_PROXY_MODEL || 'gpt-4o-mini'
      const payload = {
        model,
        messages: [
          { role: 'system', content: this.buildSystemPrompt(request.context) },
          { role: 'user', content: request.message },
        ],
        temperature: 0.6,
      }

      const data = await fetchJson<OpenAIChatCompletionResponse>(`${baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
        timeoutMs: 15_000,
      })

      const message = data.choices?.[0]?.message?.content?.trim() || ''
      if (!message) {
        throw new HostedProxyError('Hosted AI returned an empty response.', { reason: 'bad_response' })
      }

      return {
        provider: this.id,
        intent: 'general_coaching',
        message,
      }
    } catch (error) {
      // Throw so AssistantService can decide how/when to fall back + record diagnostics.
      if (error instanceof HostedProxyError) {
        throw error
      }
      throw new HostedProxyError('Hosted AI failed unexpectedly.', {
        reason: 'proxy_error',
        details: error instanceof Error ? error.message : String(error),
      })
    }
  }

  async generateWorkoutPlan(context: AssistantRequest['context']): Promise<PlanGenerationResult> {
    // AI3 will wire real hosted structured plan generation.
    // For now: deterministic (and we report provider correctly in AssistantService).
    return this.fallback.generateWorkoutPlan(context)
  }

  async generateMealPlan(context: AssistantRequest['context']): Promise<PlanGenerationResult> {
    return this.fallback.generateMealPlan(context)
  }
}
