import { AIFallbackReason } from './provider-selection'

export class HostedProxyError extends Error {
  public readonly reason: AIFallbackReason
  public readonly status?: number
  public readonly details?: string

  constructor(message: string, opts: { reason: AIFallbackReason; status?: number; details?: string }) {
    super(message)
    this.name = 'HostedProxyError'
    this.reason = opts.reason
    this.status = opts.status
    this.details = opts.details
  }
}

function looksLikeHtml(body: string) {
  const trimmed = body.trim().toLowerCase()
  return trimmed.startsWith('<!doctype html') || trimmed.startsWith('<html') || trimmed.startsWith('<head')
}

async function readBodySafely(response: Response): Promise<string> {
  try {
    return await response.text()
  } catch {
    return ''
  }
}

export async function parseJsonResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') || ''
  const raw = await readBodySafely(response)

  const isJsonContentType = contentType.toLowerCase().includes('application/json')
  const maybeJsonByShape = raw.trim().startsWith('{') || raw.trim().startsWith('[')

  if (!isJsonContentType && !maybeJsonByShape) {
    const details = looksLikeHtml(raw) ? 'html_body' : 'non_json_body'
    throw new HostedProxyError('Proxy returned a non-JSON response body.', {
      reason: 'bad_content_type',
      status: response.status,
      details,
    })
  }

  try {
    return JSON.parse(raw) as T
  } catch (error) {
    throw new HostedProxyError('Proxy returned invalid JSON.', {
      reason: 'invalid_json',
      status: response.status,
      details: error instanceof Error ? error.message : String(error),
    })
  }
}

export async function fetchJson<T>(input: RequestInfo | URL, init: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  const controller = new AbortController()
  const timeoutMs = init.timeoutMs ?? 12_000
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
    })

    if (!response.ok) {
      const body = await readBodySafely(response)
      const status = response.status
      if (status === 401 || status === 403) {
        throw new HostedProxyError('Hosted AI auth error.', { reason: 'auth_error', status })
      }
      if (status === 429) {
        throw new HostedProxyError('Hosted AI quota exceeded.', { reason: 'quota_exceeded', status })
      }
      if (status === 404) {
        throw new HostedProxyError('Hosted AI endpoint not found.', { reason: 'model_error', status })
      }

      const details = looksLikeHtml(body) ? 'html_body' : body.slice(0, 200)
      throw new HostedProxyError('Hosted AI proxy error.', { reason: 'proxy_error', status, details })
    }

    return await parseJsonResponse<T>(response)
  } catch (error) {
    if (error instanceof HostedProxyError) {
      throw error
    }
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new HostedProxyError('Hosted AI request timed out.', { reason: 'network_error' })
    }
    throw new HostedProxyError('Hosted AI network error.', {
      reason: 'network_error',
      details: error instanceof Error ? error.message : String(error),
    })
  } finally {
    clearTimeout(timeout)
  }
}

const LOCAL_OVERRIDE_KEY = '__ai_proxy_base_url__'

function isLocalhostRuntime(): boolean {
  try {
    const hostname = globalThis.location?.hostname
    return hostname === 'localhost' || hostname === '127.0.0.1'
  } catch {
    return false
  }
}

export function getHostedProxyBaseUrl(): string | null {
  const override = isLocalhostRuntime() ? localStorage.getItem(LOCAL_OVERRIDE_KEY) : null
  const raw = override || import.meta.env.VITE_AI_PROXY_BASE_URL
  if (!raw) return null

  try {
    const url = new URL(raw)
    return url.toString().replace(/\/+$/, '')
  } catch {
    return null
  }
}

export function setHostedProxyBaseUrlOverride(baseUrl: string | null) {
  if (!isLocalhostRuntime()) return

  if (!baseUrl) {
    localStorage.removeItem(LOCAL_OVERRIDE_KEY)
    return
  }

  localStorage.setItem(LOCAL_OVERRIDE_KEY, baseUrl)
}

export function getHostedProxyPublicLabel(baseUrl: string | null): string {
  if (!baseUrl) return 'not configured'
  try {
    const url = new URL(baseUrl)
    return url.origin
  } catch {
    return 'invalid url'
  }
}

export async function checkHostedProxyHealth(baseUrl: string): Promise<{ healthy: boolean; status?: number; error?: string }> {
  const candidates = [`${baseUrl}/health`, `${baseUrl}/healthz`, `${baseUrl}/v1/health`]

  for (const url of candidates) {
    try {
      const response = await fetch(url, { method: 'GET' })
      if (!response.ok) {
        continue
      }

      const contentType = response.headers.get('content-type') || ''
      if (!contentType.toLowerCase().includes('application/json')) {
        // Health endpoints should be JSON; treat anything else as unhealthy.
        return { healthy: false, status: response.status, error: 'non_json_health' }
      }

      const data = await response.json().catch(() => null) as any
      if (data && (data.ok === true || data.status === 'ok' || data.healthy === true)) {
        return { healthy: true, status: response.status }
      }

      // If it returned JSON but no obvious ok field, still treat as healthy if 200.
      return { healthy: true, status: response.status }
    } catch (error) {
      return { healthy: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  return { healthy: false, error: 'health_check_failed' }
}
