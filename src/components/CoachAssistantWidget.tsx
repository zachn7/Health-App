import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, Brain, Loader2, MessageSquare } from 'lucide-react'
import type { AssistantActionSuggestion } from '@/ai/types'
import { assistantService } from '@/ai/assistant-service'
import { settingsRepository } from '@/db/repositories/settings.repository'
import { getWebGPUDiagnostics } from '@/ai/webgpu'
import { getAvailableModels, validateAndRepairModelId } from '@/ai/webllmConfig'
import { getWebLLMService, peekWebLLMService } from '@/lib/webllm-service-loader'
import type { MealPlan, Profile, WorkoutPlan } from '@/types'

export interface CoachAssistantWidgetProps {
  profile: Profile
  onSuggestedWorkoutPlan: (plan: WorkoutPlan) => void
  onSuggestedMealPlan: (plan: MealPlan) => void
  onActions: (actions: AssistantActionSuggestion[]) => void
}

type ChatMessage = { role: 'user' | 'assistant'; content: string }

const STORAGE_KEY = 'ai-coach-chat-history'

function loadChatHistory(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed.messages) ? parsed.messages : []
  } catch {
    return []
  }
}

function saveChatHistory(messages: ChatMessage[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ messages }))
  } catch {
    // ignore
  }
}

export function CoachAssistantWidget(props: CoachAssistantWidgetProps) {
  const [providerId, setProviderId] = useState<'deterministic' | 'webllm' | 'openai_proxy' | 'openrouter'>('deterministic')
  const [chatOpen, setChatOpen] = useState(false)
  const [chatMessage, setChatMessage] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadChatHistory())
  const [sending, setSending] = useState(false)

  // WebLLM-specific state (only used when provider is webllm)
  const [webllmEnabled, setWebLLMEnabled] = useState(false)
  const [webllmModelLoading, setWebLLMModelLoading] = useState(false)
  const [webllmModelReady, setWebLLMModelReady] = useState(false)
  const [webllmError, setWebLLMError] = useState<string | null>(null)
  const [hasWebGPU, setHasWebGPU] = useState<boolean | null>(null)
  const [availableModels, setAvailableModels] = useState<any[]>([])
  const [selectedModelId, setSelectedModelId] = useState('')

  useEffect(() => {
    assistantService.getSelectedProviderId().then((id) => setProviderId(id as any)).catch(() => setProviderId('deterministic'))
    settingsRepository.isWebLLMCoachEnabled().then(setWebLLMEnabled).catch(() => setWebLLMEnabled(false))
  }, [])

  useEffect(() => {
    saveChatHistory(messages)
    if (messages.length > 0) setChatOpen(true)
  }, [messages])

  // Only run WebGPU diagnostics + model list if provider=webllm
  useEffect(() => {
    if (providerId !== 'webllm') return

    let cancelled = false

    ;(async () => {
      try {
        const diagnostics = await getWebGPUDiagnostics()
        if (cancelled) return
        setHasWebGPU(diagnostics.ok && diagnostics.adapterAcquired)
      } catch {
        if (cancelled) return
        setHasWebGPU(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [providerId])

  useEffect(() => {
    if (providerId !== 'webllm') return
    if (!webllmEnabled) {
      setWebLLMError('WebLLM Coach toggle is off in Settings. Turn it on if you want local AI chat.')
      return
    }
    if (hasWebGPU === false) {
      setWebLLMError('WebGPU is not available in this browser, so local AI cannot run here.')
      return
    }

    if (availableModels.length > 0) return

    ;(async () => {
      try {
        const models = await getAvailableModels()
        setAvailableModels(models)
        const savedModelId = await settingsRepository.getWebLLMModelId()
        const validation = await validateAndRepairModelId(savedModelId)
        const modelId = validation.selectedModelId || ''
        setSelectedModelId(modelId)
        if (validation.wasRepaired && validation.selectedModelId) {
          await settingsRepository.setWebLLMModelId(validation.selectedModelId)
        }
      } catch (e) {
        setWebLLMError(e instanceof Error ? e.message : 'Failed to load WebLLM models')
      }
    })()
  }, [providerId, webllmEnabled, hasWebGPU, availableModels.length])

  const aiStatus = useMemo(() => {
    if (providerId === 'openai_proxy') {
      const base = import.meta.env.VITE_AI_PROXY_BASE_URL
      if (!base) {
        return {
          ok: false,
          label: 'OpenAI proxy not configured',
          detail: 'Missing VITE_AI_PROXY_BASE_URL. Add it to your build env / GitHub Actions secrets.',
        }
      }
      return {
        ok: true,
        label: 'OpenAI proxy configured',
        detail: 'Hosted AI is enabled via your secure proxy. If quota runs out, the app will auto-fallback to local AI.',
      }
    }

    if (providerId === 'webllm') {
      if (!webllmEnabled) {
        return { ok: false, label: 'WebLLM disabled', detail: 'Enable WebLLM AI Coach in Settings.' }
      }
      if (hasWebGPU === false) {
        return { ok: false, label: 'WebGPU unavailable', detail: 'Local AI requires WebGPU. Try Chrome/Edge.' }
      }
      if (webllmModelReady) {
        return { ok: true, label: 'Local AI ready', detail: `Model: ${selectedModelId || 'default'}` }
      }
      return { ok: false, label: 'Local AI not ready', detail: webllmError || 'Load the local model to chat.' }
    }

    return {
      ok: true,
      label: 'Offline assistant',
      detail: 'Deterministic assistant (no network) is active. Switch providers in Settings for hosted or local LLM chat.',
    }
  }, [providerId, webllmEnabled, hasWebGPU, webllmModelReady, selectedModelId, webllmError])

  const initializeWebLLM = async () => {
    setWebLLMModelLoading(true)
    setWebLLMError(null)
    try {
      const service = await getWebLLMService()
      service.clearLastError()
      await service.initialize()
      setWebLLMModelReady(true)
    } catch (e) {
      const last = peekWebLLMService()?.getLastError()
      setWebLLMError(last?.message || (e instanceof Error ? e.message : 'Failed to initialize local model'))
      setWebLLMModelReady(false)
    } finally {
      setWebLLMModelLoading(false)
    }
  }

  const sendMessage = async () => {
    const text = chatMessage.trim()
    if (!text || sending) return

    setChatMessage('')
    setSending(true)

    const updated = [...messages, { role: 'user' as const, content: text }]
    setMessages(updated)

    try {
      const response = await assistantService.sendMessage(text, props.profile)
      if (response.suggestedWorkoutPlan) props.onSuggestedWorkoutPlan(response.suggestedWorkoutPlan)
      if (response.suggestedMealPlan) props.onSuggestedMealPlan(response.suggestedMealPlan)
      props.onActions(response.actions || [])

      setMessages([...updated, { role: 'assistant' as const, content: response.message }])
    } catch (e) {
      setMessages([...updated, { role: 'assistant' as const, content: `Assistant error: ${e instanceof Error ? e.message : 'unknown error'}` }])
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-medium text-gray-900">Coach Chat</h2>
          <p className="mt-1 text-sm text-gray-600">Ask about workouts, form, nutrition, recovery — and (optionally) let the coach log things for you.</p>
        </div>
        <a href="#/settings" className="btn btn-secondary btn-sm">Settings</a>
      </div>

      <div className={`mt-4 rounded-lg border p-3 ${aiStatus.ok ? 'border-green-200 bg-green-50' : 'border-yellow-200 bg-yellow-50'}`}>
        <div className="flex items-start gap-2">
          <AlertCircle className={`mt-0.5 h-4 w-4 ${aiStatus.ok ? 'text-green-700' : 'text-yellow-700'}`} />
          <div className="text-sm">
            <div className="font-medium text-gray-900">Provider: {providerId}</div>
            <div className="text-gray-700">{aiStatus.label}</div>
            <div className="text-gray-600 text-xs mt-1">{aiStatus.detail}</div>
          </div>
        </div>
      </div>

      {providerId === 'webllm' && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <select
            value={selectedModelId}
            onChange={(e) => setSelectedModelId(e.target.value)}
            className="input text-sm max-w-xs"
            disabled={availableModels.length === 0}
          >
            {availableModels.length === 0 ? (
              <option value="">Loading models...</option>
            ) : (
              availableModels.map((model) => (
                <option key={model.model_id} value={model.model_id}>
                  {model.model_id}
                </option>
              ))
            )}
          </select>
          <button
            onClick={initializeWebLLM}
            className="btn btn-primary btn-sm"
            disabled={webllmModelLoading || hasWebGPU === false || !webllmEnabled}
          >
            {webllmModelLoading ? (
              <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Loading</>
            ) : (
              <><Brain className="h-4 w-4 mr-1" />Load local AI</>
            )}
          </button>
        </div>
      )}

      <div className="mt-4">
        {!chatOpen ? (
          <div className="text-center py-6">
            <MessageSquare className="mx-auto h-10 w-10 text-gray-300" />
            <p className="mt-3 text-sm text-gray-600">Open chat to start.</p>
            <button className="btn btn-primary mt-3" onClick={() => setChatOpen(true)}>
              Open chat
            </button>
          </div>
        ) : (
          <div className="border rounded-lg">
            <div className="h-80 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 ? (
                <div className="text-center text-sm text-gray-500 py-8">
                  Ask something like: “Log 200g chicken breast for lunch” or “How do I do a bench press safely?”
                </div>
              ) : (
                messages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-lg p-3 text-sm ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-900'}`}>
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                    </div>
                  </div>
                ))
              )}
              {sending && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 text-gray-900 p-3 rounded-lg text-sm flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Thinking...
                  </div>
                </div>
              )}
            </div>

            <div className="border-t p-3 flex gap-2">
              <input
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                className="input flex-1"
                placeholder="Ask your coach..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') sendMessage()
                }}
              />
              <button className="btn btn-primary" onClick={sendMessage} disabled={sending}>
                Send
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
