
import { useState, useEffect } from 'react';
import { repositories } from '../db';
import { calculateTDEE } from '../lib/coach-engine';
import { usdaService } from '../lib/usda-service';
import type { NutritionLog, FoodLogItem, MacroTotals, Profile, FoodItem } from '../types';

export default function Nutrition() {
  const [currentLog, setCurrentLog] = useState<NutritionLog | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
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
    fatG: 0
  });
  const [showAddFood, setShowAddFood] = useState(false);
  const [showUSDAImport, setShowUSDAImport] = useState(false);
  const [usdaSearchQuery, setUSDAQuery] = useState('');
  const [usdaSearchResults, setUSDAReplies] = useState<any[]>([]);
  const [isUSDAEnabled, setIsUSDAEnabled] = useState(false);
  const [usdaSearchLoading, setUSDASearching] = useState(false);
  const [usdaImporting, setUSDAImporting] = useState<string[]>([]);
  const [savedFoods, setSavedFoods] = useState<FoodItem[]>([]);

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
      const dateStr = selectedDate.toISOString().split('T')[0];
      const log = await repositories.nutrition.getNutritionLog(dateStr);
      setCurrentLog(log || null);
    } catch (error) {
      console.error('Failed to load nutrition data:', error);
    } finally {
      setLoading(false);
    }
  };

  const navigateDate = (direction: 'prev' | 'next' | 'today') => {
    if (direction === 'today') {
      setSelectedDate(new Date());
    } else {
      const newDate = new Date(selectedDate);
      if (direction === 'prev') {
        newDate.setDate(newDate.getDate() - 1);
      } else {
        newDate.setDate(newDate.getDate() + 1);
      }
      setSelectedDate(newDate);
    }
  };

  const getDailyTargets = () => {
    if (!profile) {
      return { calories: 2000, proteinG: 150, carbsG: 250, fatG: 65 };
    }
    
    const tdee = calculateTDEE(profile);
    // Use TDEE as calorie target (can be adjusted based on goals)
    return {
      calories: Math.round(tdee.tdee),
      proteinG: Math.round(profile.weightKg * 2.2), // ~2g per kg
      carbsG: Math.round(tdee.tdee * 0.5 / 4), // 50% of calories
      fatG: Math.round(tdee.tdee * 0.25 / 9) // 25% of calories
    };
  };

  const saveFood = async () => {
    try {
      const dateStr = selectedDate.toISOString().split('T')[0];
      
      if (!currentLog) {
        // Create new log for selected date
        const newLog: NutritionLog = {
          id: crypto.randomUUID(),
          date: dateStr,
          items: [newFood],
          totals: calculateTotals([newFood]),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await repositories.nutrition.createNutritionLog(newLog);
        setCurrentLog(newLog);
      } else {
        // Add to existing log
        const updatedItems = [...currentLog.items, newFood];
        const updatedLog = {
          ...currentLog,
          items: updatedItems,
          totals: calculateTotals(updatedItems),
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
        fatG: 0
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
    if (!currentLog) return;
    
    try {
      const updatedItems = currentLog.items.filter(item => item.id !== foodId);
      const updatedLog = {
        ...currentLog,
        items: updatedItems,
        totals: calculateTotals(updatedItems),
        updatedAt: new Date().toISOString()
      };
      
      if (updatedItems.length === 0) {
        // Delete the entire log if no items left
        await repositories.nutrition.deleteNutritionLog(currentLog.id);
        setCurrentLog(null);
      } else {
        await repositories.nutrition.updateNutritionLog(updatedLog.id, updatedLog);
        setCurrentLog(updatedLog);
      }
    } catch (error) {
      console.error('Failed to delete food:', error);
    }
  };

  const searchUSDAFoods = async () => {
    if (!usdaSearchQuery.trim()) return;
    
    setUSDASearching(true);
    try {
      const results = await usdaService.searchFoods(usdaSearchQuery);
      setUSDAReplies(results);
    } catch (error) {
      console.error('USDA search failed:', error);
      alert(`USDA search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setUSDASearching(false);
    }
  };

  const importUSDAFood = async (fdcId: number, description: string) => {
    setUSDAImporting([...usdaImporting, `fdc-${fdcId}`]);
    try {
      const foodItem = await usdaService.importFoodItem(fdcId);
      
      // Add to current nutrition log
      const foodLogItem: FoodLogItem = {
        id: crypto.randomUUID(),
        name: foodItem.name,
        servingSize: foodItem.servingSize,
        quantidade: 1,
        calories: foodItem.calories,
        proteinG: foodItem.proteinG,
        carbsG: foodItem.carbsG,
        fatG: foodItem.fatG,
        fiberG: foodItem.fiberG,
        sugarG: foodItem.sugarG,
        sodiumMg: foodItem.sodiumMg
      };
      
      await saveFoodItem(foodLogItem);
      
      // Remove from importing list
      setUSDAImporting(usdaImporting.filter(id => id !== `fdc-${fdcId}`));
      
      // Refresh saved foods
      await loadSavedFoods();
    } catch (error) {
      console.error('Failed to import USDA food:', error);
      alert(`Failed to import ${description}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setUSDAImporting(usdaImporting.filter(id => id !== `fdc-${fdcId}`));
    }
  };

  const saveFoodItem = async (foodItem: FoodLogItem) => {
    const dateStr = selectedDate.toISOString().split('T')[0];
    
    if (!currentLog) {
      // Create new log for selected date
      const newLog: NutritionLog = {
        id: crypto.randomUUID(),
        date: dateStr,
        items: [foodItem],
        totals: calculateTotals([foodItem]),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await repositories.nutrition.createNutritionLog(newLog);
      setCurrentLog(newLog);
    } else {
      // Add to existing log
      const updatedItems = [...currentLog.items, foodItem];
      const updatedLog = {
        ...currentLog,
        items: updatedItems,
        totals: calculateTotals(updatedItems),
        updatedAt: new Date().toISOString()
      };
      await repositories.nutrition.updateNutritionLog(updatedLog.id, updatedLog);
      setCurrentLog(updatedLog);
    }
  };

  const addSavedFood = async (food: FoodItem) => {
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
      sodiumMg: food.sodiumMg
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
                selectedDate.toDateString() === new Date().toDateString() 
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
          {selectedDate.toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </div>
        
        {/* Daily Totals with 0/target format */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {currentLog ? Math.round(currentLog.totals.calories) : 0}
              <span className="text-lg text-gray-500">/{getDailyTargets().calories}</span>
            </div>
            <div className="text-sm text-gray-600">Calories</div>
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
        <div className="card mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Search USDA FoodData Central
          </h3>
          
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={usdaSearchQuery}
              onChange={(e) => setUSDAQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && searchUSDAFoods()}
              className="input flex-1"
              placeholder="Search for foods (e.g., chicken breast, brown rice)"
            />
            <button
              onClick={searchUSDAFoods}
              disabled={usdaSearchLoading || !usdaSearchQuery.trim()}
              className="btn btn-primary"
            >
              {usdaSearchLoading ? 'Searching...' : 'Search'}
            </button>
          </div>
          
          {usdaSearchResults.length > 0 && (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              <h4 className="font-medium text-gray-700">Search Results:</h4>
              {usdaSearchResults.map((food) => (
                <div key={food.fdcId} className="p-3 border border-gray-200 rounded-lg">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="font-medium">{food.description}</div>
                      {food.brandOwner && (
                        <div className="text-sm text-gray-500">{food.brandOwner}</div>
                      )}
                      {food.foodCategory && (
                        <div className="text-sm text-gray-500">{food.foodCategory}</div>
                      )}
                    </div>
                    <button
                      onClick={() => importUSDAFood(food.fdcId, food.description)}
                      disabled={usdaImporting.includes(`fdc-${food.fdcId}`)}
                      className="btn btn-sm btn-primary"
                    >
                      {usdaImporting.includes(`fdc-${food.fdcId}`) ? 'Importing...' : 'Import'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {!usdaSearchLoading && usdaSearchQuery && usdaSearchResults.length === 0 && (
            <div className="text-center py-4 text-gray-500">
              No results found for "{usdaSearchQuery}"
            </div>
          )}
          
          <div className="flex justify-end mt-4">
            <button
              onClick={() => {
                setShowUSDAImport(false);
                setUSDAQuery('');
                setUSDAReplies([]);
              }}
              className="btn btn-secondary"
            >
              Close
            </button>
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
      
      {/* Food Items */}
      {currentLog && currentLog.items.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Food Items ({currentLog.items.length})
          </h3>
          
          <div className="space-y-3">
            {currentLog.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <div className="font-medium">{item.name}</div>
                  <div className="text-sm text-gray-600">
                    {item.quantidade} × {item.servingSize}
                  </div>
                  <div className="text-sm text-gray-600">
                    {Math.round(item.calories * item.quantidade)} cal • 
                    {Math.round(item.proteinG * item.quantidade)}g protein • 
                    {Math.round(item.carbsG * item.quantidade)}g carbs • 
                    {Math.round(item.fatG * item.quantidade)}g fat
                  </div>
                </div>
                <button
                  onClick={() => deleteFood(item.id)}
                  className="text-red-600 hover:text-red-800"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {currentLog && currentLog.items.length === 0 && (
        <div className="card text-center py-8">
          <p className="text-gray-600">No food items logged for this date</p>
        </div>
      )}
      
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