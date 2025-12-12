import { useState, useEffect } from 'react';
import { repositories } from '../db';
import { calculateTDEE, calculateMacroTargets, generateWorkoutPlan } from '../lib/coach-engine';
import type { Profile, WorkoutPlan } from '../types';

export default function Coach() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [currentPlan, setCurrentPlan] = useState<WorkoutPlan | null>(null);
  const [tdee, setTdee] = useState<{ bmr: number; tdee: number } | null>(null);
  const [macroTargets, setMacroTargets] = useState<any>(null);
  const [generatedPlan, setGeneratedPlan] = useState<WorkoutPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showCheckIn, setShowCheckIn] = useState(false);
  
  const [checkIn, setCheckIn] = useState({
    adherenceRating: 3,
    energyLevel: 3,
    sleepQuality: 3,
    soreness: 3,
    notes: ''
  });

  useEffect(() => {
    loadCoachData();
  }, []);

  const loadCoachData = async () => {
    try {
      const userProfile = await repositories.profile.get();
      setProfile(userProfile || null);

      if (userProfile) {
        // Load current workout plan
        const plans = await repositories.workout.getWorkoutPlans();
        if (plans.length > 0) {
          setCurrentPlan(plans[0]);
        }

        // Calculate TDEE and macros
        const tdeeResult = calculateTDEE(userProfile);
        setTdee(tdeeResult);
        
        const macros = calculateMacroTargets(userProfile, tdeeResult.tdee);
        setMacroTargets(macros);
      }
    } catch (error) {
      console.error('Failed to load coach data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateNewPlan = async () => {
    if (!profile) return;

    setGenerating(true);
    try {
      const newPlan = generateWorkoutPlan(profile);
      setGeneratedPlan(newPlan);
    } catch (error) {
      console.error('Failed to generate plan:', error);
      alert('Failed to generate workout plan. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const saveGeneratedPlan = async () => {
    if (!generatedPlan) return;

    try {
      await repositories.workout.createWorkoutPlan(generatedPlan);
      setCurrentPlan(generatedPlan);
      setGeneratedPlan(null);
      alert('Workout plan saved successfully!');
    } catch (error) {
      console.error('Failed to save plan:', error);
      alert('Failed to save workout plan. Please try again.');
    }
  };

  const submitCheckIn = async () => {
    try {
      await repositories.progress.createWeeklyCheckIn({
        id: crypto.randomUUID(),
        ...checkIn,
        createdAt: new Date().toISOString()
      });
      
      alert('Weekly check-in submitted successfully!');
      setShowCheckIn(false);
      setCheckIn({
        adherenceRating: 3,
        energyLevel: 3,
        sleepQuality: 3,
        soreness: 3,
        notes: ''
      });
    } catch (error) {
      console.error('Failed to submit check-in:', error);
      alert('Failed to submit check-in. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">Loading coach...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="card text-center py-12">
          <h2 className="text-xl font-medium text-gray-900 mb-4">Profile Required</h2>
          <p className="text-gray-600 mb-6">Please complete your profile to get personalized coaching</p>
          <a href="#/profile" className="btn btn-primary">
            Go to Profile
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">AI Coach</h1>
        <p className="mt-2 text-gray-600">Your personal training assistant</p>
      </div>

      <div className="space-y-6">
        {/* Profile Summary */}
        <div className="card">
          <h2 className="text-xl font-medium text-gray-900 mb-4">Your Profile Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="text-sm text-gray-600">Age</div>
              <div className="font-medium">{profile.age || 'Not set'}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Weight</div>
              <div className="font-medium">{profile.weightKg} kg</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Experience</div>
              <div className="font-medium capitalize">{profile.experienceLevel}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Activity Level</div>
              <div className="font-medium capitalize">{profile.activityLevel.replace('_', ' ')}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Primary Goal</div>
              <div className="font-medium capitalize">
                {profile.goals[0]?.type.replace('_', ' ') || 'Not set'}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Workout Days</div>
              <div className="font-medium">
                {Object.values(profile.schedule).filter(Boolean).length} per week
              </div>
            </div>
          </div>
        </div>

        {/* Nutrition Targets */}
        {macroTargets && (
          <div className="card">
            <h2 className="text-xl font-medium text-gray-900 mb-4">Daily Nutrition Targets</h2>
            <p className="text-sm text-gray-600 mb-4">
              Based on your profile and goals (BMR: {tdee?.bmr} calories, TDEE: {tdee?.tdee} calories)
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{macroTargets.calories}</div>
                <div className="text-sm text-gray-600">Calories</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{macroTargets.proteinG}g</div>
                <div className="text-sm text-gray-600">Protein</div>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">{macroTargets.carbsG}g</div>
                <div className="text-sm text-gray-600">Carbs</div>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{macroTargets.fatG}g</div>
                <div className="text-sm text-gray-600">Fat</div>
              </div>
            </div>
          </div>
        )}

        {/* Current Plan */}
        {currentPlan && (
          <div className="card">
            <h2 className="text-xl font-medium text-gray-900 mb-4">Current Workout Plan</h2>
            <div className="mb-4">
              <h3 className="font-medium">{currentPlan.name}</h3>
              <p className="text-sm text-gray-600">{currentPlan.weeks.length} weeks</p>
              {currentPlan.notes && (
                <p className="text-sm text-gray-600 mt-2">{currentPlan.notes}</p>
              )}
            </div>
            
            <div className="space-y-4">
              {currentPlan.weeks[0].workouts.map((workout, index) => (
                <div key={index} className="border-l-4 border-blue-500 pl-4">
                  <h4 className="font-medium">{workout.day}</h4>
                  <p className="text-sm text-gray-600">{workout.exercises.length} exercises</p>
                  {workout.notes && (
                    <p className="text-sm text-gray-600 italic mt-1">{workout.notes}</p>
                  )}
                </div>
              ))}
            </div>
            
            <div className="mt-6">
              <a href="#/workouts" className="btn btn-secondary">
                View Full Plan
              </a>
            </div>
          </div>
        )}

        {/* Generate New Plan */}
        <div className="card">
          <h2 className="text-xl font-medium text-gray-900 mb-4">Generate New Workout Plan</h2>
          <p className="text-gray-600 mb-6">
            Create a personalized 4-week workout plan based on your current profile
          </p>
          
          <button
            onClick={generateNewPlan}
            disabled={generating}
            className="btn btn-primary"
          >
            {generating ? 'Generating...' : 'Generate Workout Plan'}
          </button>
        </div>

        {/* Generated Plan Preview */}
        {generatedPlan && (
          <div className="card border-2 border-blue-500">
            <h2 className="text-xl font-medium text-gray-900 mb-4">New Workout Plan Preview</h2>
            <h3 className="font-medium mb-2">{generatedPlan.name}</h3>
            <p className="text-sm text-gray-600 mb-4">{generatedPlan.notes}</p>
            
            <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
              {generatedPlan.weeks[0].workouts.map((workout, index) => (
                <div key={index} className="bg-gray-50 p-3 rounded">
                  <div className="font-medium">{workout.day}</div>
                  <div className="text-sm text-gray-600">
                    {workout.exercises.map((ex, i) => (
                      <div key={i} className="ml-4">
                        • Exercise {i + 1}: {ex.exerciseId} ({ex.sets.sets} sets × {ex.sets.reps} reps)
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={saveGeneratedPlan}
                className="btn btn-primary"
              >
                Save Plan
              </button>
              <button
                onClick={() => setGeneratedPlan(null)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Weekly Check-in */}
        <div className="card">
          <h2 className="text-xl font-medium text-gray-900 mb-4">Weekly Check-in</h2>
          <p className="text-gray-600 mb-6">
            Report how your week went to help adjust your plan
          </p>
          
          {showCheckIn ? (
            <div className="space-y-4">
              <div>
                <label className="label">Workout Adherence (1-5)</label>
                <select
                  value={checkIn.adherenceRating}
                  onChange={(e) => setCheckIn({ ...checkIn, adherenceRating: parseInt(e.target.value) })}
                  className="input"
                >
                  <option value={1}>1 - Very Poor</option>
                  <option value={2}>2 - Poor</option>
                  <option value={3}>3 - Average</option>
                  <option value={4}>4 - Good</option>
                  <option value={5}>5 - Excellent</option>
                </select>
              </div>
              
              <div>
                <label className="label">Energy Level (1-5)</label>
                <select
                  value={checkIn.energyLevel}
                  onChange={(e) => setCheckIn({ ...checkIn, energyLevel: parseInt(e.target.value) })}
                  className="input"
                >
                  <option value={1}>1 - Very Low</option>
                  <option value={2}>2 - Low</option>
                  <option value={3}>3 - Normal</option>
                  <option value={4}>4 - High</option>
                  <option value={5}>5 - Very High</option>
                </select>
              </div>
              
              <div>
                <label className="label">Sleep Quality (1-5)</label>
                <select
                  value={checkIn.sleepQuality}
                  onChange={(e) => setCheckIn({ ...checkIn, sleepQuality: parseInt(e.target.value) })}
                  className="input"
                >
                  <option value={1}>1 - Very Poor</option>
                  <option value={2}>2 - Poor</option>
                  <option value={3}>3 - Average</option>
                  <option value={4}>4 - Good</option>
                  <option value={5}>5 - Excellent</option>
                </select>
              </div>
              
              <div>
                <label className="label"> Muscle Soreness (1-5)</label>
                <select
                  value={checkIn.soreness}
                  onChange={(e) => setCheckIn({ ...checkIn, soreness: parseInt(e.target.value) })}
                  className="input"
                >
                  <option value={1}>1 - No Soreness</option>
                  <option value={2}>2 - Minimal</option>
                  <option value={3}>3 - Normal</option>
                  <option value={4}>4 - High</option>
                  <option value={5}>5 - Very Sore</option>
                </select>
              </div>
              
              <div>
                <label className="label">Notes</label>
                <textarea
                  value={checkIn.notes}
                  onChange={(e) => setCheckIn({ ...checkIn, notes: e.target.value })}
                  className="input"
                  rows={3}
                  placeholder="Any challenges, wins, or observations..."
                />
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={submitCheckIn}
                  className="btn btn-primary"
                >
                  Submit Check-in
                </button>
                <button
                  onClick={() => setShowCheckIn(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowCheckIn(true)}
              className="btn btn-secondary"
            >
              Start Weekly Check-in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}