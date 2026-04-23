import { settingsRepository } from '@/db/repositories/settings.repository'
import { getBuildTimeUSDAKeyValue } from '@/lib/env-status'

export type USDALookupKeySource = 'build' | 'settings' | 'none'
export type USDALookupDisabledReason = 'no_key' | 'disabled_in_settings'

export interface USDALookupStatus {
  enabled: boolean
  keySource: USDALookupKeySource
  buildKeyPresent: boolean
  settingsKeyPresent: boolean
  settingsEnabled: boolean
  disabledReason?: USDALookupDisabledReason
}

export async function getUSDALookupStatus(): Promise<USDALookupStatus> {
  const buildKey = getBuildTimeUSDAKeyValue()
  if (buildKey) {
    // Build-time key is always considered "enabled". There is no user-facing toggle
    // right now, and we don't want users stuck behind an "old" local setting.
    return {
      enabled: true,
      keySource: 'build',
      buildKeyPresent: true,
      settingsKeyPresent: false,
      settingsEnabled: false,
    }
  }

  const settingsKey = (await settingsRepository.getFdcApiKey()) || null
  const settingsEnabled = await settingsRepository.isUSDALookupsEnabled()

  if (!settingsKey) {
    return {
      enabled: false,
      keySource: 'none',
      buildKeyPresent: false,
      settingsKeyPresent: false,
      settingsEnabled,
      disabledReason: 'no_key',
    }
  }

  if (!settingsEnabled) {
    return {
      enabled: false,
      keySource: 'settings',
      buildKeyPresent: false,
      settingsKeyPresent: true,
      settingsEnabled: false,
      disabledReason: 'disabled_in_settings',
    }
  }

  return {
    enabled: true,
    keySource: 'settings',
    buildKeyPresent: false,
    settingsKeyPresent: true,
    settingsEnabled: true,
  }
}

export async function isUSDALookupsEnabled(): Promise<boolean> {
  const status = await getUSDALookupStatus()
  return status.enabled
}

export async function getUSDAApiKey(): Promise<string | null> {
  const buildKey = getBuildTimeUSDAKeyValue()
  if (buildKey) return buildKey

  const settingsKey = (await settingsRepository.getFdcApiKey()) || null
  return settingsKey
}
