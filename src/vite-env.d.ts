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