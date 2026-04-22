import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import SettingsDiagnosticsPanel from '@/components/SettingsDiagnosticsPanel'
import { testIds } from '@/testIds'

vi.mock('@/db/repositories/settings.repository', () => {
  return {
    settingsRepository: {
      getSettings: vi.fn(async () => ({
        id: 'user-settings',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        enableUSDALookups: false,
        enableWebLLMCoach: false,
        aiProvider: 'openai_proxy',
        aiAllowLoggingActions: true,
      })),
    },
  }
})

vi.mock('@/lib/env-status', () => {
  return {
    getBuildTimeUSDAKeyPresent: vi.fn(() => true),
    getBuildTimeAIProxyBaseUrlPresent: vi.fn(() => false),
  }
})

vi.mock('@/ai/diagnostics', () => {
  return {
    getAssistantFallback: vi.fn(() => null),
    onAssistantFallback: vi.fn(() => () => {}),
  }
})

vi.mock('@/lib/settings-events', () => {
  return {
    onSettingsChanged: vi.fn(() => () => {}),
  }
})

describe('SettingsDiagnosticsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders non-secret env + provider diagnostics', async () => {
    render(<SettingsDiagnosticsPanel />)

    expect(await screen.findByTestId(testIds.settings.diagnosticsPanel)).toBeInTheDocument()
    expect(screen.getByTestId(testIds.settings.diagnosticsAiProvider)).toHaveTextContent('openai_proxy')
    expect(screen.getByTestId(testIds.settings.diagnosticsUsda)).toHaveTextContent(/Build key detected/i)
    expect(screen.getByTestId(testIds.settings.diagnosticsAiProxy)).toHaveTextContent(/missing/i)
  })
})
