import { useEffect, useState } from 'react'
import { AlertCircle } from 'lucide-react'
import { getAssistantFallback, onAssistantFallback, type AssistantFallbackInfo } from '@/ai/diagnostics'

export default function AIAssistantFallbackBanner() {
  const [fallback, setFallback] = useState<AssistantFallbackInfo | null>(() => getAssistantFallback())

  useEffect(() => {
    return onAssistantFallback((info) => {
      setFallback(info)
    })
  }, [])

  if (!fallback) return null

  return (
    <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm" role="alert">
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 h-4 w-4 text-yellow-700" />
        <div>
          <div className="font-medium text-yellow-900">AI fallback active</div>
          <div className="text-yellow-800">
            {fallback.message}
          </div>
          <div className="mt-1 text-xs text-yellow-800/80 font-mono">
            selected={fallback.selectedProvider} effective={fallback.effectiveProvider} reason={fallback.reasonId}
          </div>
        </div>
      </div>
    </div>
  )
}
