
import { useState, useEffect, useCallback } from 'react';
import { repositories } from '../db';
import { calculateTDEE } from '../lib/coach-engine';
import { usdaService, type SearchDiagnostics, extractMacrosFromSearchResult } from '../lib/usda-service';
import { formatServingSize, computeServingsChange, calculateTotalGrams } from '../lib/serving-utils';
import { getTodayLocalDateKey, addDaysToLocalDate, formatLocalDate } from '../lib/date-utils';
import type { NutritionLog, FoodLogItem, MacroTotals, Profile, FoodItem } from '../types';

export default function Nutrition() {
  const isDev = process.env.NODE_ENV === 'development';
  const [currentLog, setCurrentLog] = useState<NutritionLog | null>(null);
  const [selectedDate, setSelectedDate] = useState(getTodayLocalDateKey());
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [newFood, setNewFood] = useState<FoodLogItem>({
    id: crypto.randomUUID(),
    name: '',
    servingSize: '1 serving',
    quantidade: 1,
    calories: 0,
    proteinG: 0,
    carbsG: 0,
    fatG: 0,
    baseUnit: 'serving',
    servingGrams: 100,
    computedTotalGrams: 100
  });
  const [showAddFood, setShowAddFood] = useState(false);
  const [showUSDAImport, setShowUSDAImport] = useState(false);
  const [usdaSearchQuery, setUSDAQuery] = useState('');
  const [usdaSearchResults, setUSDAReplies] = useState<any[]>([]);
  const [isUSDAEnabled, setIsUSDAEnabled] = useState(false);
  const [usdaSearchLoading, setUSDASearching] = useState(false);
  const [usdaSearchError, setUSDASearchError] = useState<string | null>(null);
  const [usdaSearchDiagnostics, setUSDASearchDiagnostics] = useState<SearchDiagnostics | null>(null);
  const [usdaImporting, setUSDAImporting] = useState<Set<number>>(new Set());
  const [selectedUSDAFoods, setSelectedUSDAFoods] = useState<Set<number>>(new Set());
  const [savedFoods, setSavedFoods] = useState<FoodItem[]>([]);
  const [showServingSizeEdit, setShowServingSizeEdit] = useState<string | null>(null);
  const [editingServingSize, setEditingServingSize] = useState<{
    quantity: number;
    unit: 'serving' | 'grams' | 'g';
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    fiberG?: number;
    sugarG?: number;
    sodiumMg?: number;
    originalItem?: FoodLogItem;
  }>({ quantity: 1, unit: 'serving', calories: 0, proteinG: 0, carbsG: 0, fatG: 0 });

  useEffect(() => {
    loadNutritionData();
    loadUSDAStatus();
    loadSavedFoods();
  }, [selectedDate]);

  const loadUSDAStatus = async () => {
    try {
      const enabled = await usdaService.isUSDALookupsEnabled();
      setIsUSDAEnabled(enabled);
    } catch (error) {
      console.error('Failed to load USDA status:', error);
      setIsUSDAEnabled(false);
    }
  };

  const loadSavedFoods = async () => {
    try {
      const foods = await usdaService.getSavedFDAFoods();
      setSavedFoods(foods);
    } catch (error) {
      console.error('Failed to load saved foods:', error);
    }
  };

  const loadNutritionData = async () => {
    try {
      // Load profile for targets
      const userProfile = await repositories.profile.get();
      setProfile(userProfile || null);

      // Load nutrition log for selected date
      const log = await repositories.nutrition.getNutritionLog(selectedDate);
      setCurrentLog(log || null);
    } catch (error) {
      console.error('Failed to load nutrition data:', error);
    } finally {
      setLoading(false);
    }
  };

  const navigateDate = (direction: 'prev' | 'next' | 'today') => {
    if (direction === 'today') {
      setSelectedDate(getTodayLocalDateKey());
    } else {
      setSelectedDate(addDaysToLocalDate(selectedDate, direction === 'next' ? 1 : -1));
    }
  };

  const getDailyTargets = () => {
    if (!profile) {
      return { calories: 2000, proteinG: 150, carbsG: 250, fatG: 65 };
    }
    
    const tdee = calculateTDEE(profile);
    const macros = profile.macroSplit || { protein: 30, carbs: 40, fat: 30 };
    
    // Use TDEE and custom macro split
    return {
      calories: Math.round(tdee.tdee),
      proteinG: Math.round((tdee.tdee * macros.protein / 100) / 4), // 4 cal per gram
      carbsG: Math.round((tdee.tdee * macros.carbs / 100) / 4), // 4 cal per gram
      fatG: Math.round((tdee.tdee * macros.fat / 100) / 9) // 9 cal per gram
    };
  };

  const saveFood = async () => {
    try {
      const dateStr = selectedDate;
      
      // Create a completely new object with unique ID to avoid shared references
      const foodToSave: FoodLogItem = JSON.parse(JSON.stringify({
        ...newFood,
        id: crypto.randomUUID(), // Ensure unique ID for each entry,
        createdAt: new Date().toISOString(),
        baseUnit: newFood.baseUnit || 'serving',
        servingGrams: newFood.servingGrams || 100
      }));
      
      if (!currentLog) {
        // Create new log for selected date
        const newLog: NutritionLog = {
          id: crypto.randomUUID(),
          date: dateStr,
          items: [foodToSave],
          totals: calculateTotals([foodToSave]), // Calculate from persisted entries
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await repositories.nutrition.createNutritionLog(newLog);
        setCurrentLog(newLog);
      } else {
        // Add to existing log - create new array to avoid reference issues
        const updatedItems = [...currentLog.items, foodToSave];
        const updatedLog: NutritionLog = {
          ...currentLog,
          items: updatedItems,
          totals: calculateTotals(updatedItems), // Calculate from persisted entries
          updatedAt: new Date().toISOString()
        };
        await repositories.nutrition.updateNutritionLog(updatedLog.id, updatedLog);
        setCurrentLog(updatedLog);
      }
      
      // Reset form
      setNewFood({
        id: crypto.randomUUID(),
        name: '',
        servingSize: '1 serving',
        quantidade: 1,
        calories: 0,
        proteinG: 0,
        carbsG: 0,
        fatG: 0,
        baseUnit: 'serving',
        servingGrams: 100,
        computedTotalGrams: 100
      });
      setShowAddFood(false);
    } catch (error) {
      console.error('Failed to save food:', error);
      alert('Failed to save food item. Please try again.');
    }
  };

  const calculateTotals = (items: FoodLogItem[]): MacroTotals => {
    return items.reduce(
      (totals, item) => ({
        calories: totals.calories + item.calories * item.quantidade,
        proteinG: totals.proteinG + item.proteinG * item.quantidade,
        carbsG: totals.carbsG + item.carbsG * item.quantidade,
        fatG: totals.fatG + item.fatG * item.quantidade,
        fiberG: (totals.fiberG || 0) + ((item.fiberG || 0) * item.quantidade),
        sugarG: (totals.sugarG || 0) + ((item.sugarG || 0) * item.quantidade),
        sodiumMg: (totals.sodiumMg || 0) + ((item.sodiumMg || 0) * item.quantidade)
      }),
      {
        calories: 0,
        proteinG: 0,
        carbsG: 0,
        fatG: 0,
        fiberG: 0,
        sugarG: 0,
        sodiumMg: 0
      }
    );
  };

  const deleteFood = async (foodId: string) => {
    const dateStr = selectedDate;
    
    try {
      // Use the queue-based delete method to ensure atomicity
      const updatedLog = await repositories.nutrition.deleteFoodFromDayLog(dateStr, foodId);
      
      // Update React state with the DB source of truth
      setCurrentLog(updatedLog);
    } catch (error) {
      console.error('Failed to delete food:', error);
      alert('Failed to delete food item. Please try again.');
    }
  };

  // Debounced search function
  const searchUSDAFoods = useCallback(async () => {
    if (!usdaSearchQuery.trim() || usdaSearchQuery.length < 2) {
      setUSDAReplies([]);
      setUSDASearchError(null);
      setUSDASearchDiagnostics(null);
      return;
    }
    
    setUSDASearching(true);
    setUSDASearchError(null);
    
    try {
      const { results, diagnostics } = await usdaService.searchFoods(usdaSearchQuery);
      setUSDAReplies(results);
      setUSDASearchDiagnostics(diagnostics);
    } catch (error) {
      console.error('USDA search failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to search USDA foods';
      setUSDASearchError(errorMessage);
      setUSDAReplies([]);
    } finally {
      setUSDASearching(false);
    }
  }, [usdaSearchQuery]);

  // Debounced search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isUSDAEnabled && showUSDAImport) {
        searchUSDAFoods();
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [usdaSearchQuery, isUSDAEnabled, showUSDAImport, searchUSDAFoods]);

  const importUSDAFood = async (fdcId: number, description: string) => {
    // Mark as importing
    setUSDAImporting(new Set([...usdaImporting, fdcId]));
    
    try {
      // Use the new normalized method to create food log item
      // Default to 1 serving with proper macro normalization
      const foodLogItem = await usdaService.createFoodLogItem(fdcId, 1, 'serving');
      
      await saveFoodItem(foodLogItem);
      
      // Remove from importing list
      setUSDAImporting(prev => {
        const next = new Set(prev);
        next.delete(fdcId);
        return next;
      });
      
      // Also remove from selected if batch add
      setSelectedUSDAFoods(prev => {
        const next = new Set(prev);
        next.delete(fdcId);
        return next;
      });
      
      // Reload nutrition data to ensure currentLog is updated from IndexedDB
      await loadNutritionData();
    } catch (error) {
      console.error('Failed to import USDA food:', error);
      alert(`Failed to import ${description}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Remove from importing on error
      setUSDAImporting(prev => {
        const next = new Set(prev);
        next.delete(fdcId);
        return next;
      });
    }
  };

  const toggleUSDAFoodSelection = (fdcId: number) => {
    const newSelection = new Set(selectedUSDAFoods);
    if (newSelection.has(fdcId)) {
      newSelection.delete(fdcId);
    } else {
      newSelection.add(fdcId);
    }
    setSelectedUSDAFoods(newSelection);
  };

  const importSelectedUSDAFoods = async () => {
    if (selectedUSDAFoods.size === 0) return;
    
    // Set all selected foods as importing
    setUSDAImporting(new Set([...usdaImporting, ...selectedUSDAFoods]));
    
    let successCount = 0;
    let failCount = 0;
    
    for (const fdcId of selectedUSDAFoods) {
      try {
        const foodLogItem = await usdaService.createFoodLogItem(fdcId, 1, 'serving');
        await saveFoodItem(foodLogItem);
        successCount++;
      } catch (error) {
        console.error(`Failed to import food ${fdcId}:`, error);
        failCount++;
      }
      // Remove from importing
      setUSDAImporting(prev => {
        const newSet = new Set(prev);
        newSet.delete(fdcId);
        return newSet;
      });
    }
    
    // Clear selection after import
    setSelectedUSDAFoods(new Set());
    
    // Reload nutrition data to ensure currentLog is updated from IndexedDB
    await loadNutritionData();
    
    // Show result summary
    if (failCount > 0) {
      alert(`Imported ${successCount} food(s). ${failCount} failed.`);
    }
  };

  const updateFoodServingSize = async (foodItemId: string) => {
    const dateStr = selectedDate;
    
    try {
      // Validate numeric input
      if (isNaN(editingServingSize.quantity) || editingServingSize.quantity <= 0) {
        alert('Please enter a valid positive number for quantity');
        return;
      }
      
      // Get the latest log from DB (not from React state) to avoid stale data
      const latestLog = await repositories.nutrition.getNutritionLog(dateStr);
      if (!latestLog) {
        throw new Error('Nutrition log not found');
      }
      
      // Find the original food item from the latest DB data
      const originalItem = latestLog.items.find(item => item.id === foodItemId);
      if (!originalItem) {
        throw new Error('Food item not found');
      }
      
      // Use shared helper for serving calculations
      const result = computeServingsChange({
        originalItem,
        editedQuantity: editingServingSize.quantity,
        editedUnit: editingServingSize.unit === 'grams' || editingServingSize.unit === 'g' ? 'grams' : 'serving'
      });
      
      const updates = {
        servingSize: result.newDisplayServingSize,
        quantidade: result.newQuantity,
        servingGrams: result.newServingGrams,
        baseUnit: result.newBaseUnit,
        calories: result.newCalories,
        proteinG: result.newProteinG,
        carbsG: result.newCarbsG,
        fatG: result.newFatG,
        fiberG: result.newFiberG,
        sugarG: result.newSugarG,
        sodiumMg: result.newSodiumMg,
        computedTotalGrams: result.newTotalGrams,
        updatedAt: new Date().toISOString()
      };
      
      // Use the queue-based update method to ensure atomicity
      const updatedLog = await repositories.nutrition.updateFoodInDayLog(dateStr, foodItemId, updates);
      
      // Update React state with the DB source of truth
      setCurrentLog(updatedLog);
      
      // Close the edit modal
      setShowServingSizeEdit(null);
    } catch (error) {
      console.error('Failed to update serving size:', error);
      alert('Failed to update serving size. Please try again.');
    }
  };

  const startEditServingSize = (item: FoodLogItem) => {
    // Preserve the item's current unit when editing
    // This allows users to continue editing in their preferred unit (serving or grams)
    const quantity = item.quantidade || 1;
    const unit: 'serving' | 'grams' | 'g' = item.baseUnit || 'serving';
    
    setEditingServingSize({
      quantity,
      unit,
      calories: item.calories,
      proteinG: item.proteinG,
      carbsG: item.carbsG,
      fatG: item.fatG,
      fiberG: item.fiberG,
      sugarG: item.sugarG,
      sodiumMg: item.sodiumMg,
      originalItem: item // Store reference for calculations
    });
    setShowServingSizeEdit(item.id);
  };

  const saveFoodItem = async (foodItem: FoodLogItem) => {
    const dateStr = selectedDate;
    
    // Canonical model: computedTotalGrams = quantidade * servingGrams
    const computedTotalGrams = foodItem.quantidade * (foodItem.servingGrams || 100);
    
    // Create a completely new object with unique ID to avoid shared references
    const foodToSave: FoodLogItem = JSON.parse(JSON.stringify({
      ...foodItem,
      id: crypto.randomUUID(), // Ensure unique ID for each entry
      baseUnit: foodItem.baseUnit || 'serving',
      servingGrams: foodItem.servingGrams || 100,
      computedTotalGrams,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }));
    
    // Use the atomic queue-based add method to prevent race conditions
    const updatedLog = await repositories.nutrition.addFoodToDayLog(dateStr, foodToSave);
    
    // Update React state with the DB source of truth
    setCurrentLog(updatedLog);
  };

  const addSavedFood = async (food: FoodItem) => {
    // Try to parse servingGrams from servingSize if it includes grams
    const match = food.servingSize.match(/([\d.]+)\s*g/i);
    const servingGrams = match ? parseFloat(match[1]) : 100;
    
    // Canonical model: computedTotalGrams = quantidade * servingGrams
    const computedTotalGrams = 1 * servingGrams;
    
    const foodLogItem: FoodLogItem = {
      id: crypto.randomUUID(),
      name: food.name,
      servingSize: food.servingSize,
      quantidade: 1,
      calories: food.calories,
      proteinG: food.proteinG,
      carbsG: food.carbsG,
      fatG: food.fatG,
      fiberG: food.fiberG,
      sugarG: food.sugarG,
      sodiumMg: food.sodiumMg,
      baseUnit: 'serving',
      servingGrams,
      computedTotalGrams
    };
    
    await saveFoodItem(foodLogItem);
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">Loading nutrition data...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Nutrition</h1>
        <p className="mt-2 text-gray-600">Track your meals and macros</p>
      </div>
      
      {/* Date Navigation */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-medium text-gray-900">Nutrition Log</h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => navigateDate('prev')}
              className="btn btn-secondary btn-sm"
            >
              ← Previous
            </button>
            <button
              onClick={() => navigateDate('today')}
              className={`btn btn-sm ${
                selectedDate === getTodayLocalDateKey() 
                  ? 'btn-primary' 
                  : 'btn-secondary'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => navigateDate('next')}
              className="btn btn-secondary btn-sm"
            >
              Next →
            </button>
          </div>
        </div>
        
        <div className="text-center text-lg font-medium mb-4">
          {formatLocalDate(selectedDate, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
        
        {/* Daily Totals with 0/target format */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {currentLog ? Math.round(currentLog.totals.calories) : 0}
              <span className="text-lg text-gray-500">/{getDailyTargets().calories}</span>
            </div>
            <div className="text-sm text-gray-600">Calories</div>
            <div data-testid="total-calories" className="hidden">
              {currentLog ? Math.round(currentLog.totals.calories) : 0}
            </div>
            {currentLog && (
              <div className="text-xs text-gray-500 mt-1">
                {Math.round((currentLog.totals.calories / getDailyTargets().calories) * 100)}%
              </div>
            )}
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {currentLog ? Math.round(currentLog.totals.proteinG) : 0}g
              <span className="text-lg text-gray-500">/{getDailyTargets().proteinG}g</span>
            </div>
            <div className="text-sm text-gray-600">Protein</div>
            <div data-testid="total-protein" className="hidden">
              {currentLog ? Math.round(currentLog.totals.proteinG) : 0}
            </div>
            {currentLog && (
              <div className="text-xs text-gray-500 mt-1">
                {Math.round((currentLog.totals.proteinG / getDailyTargets().proteinG) * 100)}%
              </div>
            )}
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">
              {currentLog ? Math.round(currentLog.totals.carbsG) : 0}g
              <span className="text-lg text-gray-500">/{getDailyTargets().carbsG}g</span>
            </div>
            <div className="text-sm text-gray-600">Carbs</div>
            {currentLog && (
              <div className="text-xs text-gray-500 mt-1">
                {Math.round((currentLog.totals.carbsG / getDailyTargets().carbsG) * 100)}%
              </div>
            )}
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">
              {currentLog ? Math.round(currentLog.totals.fatG) : 0}g
              <span className="text-lg text-gray-500">/{getDailyTargets().fatG}g</span>
            </div>
            <div className="text-sm text-gray-600">Fat</div>
            {currentLog && (
              <div className="text-xs text-gray-500 mt-1">
                {Math.round((currentLog.totals.fatG / getDailyTargets().fatG) * 100)}%
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Add Food Buttons */}
      <div className="mb-6 flex flex-wrap gap-2">
        <button
          onClick={() => {
            setShowAddFood(true);
            setShowUSDAImport(false);
          }}
          className="btn btn-primary"
        >
          Manual Entry
        </button>
        
        {isUSDAEnabled && (
          <button
            data-testid="usda-search-button"
            onClick={() => {
              setShowUSDAImport(true);
              setShowAddFood(false);
            }}
            className="btn btn-secondary"
          >
            Search USDA Database
          </button>
        )}
        
        {savedFoods.length > 0 && (
          <div className="dropdown relative">
            <button className="btn btn-outline-secondary dropdown-toggle">
              Saved Foods ({savedFoods.length})
            </button>
            <div className="dropdown-content right-0 mt-1 w-80 max-h-64 overflow-y-auto">
              {savedFoods.map((food) => (
                <button
                  key={food.id}
                  onClick={() => addSavedFood(food)}
                  className="dropdown-item text-left"
                >
                  <div className="font-medium">{food.name}</div>
                  <div className="text-xs text-gray-500">
                    {food.servingSize} • {Math.round(food.calories)} cal
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
        
        {!isUSDAEnabled && (
          <div className="text-sm text-gray-500">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
              USDA lookup requires API key in Settings
            </span>
          </div>
        )}
      </div>
      
      {/* USDA Import Modal */}
      {showUSDAImport && (
        <div className="card mb-6" data-testid="usda-import-modal">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Search USDA FoodData Central
          </h3>
          
          <div className="mb-4">
            <input
              data-testid="usda-search-input"
              type="text"
              value={usdaSearchQuery}
              onChange={(e) => setUSDAQuery(e.target.value)}
              className="input w-full"
              placeholder="Type to search foods (e.g., chicken breast, banana) - results appear automatically"
            />
            {usdaSearchLoading && (
              <div className="mt-2 text-sm text-gray-600">Searching...</div>
            )}
            {usdaSearchError && (
              <div data-testid="usda-error" className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <div className="text-red-600">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-red-800">Search Error</div>
                    <div className="text-sm text-red-700 mt-1">{usdaSearchError}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {usdaSearchResults.length > 0 && (
            <div data-testid="usda-results" className="space-y-2 max-h-80 overflow-y-auto">
              {usdaSearchResults.length > 0 && (
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-gray-700">Search Results ({usdaSearchResults.length}):</h4>
                  {selectedUSDAFoods.size > 0 && (
                    <button
                      onClick={importSelectedUSDAFoods}
                      disabled={usdaImporting.size > 0}
                      className="btn btn-sm btn-primary"
                    >
                      Add Selected ({selectedUSDAFoods.size})
                    </button>
                  )}
                </div>
              )}
              {usdaSearchResults.map((food) => {
                const macros = extractMacrosFromSearchResult(food);
                const isImporting = usdaImporting.has(food.fdcId);
                const isSelected = selectedUSDAFoods.has(food.fdcId);
                const hasMacros = macros && (macros.calories > 0 || macros.proteinG > 0 || macros.carbsG > 0 || macros.fatG > 0);
                
                return (
                  <div key={food.fdcId} data-testid="usda-result-row" data-fdc-id={food.fdcId} className={`p-3 border border-gray-200 rounded-lg hover:bg-gray-50 ${isSelected ? 'bg-blue-50 border-blue-300' : ''}`}>
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            id={`select-${food.fdcId}`}
                            checked={isSelected}
                            onChange={() => toggleUSDAFoodSelection(food.fdcId)}
                            className="mt-1 h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                          />
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{food.description}</div>
                            {food.brandOwner && (
                              <div className="text-sm text-gray-500">{food.brandOwner}</div>
                            )}
                            {food.foodCategory && (
                              <div className="text-sm text-gray-500">{food.foodCategory}</div>
                            )}
                            
                            {hasMacros && (
                              <div className="mt-2 flex flex-wrap gap-3 text-xs font-medium">
                                <span className={macros.calories > 0 ? 'text-gray-900' : 'text-gray-400'}>
                                  {macros.calories} cal
                                </span>
                                <span className={macros.proteinG > 0 ? 'text-blue-600' : 'text-gray-400'}>
                                  {macros.proteinG.toFixed(1)}g protein
                                </span>
                                <span className={macros.carbsG > 0 ? 'text-yellow-600' : 'text-gray-400'}>
                                  {macros.carbsG.toFixed(1)}g carbs
                                </span>
                                <span className={macros.fatG > 0 ? 'text-red-600' : 'text-gray-400'}>
                                  {macros.fatG.toFixed(1)}g fat
                                </span>
                                <span className="text-gray-500 font">
                                  {macros.basis === 'per_100g' ? '1 serving (100g)' : '1 serving'}
                                </span>
                              </div>
                            )}
                            
                            {!hasMacros && (
                              <div className="mt-2 text-xs text-gray-400 italic">
                                Tap "Add" to fetch detailed nutrition info
                              </div>
                            )}
                            
                            <div className="flex flex-wrap gap-3 text-xs text-gray-500 mt-1">
                              <span className="font-medium">Type:</span>
                              <span>{food.dataType}</span>
                              {food.gtinUpc && (
                                <>
                                  <span className="font-medium">| UPC:</span>
                                  <span>{food.gtinUpc}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      <button
                        data-testid="usda-add-food"
                        onClick={() => importUSDAFood(food.fdcId, food.description)}
                        disabled={isImporting}
                        className="btn btn-sm btn-primary ml-4"
                      >
                        {isImporting ? 'Adding...' : 'Add'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          
          {!usdaSearchLoading && usdaSearchQuery && usdaSearchResults.length === 0 && (
            <div data-testid="usda-no-results" className="text-center py-4 text-gray-500">
              {usdaSearchError
                ? usdaSearchError
                : `No results found for "${usdaSearchQuery}"`
              }
            </div>
          )}
          
          <div className="flex justify-end mt-4">
            <button
              onClick={() => {
                setShowUSDAImport(false);
                setUSDAQuery('');
                setUSDAReplies([]);
                setUSDASearchError(null);
                setUSDASearchDiagnostics(null);
                setSelectedUSDAFoods(new Set());
              }}
              className="btn btn-secondary"
            >
              Close
            </button>
          </div>
        </div>
      )}
      
      {/* DEV: USDA Status Diagnostics */}
      {isDev && usdaSearchDiagnostics && (
        <div className="mt-6 bg-gray-900 text-gray-100 rounded-lg p-4 font-mono text-xs">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
            <h4 className="text-sm font-semibold text-blue-400">USDA Search Diagnostics (DEV)</h4>
          </div>
          
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-400">Query:</span>
              <span className="text-green-400">{usdaSearchDiagnostics.query}</span>
            </div>
            
            <div className="flex flex-col gap-1">
              <span className="text-gray-400">Request URL:</span>
              <span className="text-yellow-400 break-all text-[10px]">
                {usdaSearchDiagnostics.url.replace(/api_key=[^&]+/, 'api_key=***REDACTED***')}
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-400">Status Code:</span>
              <span className={
                usdaSearchDiagnostics.status === 200 ? 'text-green-400' :
                usdaSearchDiagnostics.status && usdaSearchDiagnostics.status >= 400 ? 'text-red-400' :
                'text-yellow-400'
              }>
                {usdaSearchDiagnostics.status ?? 'PENDING'}
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-400">Results:</span>
              <span className="text-green-400">{usdaSearchDiagnostics.resultCount}</span>
            </div>
            
            {usdaSearchDiagnostics.errorMessage && (
              <div className="flex flex-col gap-1 mt-2 pt-2 border-t border-gray-700">
                <span className="text-red-400 font-semibold">Error:</span>
                <span className="text-red-300">{usdaSearchDiagnostics.errorMessage}</span>
              </div>
            )}
            
            <div className="flex justify-between">
              <span className="text-gray-400">Timestamp:</span>
              <span className="text-gray-500">
                {new Date(usdaSearchDiagnostics.timestamp).toLocaleTimeString()}
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-400">USDA Enabled:</span>
              <span className={isUSDAEnabled ? 'text-green-400' : 'text-red-400'}>
                {isUSDAEnabled ? 'YES' : 'NO'}
              </span>
            </div>
          </div>
        </div>
      )}
      
      {/* DEV: Nutrition Entry Diagnostics - Shows last added entry details */}
      {isDev && currentLog && currentLog.items && currentLog.items.length > 0 && (
        <div className="mt-6 bg-gray-900 text-gray-100 rounded-lg p-4 font-mono text-xs">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" />
            <h4 className="text-sm font-semibold text-purple-400">Last Nutrition Entry (DEV)</h4>
          </div>
          
          <div className="space-y-1">
            {(() => {
              const lastItem = currentLog!.items![currentLog!.items!.length - 1];
              return (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Name:</span>
                    <span className="text-green-400">{lastItem.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Date Key:</span>
                    <span className="text-yellow-400">{currentLog!.date}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Entry ID:</span>
                    <span className="text-gray-500 text-[10px]">{lastItem.id.slice(0, 8)}...</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Unit Label:</span>
                    <span className={lastItem.baseUnit === 'serving' ? 'text-green-400' : 'text-orange-400'}>
                      {lastItem.baseUnit === 'serving' ? 'serving' : 'grams'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Quantity:</span>
                    <span className="text-blue-400">{lastItem.quantidade}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Grams Per Unit:</span>
                    <span className="text-blue-400">{lastItem.servingGrams}g</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Total Grams:</span>
                    <span className="text-purple-400 font-bold">{lastItem.computedTotalGrams}g</span>
                  </div>
                  <div className="mt-2 pt-2 border-t border-gray-700">
                    <span className="text-gray-400">Macros:</span>
                    <span className="ml-2">
                      <span className="text-green-400">{Math.round(lastItem.calories)} kcal</span>
                      {' | '}
                      <span className="text-blue-400">{Math.round(lastItem.proteinG)}g P</span>
                      {' | '}
                      <span className="text-yellow-400">{Math.round(lastItem.carbsG)}g C</span>
                      {' | '}
                      <span className="text-red-400">{Math.round(lastItem.fatG)}g F</span>
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Invariant Check:</span>
                    <span className={Math.abs(lastItem.computedTotalGrams - (lastItem.quantidade * lastItem.servingGrams)) < 0.01 ? 'text-green-400' : 'text-red-400'}>
                      {Math.abs(lastItem.computedTotalGrams - (lastItem.quantidade * lastItem.servingGrams)) < 0.01 ? '✓ PASS' : '✗ FAIL'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">FDC ID:</span>
                    <span className="text-gray-500">{lastItem.fdcId || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Updated:</span>
                    <span className="text-gray-500">
                      {lastItem.updatedAt ? new Date(lastItem.updatedAt).toLocaleTimeString() : 'N/A'}
                    </span>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
      
      {/* Add Food Modal */}
      {showAddFood && (
        <div className="card mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Add Food Item</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Food Name</label>
              <input
                type="text"
                value={newFood.name}
                onChange={(e) => setNewFood({ ...newFood, name: e.target.value })}
                className="input"
                placeholder="e.g., Chicken Breast"
              />
            </div>
            
            <div>
              <label className="label">Serving Size</label>
              <input
                type="text"
                value={newFood.servingSize}
                onChange={(e) => setNewFood({ ...newFood, servingSize: e.target.value })}
                className="input"
                placeholder="e.g., 100g"
              />
            </div>
            
            <div>
              <label className="label">Quantity</label>
              <input
                type="number"
                value={newFood.quantidade}
                onChange={(e) => setNewFood({ ...newFood, quantidade: parseFloat(e.target.value) || 1 })}
                className="input"
                min="0.1"
                step="0.1"
              />
            </div>
            
            <div>
              <label className="label">Calories</label>
              <input
                type="number"
                value={newFood.calories}
                onChange={(e) => setNewFood({ ...newFood, calories: parseFloat(e.target.value) || 0 })}
                className="input"
                min="0"
              />
            </div>
            
            <div>
              <label className="label">Protein (g)</label>
              <input
                type="number"
                value={newFood.proteinG}
                onChange={(e) => setNewFood({ ...newFood, proteinG: parseFloat(e.target.value) || 0 })}
                className="input"
                min="0"
                step="0.1"
              />
            </div>
            
            <div>
              <label className="label">Carbs (g)</label>
              <input
                type="number"
                value={newFood.carbsG}
                onChange={(e) => setNewFood({ ...newFood, carbsG: parseFloat(e.target.value) || 0 })}
                className="input"
                min="0"
                step="0.1"
              />
            </div>
            
            <div>
              <label className="label">Fat (g)</label>
              <input
                type="number"
                value={newFood.fatG}
                onChange={(e) => setNewFood({ ...newFood, fatG: parseFloat(e.target.value) || 0 })}
                className="input"
                min="0"
                step="0.1"
              />
            </div>
            
            <div>
              <label className="label">Fiber (g)</label>
              <input
                type="number"
                value={newFood.fiberG || ''}
                onChange={(e) => setNewFood({ ...newFood, fiberG: parseFloat(e.target.value) || undefined })}
                className="input"
                min="0"
                step="0.1"
              />
            </div>
          </div>
          
          <div className="flex justify-end space-x-2 mt-6">
            <button
              onClick={() => setShowAddFood(false)}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={saveFood}
              disabled={!newFood.name || newFood.calories <= 0}
              className="btn btn-primary"
            >
              Save Food
            </button>
          </div>
        </div>
      )}
      
      {/* Food Items - Always render so testid can be found even when no log exists yet */}
      <div className="card">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Food Items ({currentLog?.items.length || 0})
        </h3>
        
        {!currentLog || currentLog.items.length === 0 ? (
          <div className="text-center py-8" data-testid="nutrition-log-list">
            <p className="text-gray-600">No food items logged for this date</p>
          </div>
        ) : (
          <div className="space-y-3" data-testid="nutrition-log-list">
            {currentLog.items.map((item) => (
              <div key={item.id} data-testid="nutrition-food-item" className="p-3 bg-gray-50 rounded-lg">
                {showServingSizeEdit === item.id ? (
                  // Edit mode
                  <div className="space-y-3">
                    <div className="font-medium text-gray-900">Edit: {item.name}</div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="label text-xs">Quantity</label>
                        <input
                          type="number"
                          value={editingServingSize.quantity}
                          onChange={(e) => setEditingServingSize({ ...editingServingSize, quantity: parseFloat(e.target.value) || 1 })}
                          className="input text-sm"
                          min="0.1"
                          step="0.1"
                          aria-label="quantity"
                        />
                      </div>
                      
                      <div>
                        <label className="label text-xs">Unit</label>
                        <select
                          value={editingServingSize.unit}
                          onChange={(e) => {
                            const newUnit = e.target.value as 'serving' | 'grams' | 'g';
                            const isGrams = newUnit === 'grams' || newUnit === 'g';
                            
                            if (editingServingSize.originalItem) {
                              const originalItem = editingServingSize.originalItem;
                              const currentTotalGrams = originalItem.computedTotalGrams || 
                                                         (originalItem.quantidade * originalItem.servingGrams);
                              
                              // When switching to grams, set quantity to the total grams
                              // When switching to serving, calculate the serving equivalent
                              const newQuantity = isGrams ? currentTotalGrams : 
                                                   Math.round(currentTotalGrams / (originalItem.servingGrams || 100) * 100) / 100;
                              
                              setEditingServingSize({ 
                                ...editingServingSize, 
                                unit: newUnit as 'serving' | 'grams',
                                quantity: newQuantity
                              });
                            } else {
                              setEditingServingSize({ 
                                ...editingServingSize, 
                                unit: newUnit as 'serving' | 'grams'
                              });
                            }
                          }}
                          className="input text-sm"
                          aria-label="unit"
                        >
                          <option value="serving">serving</option>
                          <option value="grams">grams</option>
                        </select>
                      </div>
                    </div>
                    
                    <div className="text-sm text-gray-600" data-testid="total-grams-display">
                      <span className="font-medium">Total:</span>
                      <span className="ml-2">
                        {editingServingSize.originalItem && (
                          <>
                            {Math.round(calculateTotalGrams(editingServingSize.originalItem))} g
                          </>
                        )}
                      </span>
                    </div>
                    
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">Preview Macros:</span>
                      {editingServingSize.originalItem && (
                        <span className="ml-2">
                          {(() => {
                            const result = computeServingsChange({
                              originalItem: editingServingSize.originalItem,
                              editedQuantity: editingServingSize.quantity,
                              editedUnit: editingServingSize.unit === 'grams' || editingServingSize.unit === 'g' ? 'grams' : 'serving'
                            });
                            return `• ${result.newCalories.toFixed(0)} cal • ${result.newProteinG.toFixed(1)}g protein • ${result.newCarbsG.toFixed(1)}g carbs • ${result.newFatG.toFixed(1)}g fat`;
                          })()}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setShowServingSizeEdit(null)}
                        className="btn btn-secondary btn-sm"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => updateFoodServingSize(item.id)}
                        className="btn btn-primary btn-sm"
                      >
                        Update
                      </button>
                    </div>
                  </div>
                ) : (
                  // Display mode
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium" data-testid="nutrition-log-item-name">{item.name}</div>
                      <div className="text-sm text-gray-600" data-testid="serving-size">
                        {formatServingSize(item)}
                      </div>
                      <div className="text-sm text-gray-600" data-testid="nutrition-log-item-macros">
                        <span data-testid="food-calories">{Math.round(item.calories)}</span> cal • 
                        <span data-testid="food-protein">{Math.round(item.proteinG)}</span>g protein • 
                        <span data-testid="food-carbs">{Math.round(item.carbsG)}</span>g carbs • 
                        <span data-testid="food-fat">{Math.round(item.fatG)}</span>g fat
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => startEditServingSize(item)}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                        aria-label="edit serving"
                      >
                        Edit Serving
                      </button>
                      <button
                        onClick={() => deleteFood(item.id)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            </div>
          )}
      </div>
      
      {!currentLog && (
        <div className="card text-center py-12">
          <h3 className="text-lg font-medium text-gray-900 mb-2">No food logged for this date</h3>
          <p className="text-gray-600 mb-4">Start tracking your nutrition by adding your first meal</p>
          <button
            onClick={() => setShowAddFood(true)}
            className="btn btn-primary"
          >
            Add First Meal
          </button>
        </div>
      )}
    </div>
  );
}