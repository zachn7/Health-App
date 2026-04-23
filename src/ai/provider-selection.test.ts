import { describe, expect, it } from 'vitest'
import { resolveAIProviders } from './provider-selection'

describe('resolveAIProviders', () => {
  it('prefers hosted OpenAI proxy in auto mode when configured + healthy', () => {
    const result = resolveAIProviders({
      mode: 'auto',
      manualProvider: 'deterministic',
      hostedProxy: { configured: true, healthy: true },
      webllmEnabled: true,
    })

    expect(result.selectedProvider).toBe('openai_proxy')
    expect(result.effectiveProvider).toBe('openai_proxy')
    expect(result.reason).toBe('none')
  })

  it('falls back to webllm in auto mode when proxy is unhealthy', () => {
    const result = resolveAIProviders({
      mode: 'auto',
      manualProvider: 'deterministic',
      hostedProxy: { configured: true, healthy: false },
      webllmEnabled: true,
    })

    expect(result.selectedProvider).toBe('webllm')
    expect(result.effectiveProvider).toBe('webllm')
    expect(result.reason).toBe('proxy_unhealthy')
  })

  it('falls back to deterministic in auto mode when proxy is unhealthy and webllm disabled', () => {
    const result = resolveAIProviders({
      mode: 'auto',
      manualProvider: 'deterministic',
      hostedProxy: { configured: true, healthy: false },
      webllmEnabled: false,
    })

    expect(result.selectedProvider).toBe('deterministic')
    expect(result.effectiveProvider).toBe('deterministic')
    expect(result.reason).toBe('proxy_unhealthy')
  })

  it('respects manual selection when mode is manual, but still rejects unavailable webllm', () => {
    const result = resolveAIProviders({
      mode: 'manual',
      manualProvider: 'webllm',
      hostedProxy: { configured: true, healthy: true },
      webllmEnabled: false,
    })

    expect(result.selectedProvider).toBe('webllm')
    expect(result.effectiveProvider).toBe('deterministic')
    expect(result.reason).toBe('provider_unavailable')
  })
})
