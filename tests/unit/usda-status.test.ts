import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/env-status', () => {
  return {
    getBuildTimeUSDAKeyValue: vi.fn(() => null),
  }
})

vi.mock('@/db/repositories/settings.repository', () => {
  return {
    settingsRepository: {
      getFdcApiKey: vi.fn(async () => undefined),
      isUSDALookupsEnabled: vi.fn(async () => false),
    },
  }
})

describe('usda-status', () => {
  beforeEach(() => {
    // resetAllMocks resets mock implementations back to their initial vi.fn(() => ...)
    // (clearAllMocks would keep prior mockReturnValue() changes, which is not what we want here.)
    vi.resetAllMocks()
    vi.resetModules()
  })

  async function load() {
    const usda = await import('@/lib/usda-status')
    const env = await import('@/lib/env-status')
    const { settingsRepository } = await import('@/db/repositories/settings.repository')
    return { usda, env, settingsRepository }
  }

  it('reports enabled when build-time key exists', async () => {
    const { usda, env } = await load()
    ;(env.getBuildTimeUSDAKeyValue as any).mockReturnValue('build-key')

    const status = await usda.getUSDALookupStatus()
    expect(status.enabled).toBe(true)
    expect(status.keySource).toBe('build')
  })

  it('reports disabled when no key exists anywhere', async () => {
    const { usda } = await load()
    const status = await usda.getUSDALookupStatus()
    expect(status.enabled).toBe(false)
    expect(status.disabledReason).toBe('no_key')
  })

  it('reports disabled when settings key exists but toggle is off', async () => {
    const { usda, settingsRepository } = await load()
    ;(settingsRepository.getFdcApiKey as any).mockResolvedValue('settings-key')
    ;(settingsRepository.isUSDALookupsEnabled as any).mockResolvedValue(false)

    const status = await usda.getUSDALookupStatus()
    expect(status.enabled).toBe(false)
    expect(status.keySource).toBe('settings')
    expect(status.disabledReason).toBe('disabled_in_settings')
  })

  it('reports enabled when settings key exists and toggle is on', async () => {
    const { usda, settingsRepository } = await load()
    ;(settingsRepository.getFdcApiKey as any).mockResolvedValue('settings-key')
    ;(settingsRepository.isUSDALookupsEnabled as any).mockResolvedValue(true)

    const status = await usda.getUSDALookupStatus()
    expect(status.enabled).toBe(true)
    expect(status.keySource).toBe('settings')
  })
})
