# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.6] - 2025-01-XX

### Fixed
- **WebGPU/WebLLM Robustness Fix**: Replaced deprecated `GPUAdapter.requestAdapterInfo()` API with modern `adapter.info`, preventing crashes in WebGPU diagnostics and WebLLM initialization
  - Added `src/lib/webgpu-utils.ts` with safe adapter info getter that supports both modern and legacy WebGPU APIs
  - Made adapter-info retrieval non-fatal; returns fallback info instead of throwing
  - Enhanced diagnostics UI to show adapter and device acquisition status separately
  - Coached page is now wrapped with ErrorBoundary to prevent router breakage
  - WebLLM model validation ensures selected models exist in the model list
  - Settings WebLLM toggle persists flag only without attempting full model init

### Added
- WebGPU utility functions: `getAdapterInfo()`, `isWebGPUAvailable()`, `checkWebGPUCapable()`
- Enhanced smoke tests to verify no `requestAdapterInfo` errors occur
- TypeScript type definitions for WebGPU APIs

### Tested
- All 34 smoke tests pass, including AI Coach tests
- WebGPU diagnostics page shows adapter info correctly
- Coach page renders even when WebLLM init fails (shows banner instead of crashing)

## [0.2.5] - Recent
- Previous release features

---

[0.2.6]: https://github.com/zachn7/Health-App/tree/v0.2.6
[0.2.5]: https://github.com/zachn7/Health-App/releases/tag/v0.2.5
