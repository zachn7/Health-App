import type { AssistantProvider, AssistantRequest, AssistantResponse, PlanGenerationResult } from '@/ai/types'
import { DeterministicAssistantProvider } from './deterministic'
import { pickBestLocalFallback } from './fallback'
import { aiProxyChat } from '@/lib/ai-proxy-client'
import { isAIQuotaBlocked, setAIQuotaBlockedFor } from '@/lib/ai-quota'
import { findToolSpec, getToolSpecs, toolSpecsToOpenAITools } from '@/ai/tools/registry'

function makeFallbackProvider(getMealTemplates: () => Promise<any[]>) {
  return new DeterministicAssistantProvider(getMealTemplates)
}

function isQuotaExceededResult(result: any): boolean {
  return !!result?.quotaExceeded
}

function safeString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

export class OpenAIProxyAssistantProvider implements AssistantProvider {
  id: AssistantProvider['id'] = 'openai_proxy'

  private readonly fallback: DeterministicAssistantProvider

  constructor(getMealTemplates: () => Promise<any[]>) {
    this.fallback = makeFallbackProvider(getMealTemplates)
  }

  async isAvailable(): Promise<boolean> {
    // availability is based on proxy base url configuration.
    // We do not health-check here to avoid extra calls.
    return !!import.meta.env.VITE_AI_PROXY_BASE_URL
  }

  async sendMessage(request: AssistantRequest): Promise<AssistantResponse> {
    if (!(await this.isAvailable()) || isAIQuotaBlocked()) {
      return this.fallback.sendMessage(request)
    }

    const toolSpecs = getToolSpecs()
    const tools = toolSpecsToOpenAITools(toolSpecs)

    const system = [
      'You are FitBud AI Coach.',
      'You must ONLY help with fitness, nutrition, recovery, and using this app.',
      'You are allowed to call tools to perform actions in the app (logging, creating plans).',
      'Before performing a logging action, double-check the numbers and units are plausible.',
      'When explaining an exercise, provide step-by-step form cues and common mistakes.',
      'Keep responses concise and structured.',
    ].join(' ')

    // Single-turn request for now (we rely on client-side chat history storage elsewhere).
    // TODO: We can pass message history from UI later.
    let messages: any[] = [
      { role: 'system', content: system },
      {
        role: 'user',
        content: `${request.message}\n\nContext (JSON): ${JSON.stringify(request.context)}`,
      },
    ]

    try {
      // Tool loop: allow up to 3 tool calls in a chain.
      for (let i = 0; i < 3; i++) {
        const result = await aiProxyChat({
          model: (import.meta.env.VITE_OPENAI_MODEL_ID as string) || 'gpt-5.2',
          messages,
          tools,
        })

        if (!result.ok) {
          if (isQuotaExceededResult(result)) {
            console.warn('[OpenAIProxyAssistantProvider] Quota exceeded - falling back to WebLLM/deterministic')
            setAIQuotaBlockedFor(60)
            // Prefer WebLLM if it's available, otherwise deterministic.
            const local = await pickBestLocalFallback()
            if (local === 'webllm') {
              try {
                const { WebLLMAssistantProvider } = await import('./webllm')
                const { repositories } = await import('@/db')
                const webllm = new WebLLMAssistantProvider(() => repositories.nutrition.getMealTemplates())
                return await webllm.sendMessage(request)
              } catch {
                return this.fallback.sendMessage(request)
              }
            }
            return this.fallback.sendMessage(request)
          }

          throw new Error(`AI proxy error: ${JSON.stringify(result.error)}`)
        }

        const message = result.data?.message
        if (!message) {
          return {
            provider: this.id,
            intent: 'general_coaching',
            message: 'I did not receive a response from the assistant. Try again.',
          }
        }

        messages.push({ role: 'assistant', content: message.content ?? '', tool_calls: message.tool_calls })

        const toolCalls = Array.isArray(message.tool_calls) ? message.tool_calls : []
        if (toolCalls.length === 0) {
          return {
            provider: this.id,
            intent: 'general_coaching',
            message: safeString(message.content) || 'Done.',
            actions: [],
          }
        }

        // Execute tool calls and append tool outputs
        for (const call of toolCalls) {
          const name = call?.function?.name
          const argsJson = call?.function?.arguments
          const toolCallId = call?.id

          const spec = typeof name === 'string' ? findToolSpec(name, toolSpecs) : undefined
          if (!spec) {
            messages.push({ role: 'tool', tool_call_id: toolCallId, name, content: JSON.stringify({ ok: false, message: `Unknown tool: ${name}` }) })
            continue
          }

          let args: any = {}
          try {
            args = argsJson ? JSON.parse(argsJson) : {}
          } catch {
            args = {}
          }

          const output = await spec.execute(args)
          messages.push({ role: 'tool', tool_call_id: toolCallId, name: spec.name, content: JSON.stringify(output) })
        }
      }

      return {
        provider: this.id,
        intent: 'general_coaching',
        message: 'I hit my tool-call limit. If you still need something, ask again with fewer steps.',
      }
    } catch (error) {
      console.warn('[OpenAIProxyAssistantProvider] failed; falling back:', error)
      return this.fallback.sendMessage(request)
    }
  }

  async generateWorkoutPlan(context: AssistantRequest['context']): Promise<PlanGenerationResult> {
    // Keep generation local for safety/consistency; openai tool could do it but we'd need a schema.
    return this.fallback.generateWorkoutPlan(context)
  }

  async generateMealPlan(context: AssistantRequest['context']): Promise<PlanGenerationResult> {
    return this.fallback.generateMealPlan(context)
  }
}
