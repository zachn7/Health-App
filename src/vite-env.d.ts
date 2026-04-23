/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly MODE: string
  readonly BASE_URL: string
  readonly PROD: boolean
  readonly DEV: boolean
  readonly SSR: boolean

  // Public build-time env (Vite exposes VITE_* vars to the client bundle)
  readonly VITE_USDA_API_KEY?: string
  readonly VITE_FDC_API_KEY?: string
  readonly VITE_AI_PROXY_BASE_URL?: string
  readonly VITE_OPENAI_MODEL_ID?: string
  readonly VITE_BUILD_SHA?: string
  readonly VITE_BUILD_RUN?: string
  readonly VITE_BUILD_TIME?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface BuildInfo {
  commitSha: string
  buildTimestamp: string
  buildRun: string
  appVersion: string
  isProduction: boolean
}

declare const __BUILD_INFO__: BuildInfo

// WebGPU types (partial, for adapter info handling)
declare interface GPUAdapter {
  info?: {
    vendor?: string;
    architecture?: string;
    device?: string;
    description?: string;
  };
  requestDevice(): Promise<GPUDevice>;
  destroy?(): void;
}

declare interface GPUDevice {
  destroy(): void;
}

declare interface Navigator {
  gpu?: {
    requestAdapter(): Promise<GPUAdapter | null>;
  };
}