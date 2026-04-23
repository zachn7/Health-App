import type { AIProviderId } from './types'
import type { AIFallbackReason } from './provider-selection'
import { getHostedProxyBaseUrl, getHostedProxyPublicLabel } from './hosted-proxy-client'

export type HostedProxyDiagnostics = {
  configured: boolean
  baseUrlLabel: string
  healthy: boolean | null
  lastCheckedAt: string | null
  lastError: string | null
  lastStatus: number | null
}

export type AIRuntimeDiagnostics = {
  selectedProvider: AIProviderId
  effectiveProvider: AIProviderId
  providerMode: 'auto' | 'manual'
  hostedProxy: HostedProxyDiagnostics
  lastFallbackReason: AIFallbackReason
  lastFallbackMessage: string | null
  buildInfo: typeof __BUILD_INFO__ | null
}

function tryGetBuildInfo(): typeof __BUILD_INFO__ | null {
  try {
    return __BUILD_INFO__
  } catch {
    return null
  }
}

type Listener = (next: AIRuntimeDiagnostics) => void

function getInitialProviderMode(): 'auto' | 'manual' {
  try {
    return localStorage.getItem('ai_provider_mode') === 'manual' ? 'manual' : 'auto'
  } catch {
    return 'auto'
  }
}

function makeInitialDiagnostics(): AIRuntimeDiagnostics {
  const baseUrl = getHostedProxyBaseUrl()
  return {
    selectedProvider: 'deterministic',
    effectiveProvider: 'deterministic',
    providerMode: getInitialProviderMode(),
    hostedProxy: {
      configured: !!baseUrl,
      baseUrlLabel: getHostedProxyPublicLabel(baseUrl),
      healthy: null,
      lastCheckedAt: null,
      lastError: null,
      lastStatus: null,
    },
    lastFallbackReason: 'none',
    lastFallbackMessage: null,
    buildInfo: tryGetBuildInfo(),
  }
}

class AIRuntimeDiagnosticsStore {
  private state: AIRuntimeDiagnostics = makeInitialDiagnostics()
  private listeners = new Set<Listener>()

  get(): AIRuntimeDiagnostics {
    return this.state
  }

  set(partial: Partial<AIRuntimeDiagnostics>) {
    this.state = {
      ...this.state,
      ...partial,
      hostedProxy: partial.hostedProxy
        ? { ...this.state.hostedProxy, ...partial.hostedProxy }
        : this.state.hostedProxy,
    }
    for (const listener of this.listeners) {
      listener(this.state)
    }
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
}

export const aiRuntimeDiagnostics = new AIRuntimeDiagnosticsStore()
