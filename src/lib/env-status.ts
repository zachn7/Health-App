export function getTrimmedEnvString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

export function getBuildTimeUSDAKeyValue(): string | null {
  const raw = import.meta.env.VITE_USDA_API_KEY || import.meta.env.VITE_FDC_API_KEY
  return getTrimmedEnvString(raw)
}

export function getBuildTimeUSDAKeyPresent(): boolean {
  return !!getBuildTimeUSDAKeyValue()
}

export function getBuildTimeAIProxyBaseUrlPresent(): boolean {
  const raw = import.meta.env.VITE_AI_PROXY_BASE_URL
  return !!getTrimmedEnvString(raw)
}

export function getBuildTimeAIProviderSelectedModel(): string | null {
  return getTrimmedEnvString(import.meta.env.VITE_OPENAI_MODEL_ID)
}
