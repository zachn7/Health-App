
import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { repositories } from '../db';
import { formatWeight, lbsToKg, kgToLbs } from '../lib/unit-conversions';
import { getTodayLocalDateKey, addDaysToLocalDate, formatLocalDate, formatWeightToOneDecimal } from '../lib/date-utils';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { WeightLog, Profile, WorkoutLog } from '../types';

export default function Progress() {
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddWeight, setShowAddWeight] = useState(false);
  const [selectedDate, setSelectedDate] = useState(getTodayLocalDateKey());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [newWeight, setNewWeight] = useState<{
    weightKg: number;
    bodyFat?: number;
    notes: string;
  }>({
    weightKg: 75,
    bodyFat: undefined,
    notes: ''
  });
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    loadProgressData();
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const userProfile = await repositories.profile.get();
      setProfile(userProfile || null);
    } catch (error) {
      console.error('Failed to load profile:', error);
    }
  };

  const getWeightUnit = (): string => {
    return profile?.preferredUnits === 'imperial' ? 'lb' : 'kg';
  };

  const getWeightInputValue = (): number => {
    if (profile?.preferredUnits === 'imperial') {
      // Show imperial value (convert kg to lbs)
      return kgToLbs(newWeight.weightKg);
    }
    // Show metric value (kg)
    return newWeight.weightKg;
  };

  const setWeightInputValue = (value: number) => {
    if (profile?.preferredUnits === 'imperial') {
      // Convert imperial input to kg for storage
      setNewWeight({ ...newWeight, weightKg: lbsToKg(value) });
    } else {
      // Store metric value directly
      setNewWeight({ ...newWeight, weightKg: value });
    }
  };



  const loadProgressData = async () => {
    try {
      const [weights, workouts] = await Promise.all([
        repositories.progress.getWeightLogs(),
        repositories.workout.getWorkoutLogs()
      ]);
      
      setWeightLogs(weights);
      setWorkoutLogs(workouts);
    } catch (error) {
      console.error('Failed to load progress data:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveWeightLog = async () => {
    try {
      // Always use the repository upsert method - it will create or overwrite by date
      const weightLog = {
        date: selectedDate,
        weightKg: newWeight.weightKg,
        bodyFat: newWeight.bodyFat,
        notes: newWeight.notes
      };
      
      // The repository will create or overwrite by date
      const savedLog = await repositories.progress.createWeightLog(weightLog);
      
      // Update local state - replace existing entry if found, otherwise add to top
      setWeightLogs(prev => {
        const filtered = prev.filter(log => log.date !== selectedDate);
        return [savedLog, ...filtered].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      });
      
      // Reset form
      setNewWeight({ weightKg: 75, bodyFat: undefined, notes: '' });
      setShowAddWeight(false);
    } catch (error) {
      console.error('Failed to save weight log:', error);
      alert('Failed to save weight log. Please try again.');
    }
  };

  const calculateWeightStats = () => {
    if (weightLogs.length === 0) return null;
    
    const weights = weightLogs.map(log => log.weightKg);
    const currentWeight = weights[0];
    const startingWeight = weights[weights.length - 1];
    const weightChange = currentWeight - startingWeight;
    const averageWeight = weights.reduce((sum, w) => sum + w, 0) / weights.length;
    
    // Calculate trends from last 7 entries if available
    const recentWeights = weights.slice(0, Math.min(7, weights.length));
    let trend = 'stable';
    if (recentWeights.length >= 3) {
      const firstHalf = recentWeights.slice(0, Math.floor(recentWeights.length / 2));
      const secondHalf = recentWeights.slice(Math.floor(recentWeights.length / 2));
      const firstAvg = firstHalf.reduce((sum, w) => sum + w, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((sum, w) => sum + w, 0) / secondHalf.length;
      
      if (secondAvg < firstAvg - 0.5) trend = 'decreasing';
      else if (secondAvg > firstAvg + 0.5) trend = 'increasing';
    }
    
    return {
      currentWeight,
      startingWeight,
      weightChange,
      averageWeight,
      trend,
      totalEntries: weightLogs.length
    };
  };

  const calculateWorkoutStats = () => {
    if (workoutLogs.length === 0) return null;
    
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);
    
    const recentWorkouts = workoutLogs.filter(
      log => new Date(log.date) >= last30Days
    );
    
    const totalWorkouts = workoutLogs.length;
    const recentWorkoutCount = recentWorkouts.length;
    const avgWorkoutsPerWeek = (recentWorkoutCount / 30) * 7;
    
    // Calculate total volume (weight × reps × sets)
    const totalVolume = workoutLogs.reduce((sum: number, log: WorkoutLog) => {
      return sum + log.entries.reduce((entrySum: number, entry: any) => {
        return entrySum + entry.sets.reduce((setSum: number, set: any) => {
          return setSum + ((set.weight || 0) * set.reps);
        }, 0);
      }, 0);
    }, 0);
    
    return {
      totalWorkouts,
      recentWorkoutCount,
      avgWorkoutsPerWeek,
      totalVolume
    };
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">Loading progress data...</div>
      </div>
    );
  }

  const weightStats = calculateWeightStats();
  const workoutStats = calculateWorkoutStats();

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Progress</h1>
        <p className="mt-2 text-gray-600">Your fitness journey and achievements</p>
      </div>
      
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Scale Weight</h3>
          <div className="text-2xl font-bold text-blue-600" data-testid="current-weight-display">
            {weightStats ? formatWeight(weightStats.currentWeight, profile?.preferredUnits || 'metric') : '—'}
          </div>
          {weightStats && weightStats.weightChange !== 0 && (
            <div className={`text-sm ${weightStats.weightChange > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {weightStats.weightChange > 0 ? '+' : ''}{formatWeight(Math.abs(weightStats.weightChange), profile?.preferredUnits || 'metric')}
            </div>
          )}
        </div>
        
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Total Workouts</h3>
          <div className="text-2xl font-bold text-green-600">
            {workoutStats?.totalWorkouts || 0}
          </div>
          <div className="text-sm text-gray-600">
            {workoutStats ? `${workoutStats.recentWorkoutCount} in last 30 days` : '—'}
          </div>
        </div>
        
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Workouts/Week</h3>
          <div className="text-2xl font-bold text-purple-600">
            {workoutStats ? workoutStats.avgWorkoutsPerWeek.toFixed(1) : '—'}
          </div>
          <div className="text-sm text-gray-600">Average (last 30 days)</div>
        </div>
        
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Average Weight</h3>
          <div className="text-2xl font-bold text-orange-600">
            {weightStats ? formatWeight(weightStats.averageWeight, profile?.preferredUnits || 'metric') : '—'}
          </div>
          <div className="text-sm text-gray-600">Over all logged days</div>
        </div>
      </div>
      
      {/* Weight Tracking Section */}
      <div className="card mb-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-medium text-gray-900">Weight Tracking</h2>
          <button
            onClick={() => setShowAddWeight(true)}
            className="btn btn-primary"
          >
            Log Weight
          </button>
        </div>
        
        {/* Date Navigation */}
        <div className="flex items-center justify-center mb-6 space-x-4">
          <button
            onClick={() => {
              setSelectedDate(addDaysToLocalDate(selectedDate, -1));
            }}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <button
            onClick={() => setShowDatePicker(!showDatePicker)}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Calendar className="w-4 h-4" />
            <span className="font-medium">
              {formatLocalDate(selectedDate, { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
          </button>
          
          <button
            onClick={() => {
              setSelectedDate(addDaysToLocalDate(selectedDate, 1));
            }}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        
        {showDatePicker && (
          <div className="mb-6">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setShowDatePicker(false);
              }}
              className="input w-auto mx-auto block"
            />
          </div>
        )}
        
        {showAddWeight && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-medium mb-4">
              Log Weight for {formatLocalDate(selectedDate, { weekday: 'long', month: 'long', day: 'numeric' })}
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="label" data-testid="weight-unit-label">Weight ({getWeightUnit()})</label>
                <input
                  type="number"
                  data-testid="weight-input"
                  value={getWeightInputValue()}
                  onChange={(e) => setWeightInputValue(parseFloat(e.target.value) || 0)}
                  className="input"
                  min={profile?.preferredUnits === 'imperial' ? "66" : "30"}
                  max={profile?.preferredUnits === 'imperial' ? "661" : "300"}
                  step="0.1"
                />
              </div>
              
              <div>
                <label className="label">Body Fat % (optional)</label>
                <input
                  type="number"
                  value={newWeight.bodyFat || ''}
                  onChange={(e) => setNewWeight({ 
                    ...newWeight, 
                    bodyFat: e.target.value ? parseFloat(e.target.value) : undefined 
                  })}
                  className="input"
                  min="3"
                  max="60"
                  step="0.1"
                />
              </div>
              
              <div>
                <label className="label">Notes (optional)</label>
                <input
                  type="text"
                  value={newWeight.notes}
                  onChange={(e) => setNewWeight({ ...newWeight, notes: e.target.value })}
                  className="input"
                  placeholder="e.g., Morning weight"
                />
              </div>
            </div>
            
            <div className="flex space-x-2">
              <button
                onClick={() => setShowAddWeight(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                data-testid="save-weight-button"
                onClick={saveWeightLog}
                disabled={newWeight.weightKg <= 0}
                className="btn btn-primary"
              >
                Save Weight
              </button>
            </div>
          </div>
        )}
        
        {/* Weight Trend Chart */}
        {weightLogs.length > 1 && (
          <div className="mb-8">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Weight Trend</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={(() => {
                  const recentLogs = weightLogs.slice(0, 30).reverse();
                  return recentLogs.map((log, index) => {
                    // Calculate 7-day rolling average
                    const rollingPeriod = 7;
                    const startIdx = Math.max(0, index - Math.floor(rollingPeriod / 2));
                    const endIdx = Math.min(recentLogs.length - 1, index + Math.floor(rollingPeriod / 2));
                    
                    const periodLogs = recentLogs.slice(startIdx, endIdx + 1);
                    const rollingAverage = periodLogs.reduce((sum, l) => sum + l.weightKg, 0) / periodLogs.length;
                    
                    const displayWeight = formatWeightToOneDecimal(
                      profile?.preferredUnits === 'imperial' ? (log.weightKg * 2.20462) : log.weightKg
                    );
                    const displayAverage = formatWeightToOneDecimal(
                      profile?.preferredUnits === 'imperial' ? (rollingAverage * 2.20462) : rollingAverage
                    );
                    
                    return {
                      date: new Date(log.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                      weight: displayWeight,
                      weightKg: log.weightKg,
                      average: displayAverage,
                      averageKg: rollingAverage
                    };
                  });
                })()}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    domain={['dataMin - 1', 'dataMax + 1']}
                    label={{ value: `Weight (${getWeightUnit()})`, angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '6px' }}
                    labelStyle={{ fontWeight: 600 }}
                    formatter={(value: any, name: string) => {
                      if (name === 'Actual Weight') {
                        return [`${value} ${getWeightUnit()}`, 'Actual Weight'];
                      } else if (name === '7-Day Average') {
                        return [`${value} ${getWeightUnit()}`, '7-Day Average'];
                      }
                      return [`${value} ${getWeightUnit()}`, name];
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="weight" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    dot={{ fill: '#3b82f6', r: 4 }}
                    activeDot={{ r: 6 }}
                    name="Actual Weight"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="average" 
                    stroke="#ef4444" 
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                    name="7-Day Average"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        
        {weightLogs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Date</th>
                  <th className="text-left py-2">Weight ({getWeightUnit()})</th>
                  <th className="text-left py-2">Body Fat</th>
                  <th className="text-left py-2">Change</th>
                  <th className="text-left py-2">Notes</th>
                </tr>
              </thead>
              <tbody>
                {weightLogs.slice(0, 10).map((log, index) => {
                  const prevWeight = index < weightLogs.length - 1 ? weightLogs[index + 1].weightKg : null;
                  const change = prevWeight ? log.weightKg - prevWeight : null;
                  
                  return (
                    <tr key={log.id} className="border-b">
                      <td className="py-2">{new Date(log.date).toLocaleDateString()}</td>
                      <td className="py-2 font-medium">{formatWeight(log.weightKg, profile?.preferredUnits || 'metric')}</td>
                      <td className="py-2">{log.bodyFat ? `${log.bodyFat.toFixed(1)}%` : '—'}</td>
                      <td className="py-2">
                        {change && (
                          <span className={change > 0 ? 'text-red-600' : change < 0 ? 'text-green-600' : 'text-gray-600'}>
                            {change > 0 ? '+' : ''}{formatWeight(Math.abs(change), profile?.preferredUnits || 'metric')}
                          </span>
                        )}
                      </td>
                      <td className="py-2">{log.notes || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-600 mb-4">No weight data yet. Start tracking your progress!</p>
          </div>
        )}
      </div>
      
      {/* Recent Workouts */}
      <div className="card">
        <h2 className="text-xl font-medium text-gray-900 mb-4">Recent Workouts</h2>
        
        {workoutLogs.length > 0 ? (
          <div className="space-y-3">
            {workoutLogs.slice(0, 5).map((log) => (
              <div key={log.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <div>
                  <div className="font-medium">{new Date(log.date).toLocaleDateString()}</div>
                  <div className="text-sm text-gray-600">
                    {log.entries.length} exercises • {log.duration} minutes
                  </div>
                  {log.sessionNotes && (
                    <div className="text-sm text-gray-600 italic">{log.sessionNotes}</div>
                  )}
                </div>
                <div className="text-sm text-gray-500">
                  {log.entries.reduce((sum: number, entry: any) => sum + entry.sets.length, 0)} sets
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-600 mb-4">No workouts logged yet. Start your training journey!</p>
          </div>
        )}
      </div>
    </div>
  );
}