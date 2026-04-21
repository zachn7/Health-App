// Cloudflare Worker: FitBud AI Proxy
// - Keeps OPENAI_API_KEY off the client
// - Provides chat (tool-calling), speech-to-text, and text-to-speech
// - Designed for static GH Pages frontend

export interface Env {
  OPENAI_API_KEY: string
  CORS_ORIGIN?: string
  DEFAULT_MODEL?: string
}

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
}

function withCors(request: Request, env: Env, extraHeaders: Record<string, string> = {}) {
  const origin = request.headers.get('origin') || ''
  const allowOrigin = env.CORS_ORIGIN || '*'

  // If CORS_ORIGIN is set, only allow that origin.
  const finalOrigin = env.CORS_ORIGIN
    ? (origin === env.CORS_ORIGIN ? origin : env.CORS_ORIGIN)
    : allowOrigin

  return {
    ...extraHeaders,
    'access-control-allow-origin': finalOrigin,
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type,authorization',
    'access-control-max-age': '86400',
  }
}

function json(request: Request, env: Env, status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...JSON_HEADERS,
      ...withCors(request, env),
    },
  })
}

async function parseJson<T>(request: Request): Promise<T> {
  const text = await request.text()
  if (!text) throw new Error('Empty request body')
  return JSON.parse(text) as T
}

function isQuotaError(payload: any): boolean {
  const msg = JSON.stringify(payload || {}).toLowerCase()
  return (
    msg.includes('insufficient_quota')
    || msg.includes('quota')
    || msg.includes('billing')
    || msg.includes('payment')
  )
}

async function proxyOpenAIJson(request: Request, env: Env, path: string, payload: unknown) {
  const res = await fetch(`https://api.openai.com/v1/${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify(payload),
  })

  const text = await res.text()
  let parsed: any = null
  try {
    parsed = JSON.parse(text)
  } catch {
    parsed = { raw: text }
  }

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: parsed,
      isQuotaError: isQuotaError(parsed),
    }
  }

  return { ok: true, status: res.status, data: parsed }
}

async function handleChat(request: Request, env: Env) {
  type ChatPayload = {
    model?: string
    messages: Array<{ role: 'system' | 'user' | 'assistant' | 'tool'; content?: string; tool_call_id?: string; name?: string }>
    tools?: any[]
  }

  const body = await parseJson<ChatPayload>(request)
  const model = body.model || env.DEFAULT_MODEL || 'gpt-5.2'

  const payload = {
    model,
    messages: body.messages,
    tools: body.tools,
    tool_choice: body.tools?.length ? 'auto' : undefined,
    temperature: 0.4,
  }

  const result = await proxyOpenAIJson(request, env, 'chat/completions', payload)
  if (!result.ok) {
    return json(request, env, 200, {
      ok: false,
      provider: 'openai',
      error: result.error,
      quotaExceeded: result.isQuotaError,
      status: result.status,
    })
  }

  const message = result.data?.choices?.[0]?.message
  return json(request, env, 200, {
    ok: true,
    provider: 'openai',
    data: {
      message,
      usage: result.data?.usage,
    },
  })
}

async function handleTranscribe(request: Request, env: Env) {
  // Expect multipart/form-data with "file" and optional "model"
  const form = await request.formData()
  const file = form.get('file')
  const model = (form.get('model') as string) || 'gpt-4o-mini-transcribe'

  if (!(file instanceof File)) {
    return json(request, env, 400, { ok: false, error: 'Missing file' })
  }

  const upstream = new FormData()
  upstream.append('file', file)
  upstream.append('model', model)

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: upstream,
  })

  const text = await res.text()
  let parsed: any = null
  try {
    parsed = JSON.parse(text)
  } catch {
    parsed = { raw: text }
  }

  if (!res.ok) {
    return json(request, env, 200, {
      ok: false,
      error: parsed,
      quotaExceeded: isQuotaError(parsed),
      status: res.status,
    })
  }

  return json(request, env, 200, { ok: true, text: parsed.text || '' })
}

async function handleSpeak(request: Request, env: Env) {
  type SpeakPayload = {
    text: string
    voice?: string
    model?: string
    format?: 'mp3' | 'wav' | 'opus'
  }

  const body = await parseJson<SpeakPayload>(request)
  const text = (body.text || '').trim()
  if (!text) return json(request, env, 400, { ok: false, error: 'Missing text' })

  const voice = body.voice || 'alloy'
  const model = body.model || 'gpt-4o-mini-tts'
  const format = body.format || 'mp3'

  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      voice,
      input: text,
      format,
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    let parsed: any = null
    try {
      parsed = JSON.parse(errText)
    } catch {
      parsed = { raw: errText }
    }

    return json(request, env, 200, {
      ok: false,
      error: parsed,
      quotaExceeded: isQuotaError(parsed),
      status: res.status,
    })
  }

  // Return audio bytes
  const audioBytes = await res.arrayBuffer()
  return new Response(audioBytes, {
    status: 200,
    headers: {
      'content-type': format === 'wav' ? 'audio/wav' : format === 'opus' ? 'audio/opus' : 'audio/mpeg',
      ...withCors(request, env),
    },
  })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: withCors(request, env) })
    }

    if (!env.OPENAI_API_KEY) {
      return json(request, env, 500, { ok: false, error: 'OPENAI_API_KEY is not configured' })
    }

    if (url.pathname === '/api/ai/chat' && request.method === 'POST') {
      return await handleChat(request, env)
    }

    if (url.pathname === '/api/ai/transcribe' && request.method === 'POST') {
      return await handleTranscribe(request, env)
    }

    if (url.pathname === '/api/ai/speak' && request.method === 'POST') {
      return await handleSpeak(request, env)
    }

    if (url.pathname === '/health') {
      return json(request, env, 200, { ok: true })
    }

    return json(request, env, 404, { ok: false, error: 'Not found' })
  },
}
