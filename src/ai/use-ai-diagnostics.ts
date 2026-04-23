import { useEffect, useState } from 'react'
import type { AIRuntimeDiagnostics } from './runtime-diagnostics'
import { aiRuntimeDiagnostics } from './runtime-diagnostics'

export function useAIDiagnostics(): AIRuntimeDiagnostics {
  const [state, setState] = useState<AIRuntimeDiagnostics>(() => aiRuntimeDiagnostics.get())

  useEffect(() => {
    return aiRuntimeDiagnostics.subscribe(setState)
  }, [])

  return state
}
