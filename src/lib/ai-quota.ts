const STORAGE_KEY = 'ai_quota_blocked_until'

export function setAIQuotaBlockedFor(minutes: number) {
  const until = Date.now() + minutes * 60_000
  localStorage.setItem(STORAGE_KEY, String(until))
}

export function isAIQuotaBlocked(): boolean {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return false
  const until = Number(raw)
  if (!Number.isFinite(until)) return false
  if (Date.now() > until) {
    localStorage.removeItem(STORAGE_KEY)
    return false
  }
  return true
}

export function clearAIQuotaBlocked() {
  localStorage.removeItem(STORAGE_KEY)
}
