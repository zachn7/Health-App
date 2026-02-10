/**
 * WebGPU utility functions for safely checking GPU capabilities
 * and retrieving adapter information without causing crashes.
 */

export interface AdapterInfo {
  vendor?: string;
  architecture?: string;
  device?: string;
  description?: string;
  isFallback?: boolean;
}

/**
 * Safely retrieve GPU adapter information without throwing errors.
 * 
 * This function uses the modern GPUAdapter.info API only (Chrome 113+, Safari 18.2+).
 * If adapter.info is unavailable, it returns a fallback object rather than throwing.
 * 
 * @param adapter - The GPUAdapter instance from navigator.gpu.requestAdapter()
 * @returns Adapter info object, or a fallback object if unavailable
 */
export function getAdapterInfo(adapter: GPUAdapter): AdapterInfo {
  if (!adapter) {
    return {
      vendor: 'Adapter unavailable',
      architecture: 'unknown',
      device: 'unknown',
      description: 'No GPU adapter provided',
      isFallback: true
    };
  }

  try {
    // Try the modern adapter.info API (Chrome 113+, Safari 18.2+) - sync API only
    if ('info' in adapter) {
      const info = (adapter as any).info;
      return {
        vendor: info.vendor || 'Unknown',
        architecture: info.architecture || 'Unknown',
        device: info.device || 'Unknown',
        description: info.description || '',
        isFallback: false
      };
    }
  } catch (error: any) {
    // Silently fall through to fallback
  }

  // No adapter info available - return non-fatal fallback
  return {
    vendor: 'Adapter info unavailable',
    architecture: 'unknown',
    device: 'unknown',
    description: 'Adapter info not supported by this browser',
    isFallback: true
  };
}

/**
 * Check if WebGPU is available in the current browser.
 * This is a quick check without actually requesting an adapter.
 * 
 * @returns true if navigator.gpu exists
 */
export function isWebGPUAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator;
}

/**
 * Check if WebGPU is actually usable by requesting an adapter.
 * This is more comprehensive than isWebGPUAvailable.
 * 
 * @returns An object with availability status and optional adapter info
 */
export async function checkWebGPUCapable(): Promise<{
  available: boolean;
  adapterAcquired: boolean;
  deviceAcquired: boolean;
  adapterInfo: AdapterInfo | null;
  error: string | null;
}> {
  const result = {
    available: false,
    adapterAcquired: false,
    deviceAcquired: false,
    adapterInfo: null as AdapterInfo | null,
    error: null as string | null
  };

  // Check if WebGPU API exists
  if (!isWebGPUAvailable()) {
    result.error = 'navigator.gpu not available';
    return result;
  }

  result.available = true;

  try {
    // Try to request an adapter
    const adapter = await (navigator as any).gpu.requestAdapter();
    
    if (!adapter) {
      result.error = 'No GPU adapter available';
      return result;
    }

    result.adapterAcquired = true;

    // Safely get adapter info (non-fatal, sync)
    try {
      result.adapterInfo = getAdapterInfo(adapter);
    } catch (e) {
      // Adapter info retrieval failed - continue anyway
      console.warn('Failed to get adapter info:', e);
    }

    // Try to request a device
    try {
      const device = await adapter.requestDevice();
      if (device) {
        result.deviceAcquired = true;
        device.destroy();
      } else {
        result.error = 'Could not request GPU device';
      }
    } catch (deviceError: any) {
      result.error = `Device request failed: ${deviceError?.message || 'Unknown error'}`;
    }

    // Clean up the adapter
    adapter.destroy?.();

  } catch (error: any) {
    result.error = error?.message || 'Failed to request GPU adapter';
  }

  return result;
}
