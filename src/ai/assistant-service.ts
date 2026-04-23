import { repositories } from '@/db'
import { settingsRepository } from '@/db/repositories/settings.repository'
import { buildUserContextSnapshot } from './personalization'
import { buildOutOfDomainResponse, isFitnessDomainMessage } from './domain'
import { DeterministicAssistantProvider } from './providers/deterministic'
import { OpenAIProxyAssistantProvider } from './providers/openai-proxy'
import type { AIProviderId, AssistantProvider, AssistantRequest, AssistantResponse, PlanGenerationResult } from './types'
import type { Profile } from '@/types'
import { onSettingsChanged } from '@/lib/settings-events'
import { aiRuntimeDiagnostics } from './runtime-diagnostics'
import { checkHostedProxyHealth, getHostedProxyBaseUrl, getHostedProxyPublicLabel, HostedProxyError } from './hosted-proxy-client'
import { resolveAIProviders, type AIFallbackReason } from './provider-selection'

class AssistantService {
  private readonly deterministicProvider = new DeterministicAssistantProvider(() => repositories.nutrition.getMealTemplates())
  private webllmProviderPromise: Promise<AssistantProvider> | null = null
  private openAIProxyProviderPromise: Promise<AssistantProvider> | null = null

  private hostedProxyHealthy: boolean | null = null
  private hostedProxyLastCheckedAt: string | null = null
  private hostedProxyLastError: string | null = null
  private hostedProxyLastStatus: number | null = null

  constructor() {
    // If the user changes provider/settings, don't require a full refresh.
    // Clear cached provider instances so next call picks up the new state.
    if (typeof window !== 'undefined') {
      onSettingsChanged(() => {
        this.webllmProviderPromise = null
        this.openAIProxyProviderPromise = null
        // Also clear cached health so auto-mode rechecks.
        this.hostedProxyHealthy = null
        this.hostedProxyLastCheckedAt = null
        this.hostedProxyLastError = null
        this.hostedProxyLastStatus = null
      })
    }
  }

  private async getWebLLMProvider(): Promise<AssistantProvider> {
    if (!this.webllmProviderPromise) {
      this.webllmProviderPromise = import('./providers/webllm').then(({ WebLLMAssistantProvider }) => (
        new WebLLMAssistantProvider(() => repositories.nutrition.getMealTemplates())
      ))
    }

    return await this.webllmProviderPromise
  }

  private async getOpenAIProxyProvider(): Promise<AssistantProvider> {
    if (!this.openAIProxyProviderPromise) {
      // Keep it simple: this provider is not huge and is used often.
      this.openAIProxyProviderPromise = Promise.resolve(
        new OpenAIProxyAssistantProvider(() => repositories.nutrition.getMealTemplates()),
      )
    }

    return await this.openAIProxyProviderPromise
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
      case 'openai_proxy':
        try {
          const proxy = await this.getOpenAIProxyProvider()
          if (!(await proxy.isAvailable())) {
            console.warn('OpenAI proxy provider not available (missing base URL). Falling back to deterministic.')
            return this.deterministicProvider
          }
          return proxy
        } catch (error) {
          console.warn('OpenAI proxy provider failed. Falling back to deterministic.', error)
          return this.deterministicProvider
        }
      case 'openrouter':
      default:
        return this.deterministicProvider
    }
  }

  private async checkHostedProxyHealthIfNeeded(force: boolean): Promise<{ configured: boolean; healthy: boolean }> {
    const baseUrl = getHostedProxyBaseUrl()
    const configured = !!baseUrl

    if (!configured) {
      this.hostedProxyHealthy = false
      this.hostedProxyLastCheckedAt = new Date().toISOString()
      this.hostedProxyLastError = null
      this.hostedProxyLastStatus = null

      aiRuntimeDiagnostics.set({
        hostedProxy: {
          configured: false,
          baseUrlLabel: getHostedProxyPublicLabel(baseUrl),
          healthy: false,
          lastCheckedAt: this.hostedProxyLastCheckedAt,
          lastError: null,
          lastStatus: null,
        },
      })

      return { configured: false, healthy: false }
    }

    const stale = !this.hostedProxyLastCheckedAt
      || (Date.now() - new Date(this.hostedProxyLastCheckedAt).getTime()) > 60_000

    if (!force && !stale && this.hostedProxyHealthy !== null) {
      return { configured: true, healthy: this.hostedProxyHealthy }
    }

    const result = await checkHostedProxyHealth(baseUrl)
    this.hostedProxyHealthy = result.healthy
    this.hostedProxyLastStatus = result.status ?? null
    this.hostedProxyLastError = result.error ?? null
    this.hostedProxyLastCheckedAt = new Date().toISOString()

    aiRuntimeDiagnostics.set({
      hostedProxy: {
        configured: true,
        baseUrlLabel: getHostedProxyPublicLabel(baseUrl),
        healthy: result.healthy,
        lastCheckedAt: this.hostedProxyLastCheckedAt,
        lastError: this.hostedProxyLastError,
        lastStatus: this.hostedProxyLastStatus,
      },
    })

    return { configured: true, healthy: result.healthy }
  }

  async refreshHostedProxyHealth(): Promise<void> {
    await this.checkHostedProxyHealthIfNeeded(true)
  }

  async getSelectedProviderId(): Promise<AIProviderId> {
    return await settingsRepository.getAIProviderId()
  }

  private async getProviderMode(): Promise<'auto' | 'manual'> {
    const raw = localStorage.getItem('ai_provider_mode')
    return raw === 'manual' ? 'manual' : 'auto'
  }

  async setProviderMode(mode: 'auto' | 'manual') {
    localStorage.setItem('ai_provider_mode', mode)
    aiRuntimeDiagnostics.set({ providerMode: mode })
  }

  async getEffectiveProviderId(): Promise<{ selected: AIProviderId; effective: AIProviderId; reason: AIFallbackReason }> {
    const selectedProvider = await this.getSelectedProviderId()
    const providerMode = await this.getProviderMode()
    const settings = await settingsRepository.getSettings()
    const webllmEnabled = !!settings?.enableWebLLMCoach

    const hostedProxy = await this.checkHostedProxyHealthIfNeeded(false)

    const resolved = resolveAIProviders({
      mode: providerMode,
      manualProvider: selectedProvider,
      hostedProxy,
      webllmEnabled,
    })

    aiRuntimeDiagnostics.set({
      selectedProvider: resolved.selectedProvider,
      effectiveProvider: resolved.effectiveProvider,
      providerMode,
      lastFallbackReason: resolved.reason,
      lastFallbackMessage: resolved.reason === 'none' ? null : resolved.reason,
    })

    return {
      selected: resolved.selectedProvider,
      effective: resolved.effectiveProvider,
      reason: resolved.reason,
    }
  }

  async getContextSnapshot(profile: Profile) {
    return await buildUserContextSnapshot(profile)
  }

  async getDiagnosticsSnapshot() {
    return aiRuntimeDiagnostics.get()
  }

  async buildRequest(message: string, profile: Profile): Promise<AssistantRequest> {
    const context = await this.getContextSnapshot(profile)
    return { message, context }
  }

  private recordFallback(reason: AIFallbackReason, message: string | null) {
    aiRuntimeDiagnostics.set({
      lastFallbackReason: reason,
      lastFallbackMessage: message,
    })
  }

  async sendMessage(message: string, profile: Profile): Promise<AssistantResponse> {
    if (!isFitnessDomainMessage(message)) {
      return buildOutOfDomainResponse()
    }

    const { selected, effective } = await this.getEffectiveProviderId()
    const request = await this.buildRequest(message, profile)

    const provider = await this.getProvider(effective)

    try {
      const response = await provider.sendMessage(request)

      // Guardrail: provider must match effective provider.
      if (response.provider !== effective) {
        this.recordFallback('bad_response', 'provider_mismatch')
        return {
          ...response,
          provider: effective,
        }
      }

      return response
    } catch (error) {
      if (effective === 'openai_proxy') {
        const reason = error instanceof HostedProxyError ? error.reason : 'proxy_error'
        const details = error instanceof HostedProxyError ? error.message : (error instanceof Error ? error.message : String(error))
        this.recordFallback(reason, details)

        // If hosted fails at runtime, immediately fall back.
        const settings = await settingsRepository.getSettings()
        const fallbackProvider: AIProviderId = settings?.enableWebLLMCoach ? 'webllm' : 'deterministic'
        const fallback = await this.getProvider(fallbackProvider)
        const fallbackResponse = await fallback.sendMessage(request)

        // Be honest in the UI about what actually happened.
        return {
          ...fallbackResponse,
          provider: fallbackProvider,
          message: `[AI fallback active: selected=${selected} effective=${fallbackProvider} reason=${reason}]\n\n${fallbackResponse.message}`,
        }
      }

      throw error
    }
  }

  async generateWorkoutPlan(profile: Profile): Promise<PlanGenerationResult> {
    const { selected, effective } = await this.getEffectiveProviderId()
    const context = await this.getContextSnapshot(profile)
    const provider = await this.getProvider(effective)

    try {
      const result = await provider.generateWorkoutPlan(context)
      return {
        ...result,
        provider: effective,
      }
    } catch (error) {
      if (effective === 'openai_proxy') {
        const reason = error instanceof HostedProxyError ? error.reason : 'proxy_error'
        const details = error instanceof HostedProxyError ? error.message : (error instanceof Error ? error.message : String(error))
        this.recordFallback(reason, details)
        const settings = await settingsRepository.getSettings()
        const fallbackProvider: AIProviderId = settings?.enableWebLLMCoach ? 'webllm' : 'deterministic'
        const fallback = await this.getProvider(fallbackProvider)
        const fallbackResult = await fallback.generateWorkoutPlan(context)
        return {
          ...fallbackResult,
          provider: fallbackProvider,
          rationale: `AI fallback active: selected=${selected} effective=${fallbackProvider} reason=${reason}. ${fallbackResult.rationale}`,
        }
      }
      throw error
    }
  }

  async generateMealPlan(profile: Profile): Promise<PlanGenerationResult> {
    const { selected, effective } = await this.getEffectiveProviderId()
    const context = await this.getContextSnapshot(profile)
    const provider = await this.getProvider(effective)

    try {
      const result = await provider.generateMealPlan(context)
      return {
        ...result,
        provider: effective,
      }
    } catch (error) {
      if (effective === 'openai_proxy') {
        const reason = error instanceof HostedProxyError ? error.reason : 'proxy_error'
        const details = error instanceof HostedProxyError ? error.message : (error instanceof Error ? error.message : String(error))
        this.recordFallback(reason, details)
        const settings = await settingsRepository.getSettings()
        const fallbackProvider: AIProviderId = settings?.enableWebLLMCoach ? 'webllm' : 'deterministic'
        const fallback = await this.getProvider(fallbackProvider)
        const fallbackResult = await fallback.generateMealPlan(context)
        return {
          ...fallbackResult,
          provider: fallbackProvider,
          rationale: `AI fallback active: selected=${selected} effective=${fallbackProvider} reason=${reason}. ${fallbackResult.rationale}`,
        }
      }
      throw error
    }
  }
}

export const assistantService = new AssistantService()
