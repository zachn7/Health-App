import { repositories } from '@/db'
import { settingsRepository } from '@/db/repositories/settings.repository'
import { buildUserContextSnapshot } from './personalization'
import { DeterministicAssistantProvider } from './providers/deterministic'
import type { AIProviderId, AssistantProvider, AssistantRequest, AssistantResponse, PlanGenerationResult } from './types'
import type { Profile } from '@/types'

class AssistantService {
  private readonly deterministicProvider = new DeterministicAssistantProvider(() => repositories.nutrition.getMealTemplates())

  private getProvider(providerId: AIProviderId): AssistantProvider {
    switch (providerId) {
      case 'deterministic':
        return this.deterministicProvider
      case 'webllm':
      case 'openrouter':
      default:
        return this.deterministicProvider
    }
  }

  async getSelectedProviderId(): Promise<AIProviderId> {
    return await settingsRepository.getAIProviderId()
  }

  async buildRequest(message: string, profile: Profile): Promise<AssistantRequest> {
    const context = await buildUserContextSnapshot(profile)
    return { message, context }
  }

  async sendMessage(message: string, profile: Profile): Promise<AssistantResponse> {
    const providerId = await this.getSelectedProviderId()
    const request = await this.buildRequest(message, profile)
    const provider = this.getProvider(providerId)
    return await provider.sendMessage(request)
  }

  async generateWorkoutPlan(profile: Profile): Promise<PlanGenerationResult> {
    const providerId = await this.getSelectedProviderId()
    const context = await buildUserContextSnapshot(profile)
    const provider = this.getProvider(providerId)
    return await provider.generateWorkoutPlan(context)
  }

  async generateMealPlan(profile: Profile): Promise<PlanGenerationResult> {
    const providerId = await this.getSelectedProviderId()
    const context = await buildUserContextSnapshot(profile)
    const provider = this.getProvider(providerId)
    return await provider.generateMealPlan(context)
  }
}

export const assistantService = new AssistantService()
