import type { AIProviderId } from './types'

export type AIProviderMode = 'auto' | 'manual'

export type HostedProxyHealth = {
  configured: boolean
  healthy: boolean
}

export type AISelectionInput = {
  mode: AIProviderMode
  manualProvider: AIProviderId
  hostedProxy: HostedProxyHealth
  webllmEnabled: boolean
}

export type AIFallbackReason =
  | 'none'
  | 'proxy_not_configured'
  | 'proxy_unhealthy'
  | 'proxy_error'
  | 'quota_exceeded'
  | 'network_error'
  | 'auth_error'
  | 'model_error'
  | 'invalid_json'
  | 'bad_content_type'
  | 'bad_response'
  | 'provider_unavailable'

export type EffectiveSelection = {
  selectedProvider: AIProviderId
  effectiveProvider: AIProviderId
  reason: AIFallbackReason
}

export function resolveAIProviders(input: AISelectionInput): EffectiveSelection {
  if (input.mode === 'auto') {
    // Auto mode: hosted OpenAI is the default only when configured + healthy.
    if (input.hostedProxy.configured && input.hostedProxy.healthy) {
      return {
        selectedProvider: 'openai_proxy',
        effectiveProvider: 'openai_proxy',
        reason: 'none',
      }
    }

    const fallbackProvider = input.webllmEnabled ? 'webllm' : 'deterministic'

    // If a proxy is configured but unhealthy, surface that reason.
    if (input.hostedProxy.configured && !input.hostedProxy.healthy) {
      return {
        selectedProvider: fallbackProvider,
        effectiveProvider: fallbackProvider,
        reason: 'proxy_unhealthy',
      }
    }

    // If it's not configured at all, just pick the local provider and keep reason clean.
    return {
      selectedProvider: fallbackProvider,
      effectiveProvider: fallbackProvider,
      reason: 'none',
    }
  }

  // Manual mode: respect the selected provider, but still enforce availability.
  const preferred = input.manualProvider

  if (preferred === 'openai_proxy') {
    if (!input.hostedProxy.configured) {
      return {
        selectedProvider: preferred,
        effectiveProvider: input.webllmEnabled ? 'webllm' : 'deterministic',
        reason: 'proxy_not_configured',
      }
    }

    if (!input.hostedProxy.healthy) {
      return {
        selectedProvider: preferred,
        effectiveProvider: input.webllmEnabled ? 'webllm' : 'deterministic',
        reason: 'proxy_unhealthy',
      }
    }
  }

  if (preferred === 'webllm' && !input.webllmEnabled) {
    return {
      selectedProvider: preferred,
      effectiveProvider: 'deterministic',
      reason: 'provider_unavailable',
    }
  }

  return {
    selectedProvider: preferred,
    effectiveProvider: preferred,
    reason: 'none',
  }
}
