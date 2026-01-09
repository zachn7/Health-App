/**
 * Centralized test ID constants for E2E testing
 * 
 * This file maintains a single source of truth for test IDs used throughout the app.
 * Both React components and Playwright tests import from this file to ensure
 * consistency and prevent test drift.
 * 
 * When changing test IDs:
 * 1. Update the constant here
 * 2. TypeScript will immediately show which tests need updating
 * 3. Update both the component and test at the same time
 */

export const testIds = {
  // Age Gate
  ageGate: {
    input: 'age-input',
    error: 'age-gate-error',
    continueButton: 'age-gate-continue',
  },

  // Exercise Search / Picker
  exerciseSearch: {
    input: 'exercise-search-input',
    resultsList: 'exercise-results-list',
    resultsCount: 'exercise-results-count',
    resultRow: 'exercise-result-',
    emptyState: 'exercise-search-empty-state',
    result: (id: string | number) => `exercise-result-${id}`,
    filters: {
      bodyPart: 'exercise-filter-body-part',
      equipment: 'exercise-filter-equipment',
      difficulty: 'exercise-filter-difficulty',
      clearButton: 'exercise-filter-clear',
    },
  },

  // Coach
  coach: {
    loading: 'coach-loading',
    profileRequired: 'coach-profile-required',
    heading: 'coach-heading',
    generatePlanButton: 'coach-generate-plan-btn',
  },

  // Dashboard
  dashboard: {
    statusCard: 'dashboard-status-card',
    statusTitle: 'dashboard-status-title',
    statusText: 'dashboard-status-text',
    statusIcon: 'dashboard-status-icon',
    profileCard: 'dashboard-profile-card',
    profileTitle: 'dashboard-profile-title',
  },

  // Meals
  meals: {
    createNewMealButton: 'create-new-meal-btn',
    mealCard: (id: string | number) => `meal-card-${id}`,
    editor: {
      nameInput: 'meal-editor-name-input',
      searchUsdaButton: 'meal-editor-search-usda-btn',
      addManualFoodButton: 'meal-editor-add-manual-food-btn',
      cancelButton: 'meal-editor-cancel-btn',
      saveButton: 'meal-editor-save-btn',
    },
  },

  // Nutrition
  nutrition: {
    // Totals display
    totalCalories: 'total-calories',
    totalProtein: 'total-protein',
    
    // Food logging
    addFoodButton: 'nutrition-add-food-btn',
    manualEntryButton: 'nutrition-manual-entry-btn',
    
    // USDA search
    usdaSearchButton: 'usda-search-button',
    usdaImportModal: 'usda-import-modal',
    usdaSearchInput: 'usda-search-input',
    usdaError: 'usda-error',
    usdaResults: 'usda-results',
    usdaResultRow: 'usda-result-row',
    usdaAddFoodButton: 'usda-add-food',
    usdaNoResults: 'usda-no-results',
    
    // Nutrition log
    nutritionLogList: 'nutrition-log-list',
    nutritionFoodItem: 'nutrition-food-item',
    nutritionLogItemName: 'nutrition-log-item-name',
    servingSize: 'serving-size',
    nutritionLogItemMacros: 'nutrition-log-item-macros',
    foodCalories: 'food-calories',
    foodProtein: 'food-protein',
    foodCarbs: 'food-carbs',
    foodFat: 'food-fat',
    
    // Food editing
    foodEditQuantityInput: 'nutrition-edit-quantity-input',
    foodEditUnitSelect: 'nutrition-edit-unit-select',
    foodEditUpdateButton: 'nutrition-edit-update-button',
    foodEditCancelButton: 'nutrition-edit-cancel-button',
    foodEditServingButton: 'nutrition-edit-serving-button',
    foodEditDeleteButton: 'nutrition-edit-delete-button',
    foodEditTotalGramsDisplay: 'total-grams-display',
  },

  // Workouts
  workouts: {
    // Generator
    generateEmptyPlanButton: 'generate-empty-workout-plan-btn',
    generatePlanButton: 'generate-workout-plan-btn',
    generatorError: 'workout-generator-error',
    generatorRetryButton: 'workout-generator-retry-btn',
    
    // Plans
    workoutPlan: (id: string | number) => `workout-plan-${id}`,
    workoutDay: (week: number, day: number) => `workout-day-${week}-${day}`,
    planExercise: (exerciseId: string | number) => `plan-exercise-${exerciseId}`,
    
    // Exercise actions
    substituteExerciseButton: 'substitute-exercise-btn',
    removeExerciseButton: 'remove-exercise-btn',
  },

  // Profile
  profile: {
    editButton: 'edit-profile-button',
    ageInput: 'profile-age-input',
    sexSelect: 'profile-sex-select',
    unitsSelect: 'profile-units-select',
    activityLevelSelect: 'profile-activity-level-select',
    experienceLevelSelect: 'profile-experience-level-select',
    macroEditorToggle: 'macro-editor-toggle',
    macroPercentProtein: 'macro-percent-protein',
    macroPercentCarbs: 'macro-percent-carbs',
    macroPercentFat: 'macro-percent-fat',
  },

  // Progress (Weight)
  progress: {
    currentWeightDisplay: 'current-weight-display',
    weightUnitLabel: 'weight-unit-label',
    weightInput: 'weight-input',
    saveWeightButton: 'save-weight-button',
  },

  // Workout Logger
  workoutLogger: {
    exerciseRow: (index: number) => `workout-logger-exercise-row-${index}`,
    timerStart: 'workout-logger-timer-start',
    timerStop: 'workout-logger-timer-stop',
    timeEntry: (index: number) => `workout-logger-time-entry-${index}`,
    timeEntryDelete: (index: number) => `workout-logger-time-entry-delete-${index}`,
    timeSection: 'workout-logger-time-section',
  },

  // Settings
  settings: {
    resetAppDataButton: 'reset-app-data-btn',
  },
} as const;

// Type assertion for better autocomplete
export type TestIds = typeof testIds;
