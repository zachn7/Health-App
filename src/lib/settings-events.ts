// Tiny in-browser event bus for settings changes.
// Why? Because IndexedDB updates do NOT trigger the storage event, and we want
// provider changes to be reflected immediately without telling users to reload.
//
// Zen of Python-ish: "Explicit is better than implicit." So this is a tiny,
// explicit notifier.

export const SETTINGS_CHANGED_EVENT = 'fitbud:settings-changed'
const SETTINGS_CHANGED_CHANNEL = 'fitbud:settings-changed'

export type SettingsChangedPayload = {
  updatedAt: string
}

function canUseWindow(): boolean {
  return typeof window !== 'undefined' && typeof window.addEventListener === 'function'
}

function getBroadcastChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null
  try {
    return new BroadcastChannel(SETTINGS_CHANGED_CHANNEL)
  } catch {
    return null
  }
}

const channel = getBroadcastChannel()

export function emitSettingsChanged(payload: SettingsChangedPayload) {
  if (canUseWindow()) {
    window.dispatchEvent(new CustomEvent(SETTINGS_CHANGED_EVENT, { detail: payload }))
  }
  channel?.postMessage(payload)
}

export function onSettingsChanged(handler: (payload: SettingsChangedPayload) => void): () => void {
  if (!canUseWindow() && !channel) return () => {}

  const windowListener = (event: Event) => {
    const custom = event as CustomEvent<SettingsChangedPayload>
    if (!custom?.detail?.updatedAt) return
    handler(custom.detail)
  }

  const channelListener = (event: MessageEvent) => {
    const payload = event?.data as SettingsChangedPayload
    if (!payload?.updatedAt) return
    handler(payload)
  }

  if (canUseWindow()) {
    window.addEventListener(SETTINGS_CHANGED_EVENT, windowListener)
  }

  channel?.addEventListener('message', channelListener)

  return () => {
    if (canUseWindow()) {
      window.removeEventListener(SETTINGS_CHANGED_EVENT, windowListener)
    }
    channel?.removeEventListener('message', channelListener)
  }
}
