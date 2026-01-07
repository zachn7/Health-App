/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly MODE: string
  readonly BASE_URL: string
  readonly PROD: boolean
  readonly DEV: boolean
  readonly SSR: boolean
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
  requestAdapterInfo?(): Promise<{
    vendor?: string;
    architecture?: string;
    device?: string;
    description?: string;
  }>;
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