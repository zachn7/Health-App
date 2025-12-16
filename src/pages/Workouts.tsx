
import { useState, useEffect } from 'react';
import { repositories } from '../db';
import type { WorkoutPlan, Exercise } from '../types';

export default function Workouts() {
  const [workoutPlans, setWorkoutPlans] = useState<WorkoutPlan[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<WorkoutPlan | null>(null);
  const [selectedWeek, setSelectedWeek] = useState(0);
  const [workoutCompletion, setWorkoutCompletion] = useState<Record<string, Record<string, boolean>>>({});

  useEffect(() => {
    loadWorkoutData();
  }, []);

  const loadWorkoutData = async () => {
    try {
      // Load seed exercises from bundled data
      const exercisesResponse = await fetch('/src/assets/data/exercises.seed.json');
      const exercisesData = await exercisesResponse.json();
      setExercises(exercisesData);
      
      // Load workout plans from database
      const plans = await repositories.workout.getWorkoutPlans();
      setWorkoutPlans(plans);
    } catch (error) {
      console.error('Failed to load workout data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getExerciseName = (exerciseId: string): string => {
    const exercise = exercises.find(ex => ex.id === exerciseId);
    return exercise?.name || `Exercise ${exerciseId}`;
  };

  const getExerciseInstructions = (exerciseId: string): string[] => {
    const exercise = exercises.find(ex => ex.id === exerciseId);
    return exercise?.instructions || [];
  };

  const getCurrentWeek = () => {
    const today = new Date();
    const startOfYear = new Date(today.getFullYear(), 0, 1);
    const weekNumber = Math.ceil((today.getTime() - startOfYear.getTime()) / (7 * 24 * 60 * 60 * 1000));
    return weekNumber % 4; // Cycle through 4-week blocks
  };

  const getWorkoutKey = (planId: string, weekIndex: number, dayIndex: number) => {
    return `${planId}-w${weekIndex}-d${dayIndex}`;
  };

  const toggleExerciseComplete = (planId: string, weekIndex: number, dayIndex: number, exerciseId: string) => {
    const workoutKey = getWorkoutKey(planId, weekIndex, dayIndex);
    setWorkoutCompletion(prev => ({
      ...prev,
      [workoutKey]: {
        ...prev[workoutKey],
        [exerciseId]: !prev[workoutKey]?.[exerciseId]
      }
    }));
  };

  const isExerciseComplete = (planId: string, weekIndex: number, dayIndex: number, exerciseId: string) => {
    const workoutKey = getWorkoutKey(planId, weekIndex, dayIndex);
    return workoutCompletion[workoutKey]?.[exerciseId] || false;
  };

  const getWorkoutProgress = (planId: string, weekIndex: number, dayIndex: number, totalExercises: number) => {
    const workoutKey = getWorkoutKey(planId, weekIndex, dayIndex);
    const completed = Object.values(workoutCompletion[workoutKey] || {}).filter(Boolean).length;
    return { completed, total: totalExercises, percentage: (completed / totalExercises) * 100 };
  };

  const markWholeWorkoutComplete = (planId: string, weekIndex: number, dayIndex: number, exercises: any[]) => {
    const workoutKey = getWorkoutKey(planId, weekIndex, dayIndex);
    const completion: Record<string, boolean> = {};
    exercises.forEach(ex => {
      completion[ex.exerciseId] = true;
    });
    
    setWorkoutCompletion(prev => ({
      ...prev,
      [workoutKey]: completion
    }));
  };

  const generateWorkoutPlan = async () => {
    try {
      // Get or create profile
      const profile = await repositories.profile.get();
      if (!profile) {
        alert('Please create a profile first!');
        return;
      }

      // Generate plan using the coach engine
      const { generateWorkoutPlan } = await import('../lib/coach-engine');
      const plan = generateWorkoutPlan(profile);
      
      // Save the plan
      await repositories.workout.createWorkoutPlan(plan);
      setWorkoutPlans([plan, ...workoutPlans]);
      
      alert('Workout plan generated successfully!');
    } catch (error) {
      console.error('Failed to generate workout plan:', error);
      alert('Failed to generate workout plan. Please try again.');
    }
  };

  const deleteWorkoutPlan = async (planId: string) => {
    try {
      await repositories.workout.deleteWorkoutPlan(planId);
      setWorkoutPlans(workoutPlans.filter(plan => plan.id !== planId));
      if (selectedPlan?.id === planId) {
        setSelectedPlan(null);
      }
    } catch (error) {
      console.error('Failed to delete workout plan:', error);
    }
  };

  const startWorkout = (plan: WorkoutPlan, weekIndex: number, dayIndex: number) => {
    const workout = plan.weeks[weekIndex]?.workouts[dayIndex];
    if (!workout) return;

    // Navigate to workout logger with the specific workout
    const workoutData = {
      workoutPlanId: plan.id,
      exercises: workout.exercises,
      notes: workout.notes
    };
    
    // Store in session for the logger to pick up
    sessionStorage.setItem('currentWorkout', JSON.stringify(workoutData));
    window.location.hash = '/log/workout';
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">Loading workout data...</div>
      </div>
    );
  }

  const currentWeekIndex = getCurrentWeek();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Workouts</h1>
        <p className="mt-2 text-gray-600">Your training plans and exercises</p>
      </div>
      
      <div className="mb-6">
        <button
          onClick={generateWorkoutPlan}
          className="btn btn-primary"
        >
          Generate New Workout Plan
        </button>
      </div>
      
      {/* Workout Plans List */}
      <div className="space-y-4 mb-8">
        {workoutPlans.length > 0 ? (
          workoutPlans.map((plan) => (
            <div key={plan.id} className="card">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">{plan.name}</h3>
                  <p className="text-sm text-gray-600">
                    {plan.weeks.length} weeks • Generated by {plan.generatedBy}
                  </p>
                  <p className="text-sm text-gray-600">
                    Created {new Date(plan.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setSelectedPlan(plan)}
                    className="btn btn-secondary text-sm"
                  >
                    View
                  </button>
                  <button
                    onClick={() => deleteWorkoutPlan(plan.id)}
                    className="btn btn-danger text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
              
              {/* Quick Start Current Week */}
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium text-gray-900 mb-2">Week {currentWeekIndex + 1} (Current Week)</h4>
                <div className="space-y-2">
                  {plan.weeks[currentWeekIndex]?.workouts.map((workout, dayIndex) => {
                    const progress = getWorkoutProgress(plan.id, currentWeekIndex, dayIndex, workout.exercises.length);
                    return (
                      <div key={dayIndex} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <div className="font-medium text-sm">{workout.day}</div>
                          <div className="text-xs text-gray-600">
                            {workout.exercises.length} exercises
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="text-xs text-gray-600">
                            {progress.completed}/{progress.total}
                          </div>
                          <button
                            onClick={() => setSelectedPlan(plan)}
                            className="btn btn-secondary text-xs py-1 px-2"
                          >
                            View Details
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="card text-center py-12">
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Workout Plans</h3>
            <p className="text-gray-600 mb-4">Generate your first personalized workout plan to get started</p>
            <button
              onClick={generateWorkoutPlan}
              className="btn btn-primary"
            >
              Generate Workout Plan
            </button>
          </div>
        )}
      </div>
      
      {/* Selected Plan Details */}
      {selectedPlan && (
        <div className="card">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-medium text-gray-900">{selectedPlan.name}</h2>
            <button
              onClick={() => setSelectedPlan(null)}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
          
          <div className="space-y-6">
            {/* Week Navigation */}
            <div>
              <label className="label">Select Week</label>
              <div className="flex space-x-2">
                {selectedPlan.weeks.map((_, weekIndex) => (
                  <button
                    key={weekIndex}
                    onClick={() => setSelectedWeek(weekIndex)}
                    className={`px-3 py-1 rounded text-sm ${
                      selectedWeek === weekIndex
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Week {weekIndex + 1}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Current Week Details */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Week {selectedWeek + 1} Workouts
              </h3>
              
              <div className="space-y-4">
                {selectedPlan.weeks[selectedWeek]?.workouts.map((workout, dayIndex) => (
                  <div key={dayIndex} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-medium text-gray-900">{workout.day}</h4>
                        {workout.notes && (
                          <p className="text-sm text-gray-600 mt-1">{workout.notes}</p>
                        )}
                      </div>
                      <button
                        onClick={() => startWorkout(selectedPlan, selectedWeek, dayIndex)}
                        className="btn btn-primary text-sm"
                      >
                        Start Workout
                      </button>
                    </div>
                    
                    <div className="space-y-3">
                      {workout.exercises.map((exercise, exIndex) => {
                        const exerciseName = getExerciseName(exercise.exerciseId);
                        const instructions = getExerciseInstructions(exercise.exerciseId);
                        const isComplete = isExerciseComplete(selectedPlan.id, selectedWeek, dayIndex, exercise.exerciseId);
                        
                        return (
                          <div key={exIndex} className={`border-l-4 pl-4 ${isComplete ? 'border-green-500 bg-green-50' : 'border-blue-500'}`}>
                            <div className="flex items-start space-x-3">
                              <input
                                type="checkbox"
                                checked={isComplete}
                                onChange={() => toggleExerciseComplete(selectedPlan.id, selectedWeek, dayIndex, exercise.exerciseId)}
                                className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <div className="flex-1">
                                <div className={`font-medium ${isComplete ? 'line-through text-gray-500' : ''}`}>
                                  {exerciseName}
                                </div>
                                <div className="text-sm text-gray-600">
                                  {exercise.sets.repsRange ? 
                                    `${exercise.sets.sets} sets of ${exercise.sets.repsRange.min}-${exercise.sets.repsRange.max} reps` :
                                    `${exercise.sets.sets} sets of ${exercise.sets.reps} reps`
                                  }
                                  {exercise.sets.weight && ` • ${exercise.sets.weight}kg`}
                                  {exercise.sets.restTime && ` • ${exercise.sets.restTime}s rest`}
                                </div>
                                {exercise.sets.notes && (
                                  <div className="text-sm text-gray-600 italic mt-1">{exercise.sets.notes}</div>
                                )}
                                {instructions.length > 0 && (
                                  <details className="mt-2">
                                    <summary className="text-sm text-blue-600 cursor-pointer">Instructions</summary>
                                    <ul className="text-sm text-gray-600 mt-2 ml-4 list-disc">
                                      {instructions.slice(0, 3).map((instruction, i) => (
                                        <li key={i}>{instruction}</li>
                                      ))}
                                    </ul>
                                  </details>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      
                      {/* Workout completion summary and actions */}
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="flex justify-between items-center">
                          <div className="text-sm text-gray-600">
                            Progress: {getWorkoutProgress(selectedPlan.id, selectedWeek, dayIndex, workout.exercises.length).completed} of {workout.exercises.length} exercises
                          </div>
                          <button
                            onClick={() => markWholeWorkoutComplete(selectedPlan.id, selectedWeek, dayIndex, workout.exercises)}
                            className="btn btn-primary text-sm"
                          >
                            Mark Whole Workout Complete
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}