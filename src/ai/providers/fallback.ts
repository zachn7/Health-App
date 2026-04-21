export async function pickBestLocalFallback(): Promise<'webllm' | 'deterministic'> {
  try {
    const { WebLLMAssistantProvider } = await import('./webllm')
    const { repositories } = await import('@/db')
    const provider = new WebLLMAssistantProvider(() => repositories.nutrition.getMealTemplates())
    if (await provider.isAvailable()) return 'webllm'
  } catch {
    // ignore
  }

  return 'deterministic'
}
