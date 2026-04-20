import { repositories } from '@/db'
import { settingsRepository } from '@/db/repositories/settings.repository'
import { buildUserContextSnapshot } from './personalization'
import { buildOutOfDomainResponse, isFitnessDomainMessage } from './domain'
import { DeterministicAssistantProvider } from './providers/deterministic'
import type { AIProviderId, AssistantProvider, AssistantRequest, AssistantResponse, PlanGenerationResult } from './types'
import type { Profile } from '@/types'

class AssistantService {
  private readonly deterministicProvider = new DeterministicAssistantProvider(() => repositories.nutrition.getMealTemplates())
  private webllmProviderPromise: Promise<AssistantProvider> | null = null

  private async getWebLLMProvider(): Promise<AssistantProvider> {
    if (!this.webllmProviderPromise) {
      this.webllmProviderPromise = import('./providers/webllm').then(({ WebLLMAssistantProvider }) => (
        new WebLLMAssistantProvider(() => repositories.nutrition.getMealTemplates())
      ))
    }

    return await this.webllmProviderPromise
  }

  private async getProvider(providerId: AIProviderId): Promise<AssistantProvider> {
    switch (providerId) {
      case 'deterministic':
        return this.deterministicProvider
      case 'webllm':
        try {
          return await this.getWebLLMProvider()
        } catch (error) {
          // WebLLM is optional and can fail to initialize (no WebGPU, blocked wasm, etc).
          // Falling back keeps the app usable.
          console.warn('WebLLM assistant provider unavailable. Falling back to deterministic.', error)
          return this.deterministicProvider
        }
      case 'openrouter':
      default:
        return this.deterministicProvider
    }
  }

  async getSelectedProviderId(): Promise<AIProviderId> {
    return await settingsRepository.getAIProviderId()
  }

  async getContextSnapshot(profile: Profile) {
    return await buildUserContextSnapshot(profile)
  }

  async buildRequest(message: string, profile: Profile): Promise<AssistantRequest> {
    const context = await this.getContextSnapshot(profile)
    return { message, context }
  }

  async sendMessage(message: string, profile: Profile): Promise<AssistantResponse> {
    if (!isFitnessDomainMessage(message)) {
      return buildOutOfDomainResponse()
    }

    const providerId = await this.getSelectedProviderId()
    const request = await this.buildRequest(message, profile)
    const provider = await this.getProvider(providerId)
    return await provider.sendMessage(request)
  }

  async generateWorkoutPlan(profile: Profile): Promise<PlanGenerationResult> {
    const providerId = await this.getSelectedProviderId()
    const context = await this.getContextSnapshot(profile)
    const provider = await this.getProvider(providerId)
    return await provider.generateWorkoutPlan(context)
  }

  async generateMealPlan(profile: Profile): Promise<PlanGenerationResult> {
    const providerId = await this.getSelectedProviderId()
    const context = await this.getContextSnapshot(profile)
    const provider = await this.getProvider(providerId)
    return await provider.generateMealPlan(context)
  }
}

export const assistantService = new AssistantService()
