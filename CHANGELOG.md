# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.27] - 2026-01-27

### Fixed
- **Nutrition Log Display Fix**: Imported meal plan foods now show correct servings+grams equivalence
  - Removed 100g fallback from import function to preserve true portion sizes
  - Branded foods (e.g., cheese at 28g, yogurt at 120g) display accurately
  - Manual foods with custom grams also display correctly
- **Nutrition Log Meal Groups**: All meal sections now visible even when empty
  - Breakfast, Lunch, Dinner, Snacks sections always show with Add Food buttons
  - Added per-section Add Food buttons with testIds for automation
  - Foods added via per-section buttons use correct mealGroup field
  - Empty sections show helpful messaging

### Added
- **Meal Plan Editor Enhancements**:
  - Manual food entry option in each meal section (works without USDA API)
  - Per-section "Manual" button to add custom foods
  - Inline servings/grams editing for food items in meal plans
  - Delete button for saved meal plans with confirmation modal
  - Accessible confirm modal with Cancel button auto-focused
  - TestIds for all new edit controls and delete functionality
- **Workout Plans**: Day selector carousel with completion tracking
  - Swipeable day cards with visual completion indicators
  - Day marking/progress persistence
  - Smooth animations and transitions
- **Workout Editor**: Swap replaces exercise in-place and keeps edit mode active
  - Improved UX for replacing exercises in workout plans
  - No unintended editor close after swap operation
- **E2E Tests**:
  - Test: Import meal plan food with correct servings+grams display
  - Test: Edit meal plan food serving and persist after save
  - Test: Delete meal plan with confirm modal and persist
  - Test: Add food to Dinner section using per-section Add Food button
  - Test: Meal group persistence after page reload
  - Test: Workout plans day selector and completion tracking

### Changed
- Meal plan food items now preserve servingGrams and computedTotalGrams during import
- Meal plan cards restructured for better UX (delete button, inline editing)\- Enhanced error handling for meal plan operations

### Tested
- All 183 E2E tests passing (0 failed, 0 skipped)
- Meal plan import/export flows verified
- Manual food entry tested across Nutrition and Meals pages
- Serving size editing verified in both Nutrition Log and Meal Plan editor
- Delete flow with confirmation modal tested

## [0.2.6] - 2025-01-XX

### Fixed
- **WebGPU/WebLLM Robustness Fix**: Replaced deprecated `GPUAdapter.requestAdapterInfo()` API with modern `adapter.info`, preventing crashes in WebGPU diagnostics and WebLLM initialization
  - Added `src/lib/webgpu-utils.ts` with safe adapter info getter that supports both modern and legacy WebGPU APIs
  - Made adapter-info retrieval non-fatal; returns fallback info instead of throwing
  - Enhanced diagnostics UI to show adapter and device acquisition status separately
  - Coached page is now wrapped with ErrorBoundary to prevent router breakage
  - WebLLM model validation ensures selected models exist in the model list
  - Settings WebLLM toggle persists flag only without attempting full model init

### Fixed (Coach Tab Crash-Proofing)
- **Ultra-safe WebGPU diagnostics**: Created `src/ai/webgpu.ts` with `getWebGPUDiagnostics()` that NEVER throws
  - Multiple layers of try/catch protection
  - Feature detection for both modern adapter.info and legacy requestAdapterInfo()
  - Returns structured diagnostic result instead of throwing
  - Safe synchronous WebGPU check for render cycles
- **Model validation and auto-repair**: Created `src/ai/webllmConfig.ts` with centralized model management
  - Validates selected model IDs against available model list at startup
  - Auto-repairs stale/invalid stored model IDs to safe defaults
  - Shows non-blocking toast when model is auto-repaired
  - Model list and defaults centralized in one location
- **Enhanced error handling**: Coach page now manages all AI errors internally
  - AI initialization errors are caught and displayed as inline banners
  - Coach page always renders even when AI is unavailable
  - No errors propagate to global application error boundary
- **Debug panel**: Added AI diagnostics debug section in Settings
  - Shows WebLLM package version
  - Shows selected model ID and available model count
  - Displays model validation status and auto-repair events
  - Shows last initialization error
  - Collapsible panel (DEV mode shows badge)

### Added
- WebGPU utility functions: `getAdapterInfo()`, `isWebGPUAvailable()`, `checkWebGPUCapable()` (from lib/webgpu-utils.ts)
- Ultra-safe diagnostics: `getWebGPUDiagnostics()`, `isWebGPUAvailableSync()` (from ai/webgpu.ts)
- Model validation utilities: `validateAndRepairModelId()`, `getDefaultModelId()`, `isModelIdValid()` (from ai/webllmConfig.ts)
- Enhanced smoke tests to verify no `requestAdapterInfo` errors occur
- TypeScript type definitions for WebGPU APIs
- Debug panel in Settings for AI diagnostics

### Tested
- All 34 smoke tests pass, including AI Coach tests
- WebGPU diagnostics page shows adapter info correctly
- Coach page renders even when WebLLM init fails (shows banner instead of crashing)
- No console errors related to deprecated requestAdapterInfo API

## [0.2.5] - Recent
- Previous release features

---

[0.2.6]: https://github.com/zachn7/Health-App/tree/v0.2.6
[0.2.5]: https://github.com/zachn7/Health-App/releases/tag/v0.2.5
