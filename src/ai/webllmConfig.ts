/**
 * WebLLM configuration and model management.
 * Handles model validation, auto-repair of stale model IDs, and default model selection.
 */

import * as webllm from '@mlc-ai/web-llm';

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

/**
 * Get the full list of available WebLLM models.
 * This is sourced from the webllm package's built-in configuration.
 */
export function getAvailableModels(): WebLLMModelRecord[] {
  try {
    const models = (webllm as any).prebuiltAppConfig?.model_list || [];
    return models;
  } catch (e) {
    console.warn('Failed to get WebLLM model list:', e);
    return [];
  }
}

/**
 * Get a safe default model ID that should always work.
 * Preferences:
 * 1. Models ending with -MLC (standard tested models)
 * 2. Models that don't require low resources and have no special features
 * 3. First available model in the list
 */
export function getDefaultModelId(): string | null {
  try {
    const models = getAvailableModels();
    
    if (models.length === 0) {
      console.warn('No WebLLM models available');
      return null;
    }

    // Prefer -MLC models (standard naming convention)
    const mlcModel = models.find(m => m.model_id.endsWith('-MLC'));
    if (mlcModel) {
      return mlcModel.model_id;
    }

    // Prefer safe models (no special requirements)
    const safeModels = models.filter(
      m => !m.low_resource_required && m.required_features.length === 0
    );
    if (safeModels.length > 0) {
      return safeModels[0].model_id;
    }

    // Fallback to first model
    return models[0].model_id;
  } catch (e) {
    console.error('Failed to get default model ID:', e);
    return null;
  }
}

/**
 * Validate that a model ID exists in the available models list.
 * This is used to check against stale or invalid stored model selections.
 */
export function isModelIdValid(modelId: string | null): boolean {
  if (!modelId) {
    return false;
  }

  try {
    const models = getAvailableModels();
    return models.some(m => m.model_id === modelId);
  } catch (e) {
    console.error('Failed to validate model ID:', e);
    return false;
  }
}

/**
 * Validate the current selected model ID and auto-repair if invalid.
 * Returns the validated (and potentially repaired) model ID.
 */
export function validateAndRepairModelId(selectedModelId: string | null): ModelValidationResult {
  const result: ModelValidationResult = {
    isValid: false,
    selectedModelId: selectedModelId,
    defaultModelId: null,
    availableModelIds: [],
    error: null,
    wasRepaired: false
  };

  try {
    const models = getAvailableModels();
    result.availableModelIds = models.map(m => m.model_id);
    result.defaultModelId = getDefaultModelId();

    if (models.length === 0) {
      result.error = 'No WebLLM models available';
      return result;
    }

    // Check if selected model is valid
    if (selectedModelId && isModelIdValid(selectedModelId)) {
      result.isValid = true;
      result.selectedModelId = selectedModelId;
      return result;
    }

    // Model is invalid or null - repair it
    if (selectedModelId) {
      result.wasRepaired = true;
      result.error = `Model "${selectedModelId}" not found in available models`;
    } else {
      result.error = 'No model selected';
    }

    // Repair to default
    result.selectedModelId = result.defaultModelId;
    result.isValid = !!result.selectedModelId;

    return result;
  } catch (e: any) {
    result.error = `Failed to validate model: ${e?.message || 'Unknown error'}`;
    return result;
  }
}

/**
 * Get human-readable model information for display.
 */
export function getModelDisplayName(modelId: string): string {
  try {
    const models = getAvailableModels();
    const model = models.find(m => m.model_id === modelId);
    
    if (!model) {
      return modelId;
    }

    // Extract a clean name from model_id
    return modelId
      .replace(/-MLC$/, '')
      .replace(/-q4f16/, '')
      .replace(/-q4f32/, '')
      .replace(/-int4/, '')
      .split('-')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  } catch (e) {
    return modelId;
  }
}

/**
 * Get WebLLM package version for diagnostics.
 */
export function getWebLLMVersion(): string {
  try {
    const pkg = webllm as any;
    return pkg.VERSION || pkg.version || 'unknown';
  } catch (e) {
    return 'unknown';
  }
}
