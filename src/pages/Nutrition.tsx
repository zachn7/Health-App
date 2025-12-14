
import { useState, useEffect } from 'react';
import { repositories } from '../db';
import type { NutritionLog, FoodLogItem, MacroTotals } from '../types';

export default function Nutrition() {
  const [todayLog, setTodayLog] = useState<NutritionLog | null>(null);
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

  useEffect(() => {
    loadTodayLog();
  }, []);

  const loadTodayLog = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const log = await repositories.nutrition.getNutritionLog(today);
      setTodayLog(log || null);
    } catch (error) {
      console.error('Failed to load nutrition log:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveFood = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      if (!todayLog) {
        // Create new log for today
        const newLog: NutritionLog = {
          id: crypto.randomUUID(),
          date: today,
          items: [newFood],
          totals: calculateTotals([newFood]),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await repositories.nutrition.createNutritionLog(newLog);
        setTodayLog(newLog);
      } else {
        // Add to existing log
        const updatedItems = [...todayLog.items, newFood];
        const updatedLog = {
          ...todayLog,
          items: updatedItems,
          totals: calculateTotals(updatedItems),
          updatedAt: new Date().toISOString()
        };
        await repositories.nutrition.updateNutritionLog(updatedLog.id, updatedLog);
        setTodayLog(updatedLog);
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
    if (!todayLog) return;
    
    try {
      const updatedItems = todayLog.items.filter(item => item.id !== foodId);
      const updatedLog = {
        ...todayLog,
        items: updatedItems,
        totals: calculateTotals(updatedItems),
        updatedAt: new Date().toISOString()
      };
      
      if (updatedItems.length === 0) {
        // Delete the entire log if no items left
        await repositories.nutrition.deleteNutritionLog(todayLog.id);
        setTodayLog(null);
      } else {
        await repositories.nutrition.updateNutritionLog(updatedLog.id, updatedLog);
        setTodayLog(updatedLog);
      }
    } catch (error) {
      console.error('Failed to delete food:', error);
    }
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
      
      {/* Daily Totals */}
      {todayLog && (
        <div className="card mb-6">
          <h2 className="text-xl font-medium text-gray-900 mb-4">
            Today's Totals - {new Date().toLocaleDateString()}
          </h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {Math.round(todayLog.totals.calories)}
              </div>
              <div className="text-sm text-gray-600">Calories</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {Math.round(todayLog.totals.proteinG)}g
              </div>
              <div className="text-sm text-gray-600">Protein</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {Math.round(todayLog.totals.carbsG)}g
              </div>
              <div className="text-sm text-gray-600">Carbs</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {Math.round(todayLog.totals.fatG)}g
              </div>
              <div className="text-sm text-gray-600">Fat</div>
            </div>
          </div>
        </div>
      )}
      
      {/* Add Food Button */}
      <div className="mb-6">
        <button
          onClick={() => setShowAddFood(true)}
          className="btn btn-primary"
        >
          Add Food Item
        </button>
      </div>
      
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
      
      {/* Today's Foods */}
      {todayLog && todayLog.items.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Today's Foods</h3>
          
          <div className="space-y-3">
            {todayLog.items.map((item) => (
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
      
      {!todayLog && (
        <div className="card text-center py-12">
          <h3 className="text-lg font-medium text-gray-900 mb-2">No food logged today</h3>
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