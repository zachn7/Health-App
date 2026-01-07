/**
 * Ultra-safe WebGPU diagnostics that NEVER throws exceptions.
 * This is used by AI features to safely probe GPU capabilities
 * without risking app crashes.
 */

export interface SafeAdapterInfo {
  vendor: string;
  architecture: string;
  device: string;
  description: string;
  isFallback: boolean;
  method: string; // 'info', 'requestAdapterInfo', or 'none'
}

export interface WebGPUDiagnosticsResult {
  ok: boolean;
  navigatorGpuExists: boolean;
  adapterAcquired: boolean;
  deviceAcquired: boolean;
  adapterInfo: SafeAdapterInfo | null;
  error: string | null;
  errorType: 'none' | 'no-gpu' | 'no-adapter' | 'no-device' | 'adapter-info' | 'unknown';
  errorDetails?: string;
}

/**
 * Safely get adapter info from a GPUAdapter without throwing.
 * This function has multiple layers of protection and never throws.
 */
export function getSafeAdapterInfoSync(adapter: any): SafeAdapterInfo {
  if (!adapter) {
    return {
      vendor: 'Unavailable',
      architecture: 'unknown',
      device: 'unknown',
      description: 'No adapter provided',
      isFallback: true,
      method: 'none'
    };
  }

  try {
    // Try adapter.info (modern Chrome 113+, Safari 18.2+)
    if (adapter.info && typeof adapter.info === 'object') {
      const info = adapter.info;
      return {
        vendor: info.vendor || 'Unknown',
        architecture: info.architecture || 'Unknown',
        device: info.device || 'Unknown',
        description: info.description || '',
        isFallback: false,
        method: 'info'
      };
    }
  } catch (e) {
    // Silently ignore - move to next check
  }

  return {
    vendor: 'Adapter info unavailable',
    architecture: 'unknown',
    device: 'unknown',
    description: 'Adapter info API not supported',
    isFallback: true,
    method: 'none'
  };
}

/**
 * Ultra-safe WebGPU diagnostics that NEVER throws.
 * Returns a structured result with all available information.
 */
export async function getWebGPUDiagnostics(): Promise<WebGPUDiagnosticsResult> {
  const result: WebGPUDiagnosticsResult = {
    ok: false,
    navigatorGpuExists: false,
    adapterAcquired: false,
    deviceAcquired: false,
    adapterInfo: null,
    error: null,
    errorType: 'none',
    errorDetails: undefined
  };

  try {
    // Step 1: Check if navigator.gpu exists
    if (typeof navigator === 'undefined' || !('gpu' in navigator)) {
      result.errorType = 'no-gpu';
      result.error = 'navigator.gpu not available';
      result.navigatorGpuExists = false;
      return result;
    }

    result.navigatorGpuExists = true;

    // Step 2: Try to request an adapter
    let adapter: any = null;
    try {
      adapter = await (navigator as any).gpu.requestAdapter();
    } catch (e: any) {
      result.errorType = 'no-adapter';
      result.error = 'Failed to request GPU adapter';
      result.errorDetails = e?.message || String(e);
      return result;
    }

    if (!adapter) {
      result.errorType = 'no-adapter';
      result.error = 'No GPU adapter available';
      result.adapterAcquired = false;
      return result;
    }

    result.adapterAcquired = true;

    // Step 3: Safely get adapter info (async methods)
    try {
      // Try requestAdapterInfo() legacy method (async)
      if (typeof adapter.requestAdapterInfo === 'function') {
        const legacyInfo = await adapter.requestAdapterInfo().catch(() => null);
        if (legacyInfo) {
          result.adapterInfo = {
            vendor: legacyInfo.vendor || 'Unknown',
            architecture: legacyInfo.architecture || 'Unknown',
            device: legacyInfo.device || 'Unknown',
            description: legacyInfo.description || '',
            isFallback: false,
            method: 'requestAdapterInfo'
          };
        }
      }
    } catch (e) {
      // Silently ignore async errors and fall through
    }

    // If async method failed or not available, try sync method
    if (!result.adapterInfo) {
      result.adapterInfo = getSafeAdapterInfoSync(adapter);
    }

    if (result.adapterInfo?.isFallback) {
      result.errorType = 'adapter-info';
      result.error = 'Adapter info unavailable (using fallback)';
      // This is still OK - adapter exists, just can't get detailed info
    }

    // Step 4: Try to request a device to verify full capability
    try {
      const device = await adapter.requestDevice();
      if (device) {
        result.deviceAcquired = true;
        device.destroy(); // Clean up
      }
    } catch (e: any) {
      result.errorType = 'no-device';
      result.error = 'Failed to request GPU device';
      result.errorDetails = e?.message || String(e);
      // Don't return yet - we have adapter info at least
    }

    // Clean up adapter
    try {
      if (typeof adapter.destroy === 'function') {
        adapter.destroy();
      }
    } catch (e) {
      // Ignore cleanup errors
    }

    // Determine overall success
    result.ok = result.navigatorGpuExists && result.adapterAcquired;

  } catch (e: any) {
    result.errorType = 'unknown';
    result.error = 'Unexpected error during diagnostics';
    result.errorDetails = e?.message || String(e);
  }

  return result;
}

/**
 * Quick synchronous WebGPU check that NEVER throws.
 * This is safe to call during initial render cycles.
 */
export function isWebGPUAvailableSync(): boolean {
  try {
    return typeof navigator !== 'undefined' && 'gpu' in navigator;
  } catch (e) {
    return false;
  }
}
