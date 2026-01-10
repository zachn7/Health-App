import { useState, useEffect } from 'react';
import { repositories } from '../db';
import { Plus, Edit3, Trash2, Calendar, Utensils, Loader2, ChevronRight, Save, X, Sparkles, Calculator } from 'lucide-react';
import { getTodayLocalDateKey, formatLocalDate } from '../lib/date-utils';
import type { MealTemplate, FoodLogItem, MealPlan } from '../types';
import { extractMacrosFromSearchResult } from '../lib/usda-service';
import { computeServingsChange, formatServingSize, roundToIntGrams, roundToTenthServings, gramsToServings } from '../lib/serving-utils';

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
  const [saveStatus, setSaveStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [showDatePicker, setShowDatePicker] = useState<string | null>(null);
  const [showFoodPicker, setShowFoodPicker] = useState(false);
  const [foodSearchQuery, setFoodSearchQuery] = useState('');
  const [foodSearchResults, setFoodSearchResults] = useState<any[]>([]);
  const [foodSearchLoading, setFoodSearchLoading] = useState(false);
  const [deleteConfirmMeal, setDeleteConfirmMeal] = useState<MealTemplate | null>(null);
  const [deleteConfirmItemIndex, setDeleteConfirmItemIndex] = useState<number | null>(null);
  const [showManualFoodForm, setShowManualFoodForm] = useState(false);
  const [manualFood, setManualFood] = useState({
    name: '',
    calories: '',
    proteinG: '',
    carbsG: '',
    fatG: '',
    fiberG: '',
    sugarG: '',
    sodiumMg: '',
    servingSize: '',
    grams: ''
  });
  const [editingMealItemIndex, setEditingMealItemIndex] = useState<number | null>(null);
  const [editingItemOriginalServingGrams, setEditingItemOriginalServingGrams] = useState<Record<number, number>>({});
  const [editingItemDraftValue, setEditingItemDraftValue] = useState<Record<number, string>>({});

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

  const updateMealItemQuantity = (index: number, newQuantity: number, newUnit: 'serving' | 'grams') => {
    const newItems = [...mealItems];
    const item = newItems[index];
    
    // Apply rounding based on unit
    const roundedQuantity = newUnit === 'grams' 
      ? roundToIntGrams(newQuantity)  // Grams are whole numbers
      : roundToTenthServings(newQuantity);  // Servings have 0.1 precision
    
    // Create a temporary item with an ID for computeServingsChange
    const tempItem: FoodLogItem = {
      ...item,
      id: 'temp-edit-id'
    };
    
    // Use the shared computeServingsChange function
    const result = computeServingsChange({
      originalItem: tempItem,
      editedQuantity: roundedQuantity,
      editedUnit: newUnit
    });
    
    // Apply the computed values
    item.quantidade = result.newQuantity;
    item.servingGrams = result.newServingGrams;
    item.baseUnit = result.newBaseUnit;
    item.servingSize = result.newDisplayServingSize;
    item.computedTotalGrams = result.newTotalGrams;
    item.calories = result.newCalories;
    item.proteinG = result.newProteinG;
    item.carbsG = result.newCarbsG;
    item.fatG = result.newFatG;
    item.fiberG = result.newFiberG;
    item.sugarG = result.newSugarG;
    item.sodiumMg = result.newSodiumMg;
    
    setMealItems(newItems);
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
    // Clear previous status
    setSaveStatus(null);

    // Validate meal name
    if (!mealName.trim()) {
      setSaveStatus({ success: false, message: 'Please enter a meal name' });
      return;
    }

    // Validate meal has at least one food item
    if (mealItems.length === 0) {
      setSaveStatus({ success: false, message: 'Please add at least one food item to the meal' });
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
      setSaveStatus({ success: true, message: 'Meal saved successfully!' });
    } catch (error) {
      console.error('Failed to save meal:', error);
      setSaveStatus({ success: false, message: 'Failed to save meal. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const deleteMeal = async (meal: MealTemplate) => {
    try {
      await repositories.nutrition.deleteMealTemplate(meal.id);
      await loadMeals();
      setDeleteConfirmMeal(null);
      setSaveStatus({ success: true, message: 'Meal deleted successfully!' });
    } catch (error) {
      console.error('Failed to delete meal:', error);
      setSaveStatus({ success: false, message: 'Failed to delete meal. Please try again.' });
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

  const addFoodToMeal = async (food: any) => {
    try {
      // Use the same logic as Nutrition Logger: createFoodLogItem with default 1 serving
      const { usdaService } = await import('../lib/usda-service');
      const foodLogItem = await usdaService.createFoodLogItem(food.fdcId, 1, 'serving');
      
      // Remove the ID so we don't duplicate when saving
      const { id, ...foodItemWithoutId } = foodLogItem;
      
      setMealItems([...mealItems, foodItemWithoutId]);
      setShowFoodPicker(false);
      setFoodSearchQuery('');
      setFoodSearchResults([]);
    } catch (error) {
      console.error('Failed to add food to meal:', error);
      alert('This food does not have nutrition data available. Cannot add to meal.');
    }
  };

  const addManualFoodToMeal = () => {
    if (!manualFood.name.trim()) {
      alert('Please enter a food name');
      return;
    }

    const calories = parseFloat(manualFood.calories) || 0;
    const proteinG = parseFloat(manualFood.proteinG) || 0;
    const carbsG = parseFloat(manualFood.carbsG) || 0;
    const fatG = parseFloat(manualFood.fatG) || 0;
    const fiberG = manualFood.fiberG ? parseFloat(manualFood.fiberG) : undefined;
    const sugarG = manualFood.sugarG ? parseFloat(manualFood.sugarG) : undefined;
    const sodiumMg = manualFood.sodiumMg ? parseFloat(manualFood.sodiumMg) : undefined;
    const servingSize = manualFood.servingSize.trim() || '1 serving';
    const grams = parseFloat(manualFood.grams) || 0;

    if (calories === 0 && proteinG === 0 && carbsG === 0 && fatG === 0) {
      alert('Please enter at least one macro value (calories, protein, carbs, or fat)');
      return;
    }

    const newFoodItem: Omit<FoodLogItem, 'id'> = {
      name: manualFood.name.trim(),
      servingSize,
      quantidade: 1,
      calories,
      proteinG,
      carbsG,
      fatG,
      fiberG,
      sugarG,
      sodiumMg,
      baseUnit: grams > 0 ? 'grams' : 'serving',
      servingGrams: grams || 100,
      computedTotalGrams: grams || 100
    };

    setMealItems([...mealItems, newFoodItem]);
    setShowManualFoodForm(false);
    setManualFood({
      name: '',
      calories: '',
      proteinG: '',
      carbsG: '',
      fatG: '',
      fiberG: '',
      sugarG: '',
      sodiumMg: '',
      servingSize: '',
      grams: ''
    });
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
              data-testid="create-new-meal-btn"
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

      {/* Save Status Message (outside editor) */}
      {saveStatus && !showMealEditor && (
        <div className={`mb-4 p-4 rounded-lg ${
          saveStatus.success ? 'bg-green-50 text-green-900 border border-green-200' : 'bg-red-50 text-red-900 border border-red-200'
        }`} data-testid="meal-editor-save-status">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="font-medium">{saveStatus.success ? '✓' : '✗'} {saveStatus.message}</p>
            </div>
            <button
              onClick={() => setSaveStatus(null)}
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
              <div key={meal.id} className="card" data-testid={`meal-card-${meal.id}`}>
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
                  onChange={(e) => {
                    setMealName(e.target.value);
                    setSaveStatus(null); // Clear status when user edits
                  }}
                  className="input"
                  placeholder="e.g., Post-Workout Shake"
                  data-testid="meal-editor-name-input"
                />
              </div>
              
              {/* Save Status Messages */}
              {saveStatus && (
                <div className={`p-3 rounded-lg ${
                  saveStatus.success ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
                }`}>
                  <p className="text-sm font-medium">{saveStatus.message}</p>
                </div>
              )}
            </div>

            {/* Food Items */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Meal Totals */}
              {mealItems.length > 0 && (
                <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2 mb-3">
                    <Calculator className="w-5 h-5 text-blue-600" />
                    <h3 className="font-semibold text-gray-900">Meal Totals</h3>
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{Math.round(calculateMealTotals(mealItems).calories)}</div>
                      <div className="text-xs text-gray-600 mt-1">Calories</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">{Math.round(calculateMealTotals(mealItems).proteinG)}g</div>
                      <div className="text-xs text-gray-600 mt-1">Protein</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">{Math.round(calculateMealTotals(mealItems).carbsG)}g</div>
                      <div className="text-xs text-gray-600 mt-1">Carbs</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-yellow-600">{Math.round(calculateMealTotals(mealItems).fatG)}g</div>
                      <div className="text-xs text-gray-600 mt-1">Fat</div>
                    </div>
                  </div>
                </div>
              )}

              {mealItems.length === 0 ? (
                <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
                  <Utensils className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No food items added yet</p>
                  <p className="text-sm mt-1">Click "Add Food" to start building your meal</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {mealItems.map((item, index) => (
                    <div 
                      key={index} 
                      data-testid={`meal-item-row-${index}`}
                      className={`p-4 border rounded-lg ${editingMealItemIndex === index ? 'border-blue-400 bg-blue-50' : 'border-gray-200'}`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900">{item.name}</h4>
                          <p className="text-sm text-gray-600">
                            {formatServingSize(item)} • {Math.round(item.calories)} cal
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              const newIndex = editingMealItemIndex === index ? null : index;
                              setEditingMealItemIndex(newIndex);
                              // Store original servingGrams when opening editor
                              if (newIndex !== null) {
                                setEditingItemOriginalServingGrams({
                                  ...editingItemOriginalServingGrams,
                                  [index]: mealItems[index].servingGrams
                                });
                                // Initialize draft value with the current quantity
                                setEditingItemDraftValue({
                                  ...editingItemDraftValue,
                                  [index]: mealItems[index].quantidade.toString()
                                });
                              }
                            }}
                            className={`text-blue-500 hover:text-blue-700 ${editingMealItemIndex === index ? 'ring-2 ring-blue-400' : ''}`}
                            title="Edit quantity"
                            data-testid={`meal-item-edit-btn-${index}`}
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmItemIndex(index)}
                            className="text-red-500 hover:text-red-700"
                            title="Remove food"
                            data-testid={`meal-item-delete-btn-${index}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Quantity Editor */}
                      {editingMealItemIndex === index && (
                        <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <div className="flex gap-3">
                            {/* Quantity Type Toggle */}
                            <div className="flex-1">
                              <label className="block text-xs font-medium text-gray-700 mb-1">Amount Type</label>
                              <div className="flex rounded-md shadow-sm" role="group">
                                <button
                                  type="button"
                                  onClick={() => {
                                    // Convert current value to servings when switching modes
                                    const currentGrams = item.computedTotalGrams || (item.quantidade * item.servingGrams);
                                    // Use the original servingGrams, not the current one (which might be 1 from grams mode)
                                    const originalServingGrams = editingItemOriginalServingGrams[index] || item.servingGrams || 100;
                                    const newQuantity = gramsToServings(currentGrams, originalServingGrams);
                                    // Also update the item's servingGrams to the original value
                                    const newItems = [...mealItems];
                                    newItems[index].servingGrams = originalServingGrams;
                                    setMealItems(newItems);
                                    updateMealItemQuantity(index, newQuantity, 'serving');
                                  }}
                                  className={`px-3 py-2 text-sm font-medium rounded-l-lg border ${
                                    item.baseUnit === 'serving' 
                                      ? 'bg-blue-600 text-white border-blue-600' 
                                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                  }`}
                                  data-testid={`meal-item-qty-type-toggle-${index}`}
                                >
                                  Servings
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    // Convert current value to grams when switching modes
                                    const currentGrams = item.computedTotalGrams || (item.quantidade * item.servingGrams);
                                    const newQuantity = roundToIntGrams(currentGrams);
                                    updateMealItemQuantity(index, newQuantity, 'grams');
                                  }}
                                  className={`px-3 py-2 text-sm font-medium rounded-r-lg border ${
                                    item.baseUnit === 'grams' 
                                      ? 'bg-blue-600 text-white border-blue-600' 
                                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                  }`}
                                >
                                  Grams
                                </button>
                              </div>
                            </div>

                            {/* Quantity Input */}
                            <div className="w-32">
                              <label className="block text-xs font-medium text-gray-700 mb-1">Quantity</label>
                              <input
                                type="number"
                                step={item.baseUnit === 'grams' ? '1' : '0.1'}
                                min="0"
                                value={editingItemDraftValue[index] !== undefined ? editingItemDraftValue[index] : item.quantidade.toString()}
                                onChange={(e) => {
                                  // Allow empty string and any partial input while typing
                                  setEditingItemDraftValue({
                                    ...editingItemDraftValue,
                                    [index]: e.target.value
                                  });
                                }}
                                onKeyDown={(e) => {
                                  // Handle arrow keys to increment/decrement even from blank
                                  // Read from current input value directly (React state might not be updated yet)
                                  const inputValue = (e.target as HTMLInputElement).value;
                                  let currentNumericValue = inputValue !== '' ? parseFloat(inputValue) : 0;
                                  
                                  if (isNaN(currentNumericValue)) {
                                    currentNumericValue = 0;
                                  }
                                  
                                  const step = item.baseUnit === 'grams' ? 1 : 0.1;
                                  
                                  if (e.key === 'ArrowUp') {
                                    e.preventDefault();
                                    const newValue = Math.max(0, currentNumericValue + step);
                                    const roundedValue = item.baseUnit === 'grams' 
                                      ? roundToIntGrams(newValue) 
                                      : roundToTenthServings(newValue);
                                    const newValueStr = roundedValue.toString();
                                    setEditingItemDraftValue({
                                      ...editingItemDraftValue,
                                      [index]: newValueStr
                                    });
                                  } else if (e.key === 'ArrowDown') {
                                    e.preventDefault();
                                    const newValue = Math.max(0, currentNumericValue - step);
                                    const roundedValue = item.baseUnit === 'grams' 
                                      ? roundToIntGrams(newValue) 
                                      : roundToTenthServings(newValue);
                                    const newValueStr = roundedValue.toString();
                                    setEditingItemDraftValue({
                                      ...editingItemDraftValue,
                                      [index]: newValueStr
                                    });
                                  }
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                                data-testid={`meal-item-qty-input-${index}`}
                              />
                            </div>

                            {/* Serving Info */}
                            <div className="flex-1">
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                {item.baseUnit === 'grams' ? 'Total Grams' : 'Serving Size'}
                              </label>
                              <div className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700">
                                {item.baseUnit === 'grams'
                                  ? `${Math.round(item.computedTotalGrams)} g`
                                  : item.servingSize
                                }
                              </div>
                            </div>
                          </div>

                          {/* Live Macro Preview Tiles */}
                          {(() => {
                            // Use draft value if exists (user typing), otherwise use committed value
                            const currentQuantity = editingItemDraftValue[index] !== undefined ? editingItemDraftValue[index] : item.quantidade.toString();
                            const numericQuantity = parseFloat(currentQuantity) || 0;
                            
                            // Create a temporary item for computation
                            const tempItem: FoodLogItem = {
                              ...item,
                              id: 'temp-preview-id'
                            };
                            
                            const result = computeServingsChange({
                              originalItem: tempItem,
                              editedQuantity: numericQuantity,
                              editedUnit: item.baseUnit
                            });
                            
                            return (
                              <>
                                {/* Portion Grams Display (updates with draft) */}
                                {item.baseUnit === 'serving' && (
                                  <div className="mt-2 text-xs text-gray-600">
                                    1 serving = {Math.round(item.servingGrams)} g (total: {Math.round(result.newTotalGrams)} g)
                                  </div>
                                )}
                                
                                {/* Macro Tiles with live preview */}
                                <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
                                  <div className="text-center p-2 bg-blue-50 rounded" data-testid={`meal-item-macro-cal-${index}`}>
                                    <div className="text-xs text-blue-600 mb-0.5" title="Calories">Cal</div>
                                    <div className="font-bold text-blue-800">{Math.round(result.newCalories)}</div>
                                  </div>
                                  <div className="text-center p-2 bg-purple-50 rounded" data-testid={`meal-item-macro-protein-${index}`}>
                                    <div className="text-xs text-purple-600 mb-0.5" title="Protein">P</div>
                                    <div className="font-bold text-purple-800">{Math.round(result.newProteinG)}g</div>
                                  </div>
                                  <div className="text-center p-2 bg-orange-50 rounded" data-testid={`meal-item-macro-carbs-${index}`}>
                                    <div className="text-xs text-orange-600 mb-0.5" title="Carbs">C</div>
                                    <div className="font-bold text-orange-800">{Math.round(result.newCarbsG)}g</div>
                                  </div>
                                  <div className="text-center p-2 bg-yellow-50 rounded" data-testid={`meal-item-macro-fat-${index}`}>
                                    <div className="text-xs text-yellow-600 mb-0.5" title="Fat">F</div>
                                    <div className="font-bold text-yellow-800">{Math.round(result.newFatG)}g</div>
                                  </div>
                                </div>
                                
                                {/* Action Buttons */}
                                <div className="flex space-x-2 mt-3">
                                  <button
                                    onClick={() => {
                                      // Clear draft without committing
                                      const newDraft = { ...editingItemDraftValue };
                                      delete newDraft[index];
                                      setEditingItemDraftValue(newDraft);
                                      setEditingMealItemIndex(null);
                                    }}
                                    className="btn btn-secondary btn-sm flex-1"
                                    data-testid={`meal-item-cancel-${index}`}
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={() => {
                                      // Commit the draft value
                                      const draftValue = editingItemDraftValue[index];
                                      const numericValue = draftValue !== '' && draftValue !== undefined ? parseFloat(draftValue) : 0;
                                      const finalValue = isNaN(numericValue) || numericValue < 0 ? 0 : numericValue;
                                      
                                      // Clear draft
                                      const newDraft = { ...editingItemDraftValue };
                                      delete newDraft[index];
                                      setEditingItemDraftValue(newDraft);
                                      
                                      // Update the meal item
                                      updateMealItemQuantity(index, finalValue, item.baseUnit);
                                      setEditingMealItemIndex(null);
                                    }}
                                    className="btn btn-primary btn-sm flex-1"
                                    data-testid={`meal-item-update-${index}`}
                                  >
                                    Update
                                  </button>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      )}


                    </div>
                  ))}
                </div>
              )}

              {/* Add Food Buttons */}
              <div className="mt-4 space-y-2">
                <button
                  data-testid="meal-editor-search-usda-btn"
                  onClick={() => {
                    setShowFoodPicker(true);
                    setFoodSearchQuery('');
                    setFoodSearchResults([]);
                  }}
                  className="w-full btn btn-secondary"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Search USDA Foods
                </button>
                <button
                  data-testid="meal-editor-add-manual-food-btn"
                  onClick={() => {
                    setShowManualFoodForm(true);
                    setManualFood({
                      name: '',
                      calories: '',
                      proteinG: '',
                      carbsG: '',
                      fatG: '',
                      fiberG: '',
                      sugarG: '',
                      sodiumMg: '',
                      servingSize: '',
                      grams: ''
                    });
                  }}
                  className="w-full btn btn-outline"
                >
                  <Calculator className="w-5 h-5 mr-2" />
                  Add Manual Food
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-200">
              <div className="flex justify-between items-center">
                <div className="text-sm text-gray-600">
                  {mealItems.length} food item{mealItems.length !== 1 ? 's' : ''}
                </div>
                <div className="flex space-x-3">
                  <button
                    data-testid="meal-editor-cancel-btn"
                    onClick={() => setShowMealEditor(false)}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    data-testid="meal-editor-save-btn"
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
                  {foodSearchResults.slice(0, 10).map((result, index) => {
                    const macros = extractMacrosFromSearchResult(result);
                    
                    // Check if we have any nutrition data at all
                    const hasAnyNutrition = macros && (macros.calories !== undefined || macros.proteinG !== undefined || macros.carbsG !== undefined || macros.fatG !== undefined);
                    
                    // Check if all required fields are present
                    const isComplete = macros && macros.calories !== undefined && macros.proteinG !== undefined && macros.carbsG !== undefined && macros.fatG !== undefined;
                    
                    return (
                      <button
                        key={index}
                        onClick={() => addFoodToMeal(result)}
                        className="w-full text-left p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={!isComplete}
                        title={!isComplete ? 'Incomplete nutrition data - cannot add' : ''}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{result.description}</p>
                            <p className="text-xs text-gray-600 mt-1">
                              {result.brandOwner ? `Brand: ${result.brandOwner}` : 'Generic'}
                            </p>
                            {hasAnyNutrition && (
                              <div className="mt-2 flex flex-wrap gap-3 text-xs font-medium">
                                <span className={macros.calories !== undefined && macros.calories > 0 ? 'text-gray-900' : 'text-gray-400'}>
                                  {macros.calories !== undefined ? `${macros.calories} cal` : 'N/A cal'}
                                </span>
                                <span className={macros.proteinG !== undefined && macros.proteinG > 0 ? 'text-blue-600' : 'text-gray-400'}>
                                  {macros.proteinG !== undefined ? `${macros.proteinG.toFixed(1)}g protein` : 'N/A protein'}
                                </span>
                                <span className={macros.carbsG !== undefined && macros.carbsG > 0 ? 'text-yellow-600' : 'text-gray-400'}>
                                  {macros.carbsG !== undefined ? `${macros.carbsG.toFixed(1)}g carbs` : 'N/A carbs'}
                                </span>
                                <span className={macros.fatG !== undefined && macros.fatG > 0 ? 'text-red-600' : 'text-gray-400'}>
                                  {macros.fatG !== undefined ? `${macros.fatG.toFixed(1)}g fat` : 'N/A fat'}
                                </span>
                                {!isComplete && (
                                  <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                                    ⚠️ Incomplete data
                                  </span>
                                )}
                                {macros.basis === 'per_100g' && (
                                  <span className="text-gray-500 font">
                                    1 serving (100g)
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-400 mt-4" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Manual Food Form Modal */}
      {showManualFoodForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-medium text-gray-900">Add Manual Food</h2>
                <button
                  onClick={() => {
                    setShowManualFoodForm(false);
                    setManualFood({
                      name: '',
                      calories: '',
                      proteinG: '',
                      carbsG: '',
                      fatG: '',
                      fiberG: '',
                      sugarG: '',
                      sodiumMg: '',
                      servingSize: '',
                      grams: ''
                    });
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Form */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Food Name *
                  </label>
                  <input
                    type="text"
                    value={manualFood.name}
                    onChange={(e) => setManualFood({ ...manualFood, name: e.target.value })}
                    className="input"
                    placeholder="e.g., Homemade Salad"
                    autoFocus
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Calories *
                    </label>
                    <input
                      type="number"
                      value={manualFood.calories}
                      onChange={(e) => setManualFood({ ...manualFood, calories: e.target.value })}
                      className="input"
                      placeholder="200"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Protein (g) *
                    </label>
                    <input
                      type="number"
                      value={manualFood.proteinG}
                      onChange={(e) => setManualFood({ ...manualFood, proteinG: e.target.value })}
                      className="input"
                      placeholder="20"
                      min="0"
                      step="0.1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Carbs (g) *
                    </label>
                    <input
                      type="number"
                      value={manualFood.carbsG}
                      onChange={(e) => setManualFood({ ...manualFood, carbsG: e.target.value })}
                      className="input"
                      placeholder="25"
                      min="0"
                      step="0.1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Fat (g) *
                    </label>
                    <input
                      type="number"
                      value={manualFood.fatG}
                      onChange={(e) => setManualFood({ ...manualFood, fatG: e.target.value })}
                      className="input"
                      placeholder="8"
                      min="0"
                      step="0.1"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Fiber (g)
                    </label>
                    <input
                      type="number"
                      value={manualFood.fiberG}
                      onChange={(e) => setManualFood({ ...manualFood, fiberG: e.target.value })}
                      className="input"
                      placeholder="5"
                      min="0"
                      step="0.1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Sugar (g)
                    </label>
                    <input
                      type="number"
                      value={manualFood.sugarG}
                      onChange={(e) => setManualFood({ ...manualFood, sugarG: e.target.value })}
                      className="input"
                      placeholder="10"
                      min="0"
                      step="0.1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Sodium (mg)
                    </label>
                    <input
                      type="number"
                      value={manualFood.sodiumMg}
                      onChange={(e) => setManualFood({ ...manualFood, sodiumMg: e.target.value })}
                      className="input"
                      placeholder="300"
                      min="0"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Serving Size
                    </label>
                    <input
                      type="text"
                      value={manualFood.servingSize}
                      onChange={(e) => setManualFood({ ...manualFood, servingSize: e.target.value })}
                      className="input"
                      placeholder="1 bowl"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Grams (optional)
                    </label>
                    <input
                      type="number"
                      value={manualFood.grams}
                      onChange={(e) => setManualFood({ ...manualFood, grams: e.target.value })}
                      className="input"
                      placeholder="150"
                      min="0"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => {
                  setShowManualFoodForm(false);
                  setManualFood({
                    name: '',
                    calories: '',
                    proteinG: '',
                    carbsG: '',
                    fatG: '',
                    fiberG: '',
                    sugarG: '',
                    sodiumMg: '',
                    servingSize: '',
                    grams: ''
                  });
                }}
                className="flex-1 btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={addManualFoodToMeal}
                className="flex-1 btn btn-primary"
              >
                Add to Meal
              </button>
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
