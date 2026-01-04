import { useState, useEffect } from 'react';
import { repositories } from '../db';
import { Plus, Edit3, Trash2, Calendar, Utensils, Loader2, ChevronRight, Save, X, Sparkles } from 'lucide-react';
import { getTodayLocalDateKey, formatLocalDate } from '../lib/date-utils';
import type { MealTemplate, FoodLogItem, MealPlan } from '../types';

export default function Meals() {
  const [activeTab, setActiveTab] = useState<'meals' | 'mealPlans'>('meals');
  const [meals, setMeals] = useState<MealTemplate[]>([]);
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMealEditor, setShowMealEditor] = useState(false);
  const [editingMeal, setEditingMeal] = useState<MealTemplate | null>(null);
  const [mealName, setMealName] = useState('');
  const [mealItems, setMealItems] = useState<Omit<FoodLogItem, 'id'>[]>([]);
  const [saving, setSaving] = useState(false);
  const [importDate, setImportDate] = useState(getTodayLocalDateKey());
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [showDatePicker, setShowDatePicker] = useState<string | null>(null);
  const [showFoodPicker, setShowFoodPicker] = useState(false);
  const [foodSearchQuery, setFoodSearchQuery] = useState('');
  const [foodSearchResults, setFoodSearchResults] = useState<any[]>([]);
  const [foodSearchLoading, setFoodSearchLoading] = useState(false);
  const [deleteConfirmMeal, setDeleteConfirmMeal] = useState<MealTemplate | null>(null);
  const [deleteConfirmItemIndex, setDeleteConfirmItemIndex] = useState<number | null>(null);

  useEffect(() => {
    loadMeals();
    loadMealPlans();
  }, []);

  useEffect(() => {
    if (showFoodPicker) {
      loadSavedFoods();
    }
  }, [showFoodPicker]);

  const loadSavedFoods = async () => {
    try {
      const { usdaService } = await import('../lib/usda-service');
      await usdaService.getSavedFDAFoods();
    } catch (error) {
      console.error('Failed to load saved foods:', error);
    }
  };

  const loadMeals = async () => {
    try {
      const loadedMeals = await repositories.nutrition.getMealTemplates();
      setMeals(loadedMeals);
    } catch (error) {
      console.error('Failed to load meals:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMealPlans = async () => {
    try {
      const loadedPlans = await repositories.nutrition.getMealPlans();
      setMealPlans(loadedPlans);
    } catch (error) {
      console.error('Failed to load meal plans:', error);
    }
  };

  const calculateMealTotals = (items: Omit<FoodLogItem, 'id'>[]) => {
    return items.reduce(
      (totals, item) => ({
        calories: totals.calories + item.calories,
        proteinG: totals.proteinG + item.proteinG,
        carbsG: totals.carbsG + item.carbsG,
        fatG: totals.fatG + item.fatG
      }),
      { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }
    );
  };

  const startNewMeal = () => {
    setEditingMeal(null);
    setMealName('');
    setMealItems([]);
    setShowMealEditor(true);
  };

  const editMeal = (meal: MealTemplate) => {
    setEditingMeal(meal);
    setMealName(meal.name);
    setMealItems(meal.items);
    setShowMealEditor(true);
  };

  const saveMeal = async () => {
    if (!mealName.trim()) {
      alert('Please enter a meal name');
      return;
    }

    if (mealItems.length === 0) {
      alert('Please add at least one food item to the meal');
      return;
    }

    setSaving(true);
    try {
      const mealData: Omit<MealTemplate, 'id'> = {
        name: mealName.trim(),
        items: mealItems,
        createdAt: editingMeal?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      if (editingMeal) {
        await repositories.nutrition.updateMealTemplate(editingMeal.id, mealData);
      } else {
        await repositories.nutrition.createMealTemplate(mealData);
      }

      await loadMeals();
      setShowMealEditor(false);
      setEditingMeal(null);
    } catch (error) {
      console.error('Failed to save meal:', error);
      alert('Failed to save meal. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const deleteMeal = async (meal: MealTemplate) => {
    try {
      await repositories.nutrition.deleteMealTemplate(meal.id);
      await loadMeals();
      setDeleteConfirmMeal(null);
    } catch (error) {
      console.error('Failed to delete meal:', error);
      alert('Failed to delete meal. Please try again.');
    }
  };

  const searchFoods = async (query: string) => {
    if (!query.trim()) {
      setFoodSearchResults([]);
      return;
    }

    setFoodSearchLoading(true);
    try {
      const { usdaService } = await import('../lib/usda-service');
      const response = await usdaService.searchFoods(query, 10);
      setFoodSearchResults(response.results || []);
    } catch (error) {
      console.error('Failed to search foods:', error);
      setFoodSearchResults([]);
    } finally {
      setFoodSearchLoading(false);
    }
  };

  const addFoodToMeal = (food: any) => {
    const macros = extractMacrosFromSearchResult(food);
    const newFoodItem: Omit<FoodLogItem, 'id'> = {
      name: food.description,
      servingSize: '100 g',
      quantidade: 1,
      calories: macros.calories || 0,
      proteinG: macros.proteinG || 0,
      carbsG: macros.carbsG || 0,
      fatG: macros.fatG || 0,
      baseUnit: 'grams',
      servingGrams: 100,
      computedTotalGrams: 100,
      fdcId: food.fdcId
    };
    setMealItems([...mealItems, newFoodItem]);
    setShowFoodPicker(false);
    setFoodSearchQuery('');
    setFoodSearchResults([]);
  };

  const extractMacrosFromSearchResult = (result: any) => {
    const foodNutrients = result.foodNutrients || [];
    const getNutrient = (nutrientName: string) => {
      const nutrient = foodNutrients.find((n: any) => n.name === nutrientName);
      return nutrient ? nutrient.amount || 0 : 0;
    };

    return {
      energyKcal: getNutrient('Energy'),
      proteinG: getNutrient('Protein'),
      carbsG: getNutrient('Carbohydrate, by difference'),
      fatG: getNutrient('Total lipid (fat)'),
      fiberG: getNutrient('Fiber, total dietary'),
      calories: getNutrient('Energy')
    };
  };

  const removeMealItem = (index: number) => {
    const updatedItems = mealItems.filter((_, i) => i !== index);
    setMealItems(updatedItems);
    setDeleteConfirmItemIndex(null);
  };

  const importToNutrition = async (meal: MealTemplate) => {
    setImporting(true);
    setImportStatus(null);

    try {
      // Get or create nutrition log for the selected date
      let log = await repositories.nutrition.getNutritionLog(importDate);
      
      if (!log) {
        log = await repositories.nutrition.createNutritionLog({
          date: importDate,
          items: [],
          totals: { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }
        });
      }

      // Add all meal items to the log
      const newItems = meal.items.map(item => ({
        ...item,
        id: crypto.randomUUID()
      }));

      const updatedItems = [...log.items, ...newItems];

      // Recalculate totals
      const newTotals = updatedItems.reduce(
        (totals, item) => ({
          calories: totals.calories + item.calories,
          proteinG: totals.proteinG + item.proteinG,
          carbsG: totals.carbsG + item.carbsG,
          fatG: totals.fatG + item.fatG
        }),
        { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }
      );

      await repositories.nutrition.updateNutritionLog(log.id, {
        items: updatedItems,
        totals: newTotals,
        updatedAt: new Date().toISOString()
      });

      setImportStatus({
        success: true,
        message: `Successfully imported "${meal.name}" to ${formatLocalDate(importDate, { weekday: 'long', month: 'long', day: 'numeric' })}`
      });
    } catch (error) {
      console.error('Failed to import meal:', error);
      setImportStatus({
        success: false,
        message: 'Failed to import meal. Please try again.'
      });
    } finally {
      setImporting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Meals</h1>
            <p className="mt-2 text-gray-600">Save and reuse your favorite meals</p>
          </div>
          {activeTab === 'meals' && (
            <button
              onClick={startNewMeal}
              className="btn btn-primary"
            >
              <Plus className="w-5 h-5 mr-2" />
              Create New Meal
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('meals')}
              className={`pb-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'meals'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Utensils className="w-4 h-4 inline mr-1" />
              Saved Meals
            </button>
            <button
              onClick={() => setActiveTab('mealPlans')}
              className={`pb-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'mealPlans'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Sparkles className="w-4 h-4 inline mr-1" />
              Meal Plans
            </button>
          </nav>
        </div>
      </div>

      {/* Import Status Toast */}
      {importStatus && (
        <div className={`mb-6 p-4 rounded-lg border ${
          importStatus.success 
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <div className="flex items-start">
            <div className="flex-1">
              <p className="font-medium">{importStatus.success ? '✓' : '✗'} {importStatus.message}</p>
            </div>
            <button
              onClick={() => setImportStatus(null)}
              className="text-sm underline hover:opacity-75"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Meals Tab Content */}
      {activeTab === 'meals' && (
        <>
          {/* Meal List */}
          {meals.length === 0 ? (
        <div className="card text-center py-12">
          <Utensils className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Meals Saved Yet</h3>
          <p className="text-gray-600 mb-6">Create your first meal to quickly add your favorite food combinations.</p>
          <button
            onClick={startNewMeal}
            className="btn btn-primary"
          >
            Create Your First Meal
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {meals.map((meal) => {
            const totals = calculateMealTotals(meal.items);
            return (
              <div key={meal.id} className="card">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-medium text-gray-900">{meal.name}</h3>
                    <p className="text-sm text-gray-600">
                      {meal.items.length} food item{meal.items.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => editMeal(meal)}
                      className="btn btn-secondary text-sm"
                      title="Edit meal"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirmMeal(meal)}
                      className="btn btn-danger text-sm"
                      title="Delete meal"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Macros Totals */}
                <div className="grid grid-cols-4 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {Math.round(totals.calories)}
                    </div>
                    <div className="text-sm text-gray-600">Calories</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {Math.round(totals.proteinG)}g
                    </div>
                    <div className="text-sm text-gray-600">Protein</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {Math.round(totals.carbsG)}g
                    </div>
                    <div className="text-sm text-gray-600">Carbs</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-600">
                      {Math.round(totals.fatG)}g
                    </div>
                    <div className="text-sm text-gray-600">Fat</div>
                  </div>
                </div>

                {/* Import to Nutrition */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 relative">
                    <button
                      onClick={() => setShowDatePicker(showDatePicker === meal.id ? null : meal.id)}
                      className="w-full btn btn-secondary flex items-center justify-between"
                    >
                      <span className="flex items-center">
                        <Calendar className="w-4 h-4 mr-2" />
                        {formatLocalDate(importDate, { month: 'long', day: 'numeric' })}
                      </span>
                      <ChevronRight className="w-4 h-4" />
                    </button>{showDatePicker === meal.id && (
                      <input
                        type="date"
                        value={importDate}
                        onChange={(e) => setImportDate(e.target.value)}
                        className="input absolute top-full left-0 w-full mt-1 z-10"
                        autoFocus
                      />
                    )}
                  </div>
                  <button
                    onClick={() => importToNutrition(meal)}
                    disabled={importing}
                    className="btn btn-primary"
                  >
                    {importing && showDatePicker === meal.id ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4 mr-2" />
                    )}
                    Add to Log
                  </button>
                </div>
              </div>
            );
          })}
        </div>
          )}
        </>
      )}

      {/* Meal Plans Tab Content */}
      {activeTab === 'mealPlans' && (
        <div className="space-y-6">
          {/* Coming Soon / Placeholder */}
          <div className="card text-center py-16">
            <Sparkles className="w-20 h-20 mx-auto text-gray-300 mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Meal Plans</h2>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              Create and manage weekly meal plans with AI-powered generation or simple offline templates.
            </p>
          </div>

          {/* Existing Meal Plans */}
          {mealPlans.length > 0 && (
            <div className="mt-8">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Your Meal Plans</h3>
              <div className="space-y-4">
                {mealPlans.map((plan) => (
                  <div key={plan.id} className="card">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-lg font-medium text-gray-900">{plan.name}</h4>
                        <p className="text-sm text-gray-600">
                          {plan.days.length} days • {formatLocalDate(plan.startDate, { month: 'long', day: 'numeric' })} - {formatLocalDate(plan.endDate, { month: 'long', day: 'numeric' })}
                        </p>
                        <span className={`inline-block px-2 py-1 text-xs rounded-full mt-2 ${
                          plan.generationType === 'ai_webllm'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {plan.generationType === 'ai_webllm' ? 'AI Generated' : 'Offline Plan'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Meal Editor Modal */}
      {showMealEditor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-medium text-gray-900">
                  {editingMeal ? 'Edit Meal' : 'Create New Meal'}
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {editingMeal ? 'Modify your saved meal' : 'Add foods to create a reusable meal'}
                </p>
              </div>
              <button
                onClick={() => setShowMealEditor(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Meal Name */}
            <div className="p-6 border-b border-gray-200">
              <div className="mb-4">
                <label className="label">Meal Name *</label>
                <input
                  type="text"
                  value={mealName}
                  onChange={(e) => setMealName(e.target.value)}
                  className="input"
                  placeholder="e.g., Post-Workout Shake"
                />
              </div>
            </div>

            {/* Food Items */}
            <div className="flex-1 overflow-y-auto p-6">
              {mealItems.length === 0 ? (
                <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
                  <Utensils className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No food items added yet</p>
                  <p className="text-sm mt-1">Click "Add Food" to start building your meal</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {mealItems.map((item, index) => (
                    <div key={index} className="p-4 border border-gray-200 rounded-lg">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900">{item.name}</h4>
                          <p className="text-sm text-gray-600">
                            {item.servingSize} • {Math.round(item.calories)} cal
                          </p>
                        </div>
                        <button
                          onClick={() => setDeleteConfirmItemIndex(index)}
                          className="text-red-500 hover:text-red-700"
                          title="Remove food"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Macros for this item */}
                      <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
                        <div className="text-center p-2 bg-blue-50 rounded">
                          <div className="font-medium text-blue-800">{Math.round(item.calories)} cal</div>
                        </div>
                        <div className="text-center p-2 bg-purple-50 rounded">
                          <div className="font-medium text-purple-800">{Math.round(item.proteinG)}g</div>
                        </div>
                        <div className="text-center p-2 bg-orange-50 rounded">
                          <div className="font-medium text-orange-800">{Math.round(item.carbsG)}g</div>
                        </div>
                        <div className="text-center p-2 bg-yellow-50 rounded">
                          <div className="font-medium text-yellow-800">{Math.round(item.fatG)}g</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Food Button */}
              <button
                onClick={() => {
                  setShowFoodPicker(true);
                  setFoodSearchQuery('');
                  setFoodSearchResults([]);
                }}
                className="w-full mt-4 btn btn-secondary"
              >
                <Plus className="w-5 h-5 mr-2" />
                Add Food
              </button>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-200">
              <div className="flex justify-between items-center">
                <div className="text-sm text-gray-600">
                  {mealItems.length} food item{mealItems.length !== 1 ? 's' : ''}
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={() => setShowMealEditor(false)}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveMeal}
                    disabled={saving || !mealName.trim()}
                    className="btn btn-primary"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Save Meal
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Food Picker Modal */}
      {showFoodPicker && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-gray-200">
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-lg font-medium text-gray-900">Add Food</h2>
                <button
                  onClick={() => {
                    setShowFoodPicker(false);
                    setFoodSearchQuery('');
                    setFoodSearchResults([]);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              {/* Search */}
              <div className="relative">
                <input
                  type="text"
                  value={foodSearchQuery}
                  onChange={(e) => {
                    setFoodSearchQuery(e.target.value);
                    // Debounced search
                    const timeout = setTimeout(() => searchFoods(e.target.value), 300);
                    return () => clearTimeout(timeout);
                  }}
                  className="input"
                  placeholder="Search for food (e.g., 'chicken', 'banana')..."
                  autoFocus
                />
                {foodSearchLoading && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                  </div>
                )}
              </div>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto p-4">
              {foodSearchResults.length === 0 && !foodSearchLoading && foodSearchQuery.trim() ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No foods found for "{foodSearchQuery}"</p>
                  <p className="text-sm mt-1">Try a different search term</p>
                </div>
              ) : foodSearchResults.length === 0 && !foodSearchLoading ? (
                <div className="text-center py-8 text-gray-500">
                  <p>Search for food to add</p>
                  <p className="text-sm mt-1">Type a food name above</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {foodSearchResults.slice(0, 10).map((result, index) => (
                    <button
                      key={index}
                      onClick={() => addFoodToMeal(result)}
                      className="w-full text-left p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{result.description}</p>
                          <p className="text-xs text-gray-600 mt-1">
                            Brand: {result.brandOwner || 'Generic'}
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Meal Confirmation */}
      {deleteConfirmMeal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900">Delete Meal</h3>
                <p className="text-sm text-gray-600">This action cannot be undone.</p>
              </div>
            </div>

            <p className="mb-6 text-gray-700">
              Are you sure you want to delete <strong>"{deleteConfirmMeal.name}"</strong>?
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmMeal(null)}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMeal(deleteConfirmMeal)}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Item Confirmation */}
      {deleteConfirmItemIndex !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Remove Food Item</h3>
            <p className="mb-6 text-gray-700">
              Are you sure you want to remove "{mealItems[deleteConfirmItemIndex]?.name}" from this meal?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmItemIndex(null)}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={() => removeMealItem(deleteConfirmItemIndex)}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
