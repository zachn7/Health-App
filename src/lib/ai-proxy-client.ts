export interface AIProxyChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content?: string
  name?: string
  tool_call_id?: string
}

export interface AIProxyTool {
  type: 'function'
  function: {
    name: string
    description?: string
    parameters: unknown
  }
}

export interface AIProxyChatResult {
  ok: boolean
  provider?: 'openai'
  quotaExceeded?: boolean
  status?: number
  error?: unknown
  data?: {
    message: any
    usage?: any
  }
}

export interface AIProxyTranscribeResult {
  ok: boolean
  quotaExceeded?: boolean
  status?: number
  error?: unknown
  text?: string
}

function normalizeBaseUrl(raw: string): string {
  return raw.replace(/\/+$/, '')
}

export function getAIProxyBaseUrl(): string | null {
  const base = import.meta.env.VITE_AI_PROXY_BASE_URL
  if (!base || typeof base !== 'string') return null
  const trimmed = base.trim()
  if (!trimmed) return null
  return normalizeBaseUrl(trimmed)
}

export async function aiProxyChat(payload: {
  model?: string
  messages: AIProxyChatMessage[]
  tools?: AIProxyTool[]
}): Promise<AIProxyChatResult> {
  const baseUrl = getAIProxyBaseUrl()
  if (!baseUrl) {
    return { ok: false, error: 'AI proxy base URL is not configured (VITE_AI_PROXY_BASE_URL)' }
  }

  const res = await fetch(`${baseUrl}/api/ai/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })

  return await res.json()
}

export async function aiProxyTranscribe(file: Blob, fileName: string): Promise<AIProxyTranscribeResult> {
  const baseUrl = getAIProxyBaseUrl()
  if (!baseUrl) {
    return { ok: false, error: 'AI proxy base URL is not configured (VITE_AI_PROXY_BASE_URL)' }
  }

  const form = new FormData()
  form.append('file', new File([file], fileName, { type: file.type || 'audio/webm' }))

  const res = await fetch(`${baseUrl}/api/ai/transcribe`, {
    method: 'POST',
    body: form,
  })

  return await res.json()
}

export async function aiProxySpeak(text: string, options?: { voice?: string; model?: string; format?: 'mp3' | 'wav' | 'opus' }): Promise<{ ok: boolean; quotaExceeded?: boolean; status?: number; error?: unknown; blob?: Blob }> {
  const baseUrl = getAIProxyBaseUrl()
  if (!baseUrl) {
    return { ok: false, error: 'AI proxy base URL is not configured (VITE_AI_PROXY_BASE_URL)' }
  }

  const res = await fetch(`${baseUrl}/api/ai/speak`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      text,
      voice: options?.voice,
      model: options?.model,
      format: options?.format,
    }),
  })

  const contentType = res.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    const parsed = await res.json()
    return { ok: false, quotaExceeded: parsed?.quotaExceeded, status: parsed?.status, error: parsed?.error }
  }

  const blob = await res.blob()
  return { ok: true, blob }
}
