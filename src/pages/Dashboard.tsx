import { useState, useEffect } from 'react';
import { liveQuery } from 'dexie';
import { repositories } from '../db';
import { formatWeight } from '../lib/unit-conversions';
import { calculateTDEE } from '../lib/coach-engine';
import type { Profile, WorkoutLog, NutritionLog } from '../types';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [todaysWorkout, setTodaysWorkout] = useState<WorkoutLog | null>(null);
  const [todaysNutrition, setTodaysNutrition] = useState<NutritionLog | null>(null);
  const [weightTrend, setWeightTrend] = useState<any>(null);
  const [weeklyAdherence, setWeeklyAdherence] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
    
    // Set up liveQuery for reactive profile updates
    const profileSubscription = liveQuery(() => 
      repositories.profile.get()
    ).subscribe({
      next: (profile) => {
        setProfile(profile || null);
      },
      error: (error) => {
        console.error('Profile liveQuery error:', error);
      }
    });

    return () => {
      profileSubscription.unsubscribe();
    };
  }, []);

  const loadDashboardData = async () => {
    try {
      // Load profile
      const userProfile = await repositories.profile.get();
      setProfile(userProfile || null);

      // Load today's data
      const [workout, nutrition, weightInfo, weeklyAdherence] = await Promise.all([
        repositories.workout.getTodaysWorkout(),
        repositories.nutrition.getTodaysNutrition(),
        repositories.progress.getWeightTrend(30),
        repositories.progress.getWeeklyWorkoutAdherence(),
      ]);

      setTodaysWorkout(workout || null);
      setTodaysNutrition(nutrition || null);
      setWeightTrend(weightInfo);
      setWeeklyAdherence(weeklyAdherence);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTodayStatus = () => {
    if (!profile) return 'setup';
    
    const hasWorkout = todaysWorkout !== null;
    const hasNutrition = todaysNutrition !== null;
    
    if (hasWorkout && hasNutrition) return 'complete';
    if (hasWorkout || hasNutrition) return 'partial';
    return 'pending';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'complete': return 'text-green-600 bg-green-100';
      case 'partial': return 'text-yellow-600 bg-yellow-100';
      case 'pending': return 'text-gray-600 bg-gray-100';
      case 'setup': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'complete': return 'Great job! Day complete';
      case 'partial': return 'Keep going! Some progress made';
      case 'pending': return 'Day not started yet';
      case 'setup': return 'Complete your profile first';
      default: return 'Loading...';
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">Loading dashboard...</div>
      </div>
    );
  }

  const todayStatus = getTodayStatus();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-2 text-gray-600">Your fitness overview</p>
      </div>

      {/* Status Card */}
      <div className={`mb-8 p-6 rounded-lg ${getStatusColor(todayStatus)}`} data-testid="dashboard-status-card">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold" data-testid="dashboard-status-title">Today's Status</h2>
            <p className="mt-1" data-testid="dashboard-status-text">{getStatusText(todayStatus)}</p>
          </div>
          <div className="text-3xl" data-testid="dashboard-status-icon">
            {todayStatus === 'complete' && '✨'}
            {todayStatus === 'partial' && '💪'}
            {todayStatus === 'pending' && '⏰'}
            {todayStatus === 'setup' && '⚙️'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Today's Workout */}
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Today's Workout</h3>
          {todaysWorkout ? (
            <div>
              <p className="text-sm text-gray-600 mb-2">
                Completed: {new Date(todaysWorkout.createdAt).toLocaleTimeString()}
              </p>
              <p className="text-sm text-gray-600 mb-2">
                Duration: {todaysWorkout.duration} minutes
              </p>
              <p className="text-sm text-gray-600 mb-2">
                Exercises: {todaysWorkout.entries.length}
              </p>
              {todaysWorkout.sessionNotes && (
                <p className="text-sm text-gray-600 italic">
                  "{todaysWorkout.sessionNotes}"
                </p>
              )}
            </div>
          ) : (
            <div>
              <p className="text-gray-600 mb-4">No workout logged yet today</p>
              <button
                onClick={() => navigate('/log/workout')}
                className="btn btn-primary"
              >
                Log Workout
              </button>
            </div>
          )}
        </div>

        {/* Nutrition Summary */}
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Nutrition</h3>
          {todaysNutrition ? (
            <div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Calories:</span>
                  <span className="font-medium">
                    {todaysNutrition.totals.calories} / {profile ? calculateTDEE(profile).tdee.toFixed(0) : 2000}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Protein:</span>
                  <span>{todaysNutrition.totals.proteinG}g / {profile ? Math.round((calculateTDEE(profile).tdee * (profile.macroSplit?.protein || 30) / 100) / 4) : 150}g</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Carbs:</span>
                  <span>{todaysNutrition.totals.carbsG}g / {profile ? Math.round((calculateTDEE(profile).tdee * (profile.macroSplit?.carbs || 40) / 100) / 4) : 250}g</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Fat:</span>
                  <span>{todaysNutrition.totals.fatG}g / {profile ? Math.round((calculateTDEE(profile).tdee * (profile.macroSplit?.fat || 30) / 100) / 9) : 65}g</span>
                </div>
              </div>
              {profile?.macroSplit && (
                <div className="mt-3 pt-3 border-t">
                  <div className="text-xs text-gray-600 font-medium mb-2">Macro Split:</div>
                  <div className="flex space-x-2 text-xs">
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">{profile.macroSplit.protein}% Protein</span>
                    <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded">{profile.macroSplit.carbs}% Carbs</span>
                    <span className="px-2 py-1 bg-red-100 text-red-800 rounded">{profile.macroSplit.fat}% Fat</span>
                  </div>
                </div>
              )}
              <p className="text-xs text-gray-600 mt-3">
                {todaysNutrition.items.length} meals logged
              </p>
            </div>
          ) : (
            <div>
              <p className="text-gray-600 mb-4">No nutrition logged yet today</p>
              <button
                onClick={() => navigate('/nutrition')}
                className="btn btn-primary"
              >
                Log Nutrition
              </button>
            </div>
          )}
        </div>

        {/* Weekly Progress */}
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Weekly Progress</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Workout Adherence:</span>
              <span className="font-medium">{Math.round(weeklyAdherence * 100)}%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Workout Days:</span>
              <span>{profile?.schedule && Object.values(profile.schedule).filter(Boolean).length}</span>
            </div>
          </div>
        </div>

        {/* Weight Trend */}
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Weight Trend</h3>
          {weightTrend && weightTrend.current ? (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Current:</span>
                <span className="font-medium">{formatWeight(weightTrend.current, profile?.preferredUnits || 'metric')}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Trend:</span>
                <span className={`font-medium ${
                  weightTrend.trend === 'up' ? 'text-green-600' : 
                  weightTrend.trend === 'down' ? 'text-red-600' : 
                  'text-gray-600'
                }`}>
                  {weightTrend.trend === 'up' && '↑'}
                  {weightTrend.trend === 'down' && '↓'}
                  {weightTrend.trend === 'stable' && '→'}
                  {formatWeight(Math.abs(weightTrend.trendAmount), profile?.preferredUnits || 'metric')}
                </span>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-gray-600 mb-4">No weight data yet</p>
              <button
                onClick={() => navigate('/progress')}
                className="btn btn-secondary"
              >
                Log Weight
              </button>
            </div>
          )}
        </div>

        {/* Profile Overview */}
        <div className="card" data-testid="dashboard-profile-card">
          <h3 className="text-lg font-medium text-gray-900 mb-2" data-testid="dashboard-profile-title">Profile Overview</h3>
          {profile ? (
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-gray-600">Activity Level:</span>
                <span className="ml-2 capitalize">{profile.activityLevel.replace('_', ' ')}</span>
              </div>
              <div>
                <span className="text-gray-600">Experience:</span>
                <span className="ml-2 capitalize">{profile.experienceLevel}</span>
              </div>
              <div>
                <span className="text-gray-600">Equipment:</span>
                <span className="ml-2">{profile.equipment.length} items</span>
              </div>
              <div>
                <span className="text-gray-600">Goals:</span>
                <span className="ml-2">{profile.goals.length}</span>
              </div>
              <button
                onClick={() => navigate('/profile')}
                className="btn btn-secondary mt-3"
              >
                Edit Profile
              </button>
            </div>
          ) : (
            <div>
              <p className="text-gray-600 mb-4">No profile set up yet</p>
              <button
                onClick={() => navigate('/profile')}
                className="btn btn-primary"
              >
                Create Profile
              </button>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Quick Actions</h3>
          <div className="space-y-2">
            <button
              onClick={() => navigate('/coach')}
              className="block btn btn-secondary w-full text-center"
            >
              Generate Workout Plan
            </button>
            <button
              onClick={() => navigate('/workouts')}
              className="block btn btn-secondary w-full text-center"
            >
              View Workout Plans
            </button>
            <button
              onClick={() => navigate('/privacy')}
              className="block btn btn-secondary w-full text-center"
            >
              Privacy Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}