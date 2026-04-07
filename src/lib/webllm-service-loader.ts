type WebLLMServiceModule = typeof import('./webllm-service')
type WebLLMService = WebLLMServiceModule['webllmService']

let loadedWebLLMService: WebLLMService | null = null
let webllmServicePromise: Promise<WebLLMService> | null = null

export async function getWebLLMService(): Promise<WebLLMService> {
  if (loadedWebLLMService) {
    return loadedWebLLMService
  }

  if (!webllmServicePromise) {
    webllmServicePromise = import('./webllm-service').then(({ webllmService }) => {
      loadedWebLLMService = webllmService
      return webllmService
    })
  }

  return await webllmServicePromise
}

export function peekWebLLMService(): WebLLMService | null {
  return loadedWebLLMService
}
