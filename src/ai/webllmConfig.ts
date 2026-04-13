/**
 * WebLLM configuration and model management.
 * Handles model validation, auto-repair of stale model IDs, and default model selection.
 */

export interface WebLLMModelRecord {
  model_id: string;
  model_lib: string;
  model_url: string;
  estimated_vram_bytes: number;
  low_resource_required: boolean;
  required_features: string[];
  [key: string]: any;
}

export interface ModelValidationResult {
  isValid: boolean;
  selectedModelId: string | null;
  defaultModelId: string | null;
  availableModelIds: string[];
  error: string | null;
  wasRepaired: boolean;
}

type WebLLMPackage = typeof import('@mlc-ai/web-llm')

let webllmPackagePromise: Promise<WebLLMPackage> | null = null

async function getWebLLMPackage(): Promise<WebLLMPackage> {
  if (!webllmPackagePromise) {
    webllmPackagePromise = import('@mlc-ai/web-llm')
  }

  return await webllmPackagePromise
}

/**
 * Get the full list of available WebLLM models.
 * This is sourced from the webllm package's built-in configuration.
 */
export async function getAvailableModels(): Promise<WebLLMModelRecord[]> {
  try {
    const webllm = await getWebLLMPackage()
    return (webllm as any).prebuiltAppConfig?.model_list || []
  } catch (error) {
    console.warn('Failed to get WebLLM model list:', error)
    return []
  }
}

const PREFERRED_MODEL_PATTERNS = [
  'Llama-3.2-1B-Instruct-q4f16_1-MLC',
  'Llama-3.2-1B-Instruct-q4f32_1-MLC',
  'Llama-3.2-3B-Instruct-q4f16_1-MLC',
  'Llama-3.2-3B-Instruct-q4f32_1-MLC',
  'Phi-3.5-mini-instruct-q4f16_1-MLC',
  'Phi-3.5-mini-instruct-q4f32_1-MLC',
] as const

function getModelSortScore(model: WebLLMModelRecord): number {
  const id = model.model_id
  const explicitPreferenceIndex = PREFERRED_MODEL_PATTERNS.findIndex((pattern) => id.includes(pattern))
  const preferredPatternScore = explicitPreferenceIndex === -1 ? 100 : explicitPreferenceIndex
  const lowResourcePenalty = model.low_resource_required ? 0 : 25
  const requiredFeaturePenalty = (model.required_features?.length || 0) * 10
  const estimatedVramPenalty = model.estimated_vram_bytes > 0 ? model.estimated_vram_bytes / (1024 ** 3) : 5
  const instructBonus = id.toLowerCase().includes('instruct') ? 0 : 15

  return preferredPatternScore + lowResourcePenalty + requiredFeaturePenalty + estimatedVramPenalty + instructBonus
}

/**
 * Get a safe default model ID that should work on the widest range of machines.
 * Preferences:
 * 1. Known tiny instruct-tuned models
 * 2. Low-resource models with no special required features
 * 3. Lowest estimated VRAM footprint
 */
export async function getDefaultModelId(): Promise<string | null> {
  try {
    const models = await getAvailableModels()

    if (models.length === 0) {
      console.warn('No WebLLM models available')
      return null
    }

    const sortedModels = [...models].sort((a, b) => getModelSortScore(a) - getModelSortScore(b))
    return sortedModels[0]?.model_id || null
  } catch (error) {
    console.error('Failed to get default model ID:', error)
    return null
  }
}

/**
 * Validate that a model ID exists in the available models list.
 * This is used to check against stale or invalid stored model selections.
 */
export async function isModelIdValid(modelId: string | null): Promise<boolean> {
  if (!modelId) {
    return false
  }

  try {
    const models = await getAvailableModels()
    return models.some((model) => model.model_id === modelId)
  } catch (error) {
    console.error('Failed to validate model ID:', error)
    return false
  }
}

/**
 * Validate the current selected model ID and auto-repair if invalid.
 * Returns the validated (and potentially repaired) model ID.
 */
export async function validateAndRepairModelId(selectedModelId: string | null): Promise<ModelValidationResult> {
  const result: ModelValidationResult = {
    isValid: false,
    selectedModelId,
    defaultModelId: null,
    availableModelIds: [],
    error: null,
    wasRepaired: false,
  }

  try {
    const models = await getAvailableModels()
    result.availableModelIds = models.map((model) => model.model_id)
    result.defaultModelId = await getDefaultModelId()

    if (models.length === 0) {
      result.error = 'No WebLLM models available'
      return result
    }

    if (selectedModelId && (await isModelIdValid(selectedModelId))) {
      result.isValid = true
      result.selectedModelId = selectedModelId
      return result
    }

    if (selectedModelId) {
      result.wasRepaired = true
      result.error = `Model "${selectedModelId}" not found in available models`
    } else {
      result.error = 'No model selected'
    }

    result.selectedModelId = result.defaultModelId
    result.isValid = !!result.selectedModelId

    return result
  } catch (error: any) {
    result.error = `Failed to validate model: ${error?.message || 'Unknown error'}`
    return result
  }
}

/**
 * Get human-readable model information for display.
 */
export function getModelDisplayName(modelId: string): string {
  return modelId
    .replace(/-MLC$/, '')
    .replace(/-q4f16_?1?/, '')
    .replace(/-q4f32_?1?/, '')
    .replace(/-q0f16/, '')
    .replace(/-int4/, '')
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

/**
 * Get WebLLM package version for diagnostics.
 */
export async function getWebLLMVersion(): Promise<string> {
  try {
    const webllm = await getWebLLMPackage()
    const pkg = webllm as any
    return pkg.VERSION || pkg.version || 'unknown'
  } catch (error) {
    return 'unknown'
  }
}
