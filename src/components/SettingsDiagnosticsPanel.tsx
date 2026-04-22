import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, AlertCircle, Info } from 'lucide-react'
import { settingsRepository } from '@/db/repositories/settings.repository'
import { getBuildTimeAIProxyBaseUrlPresent, getBuildTimeUSDAKeyPresent } from '@/lib/env-status'
import { getAssistantFallback, onAssistantFallback, type AssistantFallbackInfo } from '@/ai/diagnostics'
import { onSettingsChanged } from '@/lib/settings-events'
import { testIds } from '@/testIds'

function Badge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={
        'inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ' +
        (ok ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-800')
      }
    >
      {ok ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
      {label}
    </span>
  )
}

export default function SettingsDiagnosticsPanel() {
  const [aiProvider, setAiProvider] = useState<string>('deterministic')
  const [aiAllowLogging, setAiAllowLogging] = useState(false)
  const [fallbackInfo, setFallbackInfo] = useState<AssistantFallbackInfo | null>(() => getAssistantFallback())

  const envStatus = useMemo(
    () => ({
      usdaBuildKeyPresent: getBuildTimeUSDAKeyPresent(),
      aiProxyBaseUrlPresent: getBuildTimeAIProxyBaseUrlPresent(),
    }),
    [],
  )

  const refresh = async () => {
    const settings = await settingsRepository.getSettings()
    setAiProvider(settings?.aiProvider || 'deterministic')
    setAiAllowLogging(!!settings?.aiAllowLoggingActions)
  }

  useEffect(() => {
    void refresh()

    const unsubSettings = onSettingsChanged(() => {
      void refresh()
    })

    const unsubFallback = onAssistantFallback((info) => {
      setFallbackInfo(info)
    })

    return () => {
      unsubSettings()
      unsubFallback()
    }
  }, [])

  const usdaLabel = envStatus.usdaBuildKeyPresent
    ? 'Build key detected'
    : 'No build key'

  const proxyLabel = envStatus.aiProxyBaseUrlPresent
    ? 'Proxy base URL detected'
    : 'Proxy base URL missing'

  return (
    <section
      data-testid={testIds.settings.diagnosticsPanel}
      className="bg-white rounded-lg border border-gray-200 p-6"
      aria-label="Diagnostics"
    >
      <div className="flex items-center gap-2 mb-3">
        <Info className="h-5 w-5 text-primary-600" />
        <h2 className="text-xl font-semibold text-gray-900">Diagnostics</h2>
      </div>
      <p className="text-sm text-gray-600">
        Non-secret status bits so issues don&apos;t fail silently. (No keys shown, just booleans.)
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 text-sm">
        <div className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 p-3">
          <div>
            <div className="font-medium text-gray-900">AI Provider</div>
            <div className="text-gray-600">Selected provider and whether logging actions are allowed.</div>
          </div>
          <div className="text-right" data-testid={testIds.settings.diagnosticsAiProvider}>
            <div className="font-mono text-gray-900">{aiProvider}</div>
            <div className="text-xs text-gray-500">logging actions: {aiAllowLogging ? 'on' : 'off'}</div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 p-3">
          <div>
            <div className="font-medium text-gray-900">Hosted AI Proxy</div>
            <div className="text-gray-600">Build-time proxy base URL presence (required for hosted AI).</div>
          </div>
          <div className="text-right" data-testid={testIds.settings.diagnosticsAiProxy}>
            <Badge ok={envStatus.aiProxyBaseUrlPresent} label={proxyLabel} />
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 p-3">
          <div>
            <div className="font-medium text-gray-900">USDA</div>
            <div className="text-gray-600">Build-time USDA key presence and feature readiness.</div>
          </div>
          <div className="text-right" data-testid={testIds.settings.diagnosticsUsda}>
            <Badge ok={envStatus.usdaBuildKeyPresent} label={usdaLabel} />
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 p-3" data-testid={testIds.settings.diagnosticsFallback}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="font-medium text-gray-900">Last AI fallback</div>
              <div className="text-gray-600">If hosted AI fell back to local/deterministic, the reason shows here.</div>
            </div>
            <div className="text-right">
              <Badge ok={!fallbackInfo} label={fallbackInfo ? 'fallback happened' : 'no fallback recorded'} />
            </div>
          </div>

          {fallbackInfo && (
            <div className="mt-2 text-xs text-gray-600">
              <div>
                <span className="text-gray-500">Selected:</span> <span className="font-mono">{fallbackInfo.selectedProvider}</span>
              </div>
              <div>
                <span className="text-gray-500">Effective:</span> <span className="font-mono">{fallbackInfo.effectiveProvider}</span>
              </div>
              <div>
                <span className="text-gray-500">Reason:</span> <span className="font-mono">{fallbackInfo.reasonId}</span>
              </div>
              <div>
                <span className="text-gray-500">Message:</span> {fallbackInfo.message}
              </div>
              <div>
                <span className="text-gray-500">At:</span> {new Date(fallbackInfo.timestamp).toLocaleString()}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
