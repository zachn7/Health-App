export type AssistantFallbackReasonId =
  | 'missing_proxy_base_url'
  | 'quota_blocked'
  | 'proxy_error'
  | 'provider_unavailable'

export type AssistantFallbackInfo = {
  selectedProvider: string
  effectiveProvider: string
  reasonId: AssistantFallbackReasonId
  message: string
  timestamp: string
}

const AI_FALLBACK_EVENT = 'fitbud:ai-fallback'

let lastFallback: AssistantFallbackInfo | null = null

function canUseWindow(): boolean {
  return typeof window !== 'undefined' && typeof window.dispatchEvent === 'function'
}

export function setAssistantFallback(info: Omit<AssistantFallbackInfo, 'timestamp'> & { timestamp?: string }) {
  lastFallback = {
    ...info,
    timestamp: info.timestamp || new Date().toISOString(),
  }

  if (canUseWindow()) {
    window.dispatchEvent(new CustomEvent(AI_FALLBACK_EVENT, { detail: lastFallback }))
  }
}

export function clearAssistantFallback() {
  lastFallback = null
  if (canUseWindow()) {
    window.dispatchEvent(new CustomEvent(AI_FALLBACK_EVENT, { detail: null }))
  }
}

export function getAssistantFallback(): AssistantFallbackInfo | null {
  return lastFallback
}

export function onAssistantFallback(handler: (info: AssistantFallbackInfo | null) => void): () => void {
  if (!canUseWindow()) return () => {}

  const listener = (event: Event) => {
    const custom = event as CustomEvent<AssistantFallbackInfo | null>
    handler(custom.detail || null)
  }

  window.addEventListener(AI_FALLBACK_EVENT, listener)
  return () => window.removeEventListener(AI_FALLBACK_EVENT, listener)
}
