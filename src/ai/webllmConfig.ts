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

/**
 * Get a safe default model ID that should always work.
 * Preferences:
 * 1. Models ending with -MLC (standard tested models)
 * 2. Models that don't require low resources and have no special features
 * 3. First available model in the list
 */
export async function getDefaultModelId(): Promise<string | null> {
  try {
    const models = await getAvailableModels()

    if (models.length === 0) {
      console.warn('No WebLLM models available')
      return null
    }

    const mlcModel = models.find((model) => model.model_id.endsWith('-MLC'))
    if (mlcModel) {
      return mlcModel.model_id
    }

    const safeModels = models.filter(
      (model) => !model.low_resource_required && model.required_features.length === 0,
    )
    if (safeModels.length > 0) {
      return safeModels[0].model_id
    }

    return models[0].model_id
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
    .replace(/-q4f16/, '')
    .replace(/-q4f32/, '')
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
