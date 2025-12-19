import { useState, useEffect } from 'react';
import { repositories } from '../db';
import { ExerciseDBService } from '../lib/exercise-db';
import { formatWeight } from '../lib/unit-conversions';
import { Edit3, Plus, Trash2, X } from 'lucide-react';
import ExercisePicker from '../components/ExercisePicker';
import type { WorkoutPlan, ExerciseDBItem, Profile } from '../types';

interface ExerciseData {
  [id: string]: {
    name: string;
    instructions: string[];
  };
}

interface EditingWorkout {
  weekIndex: number;
  dayIndex: number;
  type?: 'replace' | 'add';
  exerciseId?: string;
}

export default function Workouts() {
  const [workoutPlans, setWorkoutPlans] = useState<WorkoutPlan[]>([]);
  const [, setExercises] = useState<ExerciseDBItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<WorkoutPlan | null>(null);
  const [selectedWeek, setSelectedWeek] = useState(0);
  const [workoutCompletion, setWorkoutCompletion] = useState<Record<string, Record<string, boolean>>>({});
  const [editingWorkout, setEditingWorkout] = useState<EditingWorkout | null>(null);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [exerciseData, setExerciseData] = useState<ExerciseData>({});
  const [deleteConfirmPlan, setDeleteConfirmPlan] = useState<WorkoutPlan | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [showManualBuilder, setShowManualBuilder] = useState(false);
  const [manualPlan, setManualPlan] = useState<Partial<WorkoutPlan>>({
    name: '',
    weeks: [{
      week: 1,
      workouts: [{
        day: 'Day 1',
        exercises: []
      }]
    }]
  });

  useEffect(() => {
    loadWorkoutData();
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

  const loadWorkoutData = async () => {
    try {
      await ExerciseDBService.initialize();
      const bodyParts = await ExerciseDBService.getAllBodyParts();
      
      // Load some exercises for display
      const sampleExercises: ExerciseDBItem[] = [];
      for (const bodyPart of bodyParts.slice(0, 5)) {
        const exercises = await ExerciseDBService.getExercisesByBodyPart(bodyPart);
        sampleExercises.push(...exercises.slice(0, 3));
      }
      setExercises(sampleExercises);
      
      const plans = await repositories.workout.getWorkoutPlans();
      setWorkoutPlans(plans);
    } catch (error) {
      console.error('Failed to load workout data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadExerciseData = async (exerciseIds: string[]) => {
    const data: ExerciseData = {};
    for (const id of exerciseIds) {
      try {
        const exercise = await ExerciseDBService.getExerciseById(id);
        if (exercise) {
          data[id] = {
            name: exercise.name,
            instructions: exercise.instructions
          };
        }
      } catch (error) {
        console.error(`Failed to load exercise ${id}:`, error);
      }
    }
    setExerciseData(prev => ({ ...prev, ...data }));
  };

  const getExerciseName = (exerciseId: string): string => {
    return exerciseData[exerciseId]?.name || `Exercise ${exerciseId}`;
  };

  const getExerciseInstructions = (exerciseId: string): string[] => {
    return exerciseData[exerciseId]?.instructions || [];
  };
  
  const replaceExercise = async (weekIndex: number, dayIndex: number, oldExerciseId: string, newExerciseId: string) => {
    if (!selectedPlan) return;
    
    try {
      const updatedPlan = { ...selectedPlan };
      const workout = updatedPlan.weeks[weekIndex].workouts[dayIndex];
      
      const exerciseIndex = workout.exercises.findIndex(ex => ex.exerciseId === oldExerciseId);
      if (exerciseIndex !== -1) {
        workout.exercises[exerciseIndex] = {
          ...workout.exercises[exerciseIndex],
          exerciseId: newExerciseId
        };
        
        updatedPlan.updatedAt = new Date().toISOString();
        await repositories.workout.updateWorkoutPlan(updatedPlan.id, updatedPlan);
        setWorkoutPlans(prev => 
          prev.map(plan => plan.id === updatedPlan.id ? updatedPlan : plan)
        );
        setSelectedPlan(updatedPlan);
        
        // Load new exercise data
        await loadExerciseData([newExerciseId]);
      }
    } catch (error) {
      console.error('Failed to replace exercise:', error);
      alert('Failed to replace exercise');
    }
  };
  
  const addExercise = async (weekIndex: number, dayIndex: number, exerciseId: string) => {
    if (!selectedPlan) return;
    
    try {
      const updatedPlan = { ...selectedPlan };
      const workout = updatedPlan.weeks[weekIndex].workouts[dayIndex];
      
      workout.exercises.push({
        exerciseId,
        sets: {
          sets: 3,
          reps: 10,
          restTime: 60
        }
      });
      
      updatedPlan.updatedAt = new Date().toISOString();
      await repositories.workout.updateWorkoutPlan(updatedPlan.id, updatedPlan);
      setWorkoutPlans(prev => 
        prev.map(plan => plan.id === updatedPlan.id ? updatedPlan : plan)
      );
      setSelectedPlan(updatedPlan);
      
      // Load new exercise data
      await loadExerciseData([exerciseId]);
    } catch (error) {
      console.error('Failed to add exercise:', error);
      alert('Failed to add exercise');
    }
  };
  
  const removeExercise = async (weekIndex: number, dayIndex: number, exerciseId: string) => {
    if (!selectedPlan) return;
    
    try {
      const updatedPlan = { ...selectedPlan };
      const workout = updatedPlan.weeks[weekIndex].workouts[dayIndex];
      
      workout.exercises = workout.exercises.filter(ex => ex.exerciseId !== exerciseId);
      
      updatedPlan.updatedAt = new Date().toISOString();
      await repositories.workout.updateWorkoutPlan(updatedPlan.id, updatedPlan);
      setWorkoutPlans(prev => 
        prev.map(plan => plan.id === updatedPlan.id ? updatedPlan : plan)
      );
      setSelectedPlan(updatedPlan);
    } catch (error) {
      console.error('Failed to remove exercise:', error);
      alert('Failed to remove exercise');
    }
  };

  const getCurrentWeek = () => {
    const today = new Date();
    const startOfYear = new Date(today.getFullYear(), 0, 1);
    const weekNumber = Math.ceil((today.getTime() - startOfYear.getTime()) / (7 * 24 * 60 * 60 * 1000));
    return weekNumber % 4;
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
      const profile = await repositories.profile.get();
      if (!profile) {
        alert('Please create a profile first!');
        return;
      }

      const { generateWorkoutPlan } = await import('../lib/coach-engine');
      const plan = generateWorkoutPlan(profile);
      
      await repositories.workout.createWorkoutPlan(plan);
      setWorkoutPlans([plan, ...workoutPlans]);
      
      alert('Workout plan generated successfully!');
    } catch (error) {
      console.error('Failed to generate workout plan:', error);
      alert('Failed to generate workout plan. Please try again.');
    }
  };

  const deleteWorkoutPlan = (plan: WorkoutPlan) => {
    setDeleteConfirmPlan(plan);
  };

  const confirmDeleteWorkoutPlan = async () => {
    if (!deleteConfirmPlan) return;
    
    try {
      await repositories.workout.deleteWorkoutPlan(deleteConfirmPlan.id);
      setWorkoutPlans(workoutPlans.filter(plan => plan.id !== deleteConfirmPlan.id));
      if (selectedPlan?.id === deleteConfirmPlan.id) {
        setSelectedPlan(null);
      }
      setDeleteConfirmPlan(null);
    } catch (error) {
      console.error('Failed to delete workout plan:', error);
      alert('Failed to delete workout plan. Please try again.');
    }
  };

  const startWorkout = (plan: WorkoutPlan, weekIndex: number, dayIndex: number) => {
    const workout = plan.weeks[weekIndex]?.workouts[dayIndex];
    if (!workout) return;

    const workoutData = {
      workoutPlanId: plan.id,
      exercises: workout.exercises,
      notes: workout.notes
    };
    
    sessionStorage.setItem('currentWorkout', JSON.stringify(workoutData));
    window.location.hash = '/log/workout';
  };

  useEffect(() => {
    if (selectedPlan) {
      // Load exercise data for all exercises in the selected plan
      const allExerciseIds: string[] = [];
      selectedPlan.weeks.forEach(week => {
        week.workouts.forEach(workout => {
          workout.exercises.forEach(exercise => {
            allExerciseIds.push(exercise.exerciseId);
          });
        });
      });
      loadExerciseData(allExerciseIds);
    }
  }, [selectedPlan]);

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
      
      <div className="mb-6 flex flex-wrap gap-3">
        <button
          onClick={generateWorkoutPlan}
          className="btn btn-primary"
        >
          Generate New Workout Plan
        </button>
        <button
          onClick={() => setShowManualBuilder(true)}
          className="btn btn-secondary"
        >
          <Plus className="w-4 h-4 mr-1" />
          Create Program Manually
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
                    onClick={() => deleteWorkoutPlan(plan)}
                    className="btn btn-danger text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
              
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
            
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Week {selectedWeek + 1} Workouts
              </h3>
              
              <div className="space-y-4">
                {selectedPlan.weeks[selectedWeek]?.workouts.map((workout, dayIndex) => {
                  const isEditing = editingWorkout?.weekIndex === selectedWeek && 
                                   editingWorkout?.dayIndex === dayIndex;
                  
                  return (
                    <div key={dayIndex} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="font-medium text-gray-900">{workout.day}</h4>
                          {workout.notes && (
                            <p className="text-sm text-gray-600 mt-1">{workout.notes}</p>
                          )}
                        </div>
                        <div className="flex space-x-2">
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => setEditingWorkout(null)}
                                className="btn btn-secondary text-sm"
                              >
                                <X className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setShowExercisePicker(true)}
                                className="btn btn-primary text-sm"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => setEditingWorkout({ weekIndex: selectedWeek, dayIndex })}
                                className="btn btn-secondary text-sm"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => startWorkout(selectedPlan, selectedWeek, dayIndex)}
                                className="btn btn-primary text-sm"
                              >
                                Start Workout
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        {workout.exercises.map((exercise, exIndex) => {
                          const isComplete = isExerciseComplete(selectedPlan.id, selectedWeek, dayIndex, exercise.exerciseId);
                          const exerciseName = getExerciseName(exercise.exerciseId);
                          const instructions = getExerciseInstructions(exercise.exerciseId);
                          
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
                                    {exercise.sets.weight && ` • ${formatWeight(exercise.sets.weight, profile?.preferredUnits || 'metric')}${getWeightUnit()}`}
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
                                {isEditing && (
                                  <div className="flex space-x-1">
                                    <button
                                      onClick={() => setShowExercisePicker(true)}
                                      className="text-blue-600 hover:text-blue-800"
                                      title="Replace exercise"
                                    >
                                      <Edit3 className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => removeExercise(selectedWeek, dayIndex, exercise.exerciseId)}
                                      className="text-red-600 hover:text-red-800"
                                      title="Remove exercise"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        
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
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Exercise Picker Modal */}
      {showExercisePicker && editingWorkout && (
        <ExercisePicker
          onSelect={(exercise) => {
            if (editingWorkout) {
              if (showManualBuilder) {
                // Handle manual builder
                if (editingWorkout.dayIndex !== undefined) {
                  const updatedWorkouts = [...(manualPlan.weeks?.[0]?.workouts || [])];
                  const newExercise = {
                    exerciseId: exercise.id,
                    exerciseName: exercise.name,
                    sets: 3,
                    reps: '8-12',
                    restTime: 60,
                    notes: ''
                  };
                  
                  updatedWorkouts[editingWorkout.dayIndex] = {
                    ...updatedWorkouts[editingWorkout.dayIndex],
                    exercises: [...updatedWorkouts[editingWorkout.dayIndex].exercises, newExercise as any]
                  };
                  
                  setManualPlan({
                    ...manualPlan,
                    weeks: [{
                      week: 1,
                      workouts: updatedWorkouts
                    }]
                  });
                }
              } else if (selectedPlan) {
                // Handle regular editing
                if (editingWorkout.exerciseId) {
                  replaceExercise(editingWorkout.weekIndex, editingWorkout.dayIndex, editingWorkout.exerciseId, exercise.id);
                } else {
                  addExercise(editingWorkout.weekIndex, editingWorkout.dayIndex, exercise.id);
                }
              }
            }
          }}
          onClose={() => {
            setShowExercisePicker(false);
            setEditingWorkout(null);
          }}
          excludeIds={selectedPlan?.weeks[selectedWeek]?.workouts[editingWorkout.dayIndex]?.exercises.map(ex => ex.exerciseId) || []}
        />
      )}
      
      {/* Delete Confirmation Modal */}
      {deleteConfirmPlan && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900">Delete Workout Plan</h3>
                <p className="text-sm text-gray-600">This action cannot be undone.</p>
              </div>
            </div>
            
            <div className="mb-6">
              <p className="text-gray-700">
                Are you sure you want to delete <strong>"{deleteConfirmPlan.name}"</strong>? 
                This will permanently remove the workout plan and all its exercises.
              </p>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmPlan(null)}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteWorkoutPlan}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete Plan
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Manual Program Builder Modal */}
      {showManualBuilder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Create Manual Workout Program</h2>
              
              <div className="mb-4">
                <label className="label">Program Name</label>
                <input
                  type="text"
                  value={manualPlan.name || ''}
                  onChange={(e) => setManualPlan({ ...manualPlan, name: e.target.value })}
                  className="input"
                  placeholder="e.g., My Push-Pull-Legs Program"
                />
              </div>
              
              <div className="mb-6">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-medium text-gray-900">Training Days</h3>
                  <button
                    onClick={() => {
                      const newWorkout = {
                        day: `Day ${(manualPlan.weeks?.[0]?.workouts?.length || 0) + 1}`,
                        exercises: []
                      };
                      setManualPlan({
                        ...manualPlan,
                        weeks: [
                          {
                            week: 1,
                            workouts: [...(manualPlan.weeks?.[0]?.workouts || []), newWorkout]
                          }
                        ]
                      });
                    }}
                    className="btn btn-secondary text-sm"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Day
                  </button>
                </div>
                
                {manualPlan.weeks?.[0]?.workouts?.map((day, dayIndex) => (
                  <div key={dayIndex} className="mb-4 p-4 border border-gray-200 rounded-lg">
                    <div className="flex justify-between items-center mb-3">
                      <input
                        type="text"
                        value={day.day}
                        onChange={(e) => {
                          const updatedWorkouts = [...(manualPlan.weeks?.[0]?.workouts || [])];
                          updatedWorkouts[dayIndex] = { ...day, day: e.target.value };
                          setManualPlan({
                            ...manualPlan,
                            weeks: [{
                              week: 1,
                              workouts: updatedWorkouts
                            }]
                          });
                        }}
                        className="font-medium bg-transparent border-none text-gray-900"
                      />
                      <button
                        onClick={() => {
                          const updatedWorkouts = manualPlan.weeks?.[0]?.workouts?.filter((_, i) => i !== dayIndex) || [];
                          setManualPlan({
                            ...manualPlan,
                            weeks: [{
                              week: 1,
                              workouts: updatedWorkouts
                            }]
                          });
                        }}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <div className="space-y-2">
                      {day.exercises.map((exercise, exerciseIndex) => (
                        <div key={exerciseIndex} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <div>
                            <div className="font-medium text-sm">{exercise.exerciseId}</div>
                            <div className="text-xs text-gray-600">
                              {exercise.sets.sets} sets × {exercise.sets.reps} reps
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              const updatedExercises = day.exercises.filter((_, i) => i !== exerciseIndex);
                              const updatedWorkouts = [...(manualPlan.weeks?.[0]?.workouts || [])];
                              updatedWorkouts[dayIndex] = { ...day, exercises: updatedExercises };
                              setManualPlan({
                                ...manualPlan,
                                weeks: [{
                                  week: 1,
                                  workouts: updatedWorkouts
                                }]
                              });
                            }}
                            className="text-red-600 hover:text-red-800"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      
                      <button
                        onClick={() => {
                          setSelectedPlan(null); // Clear selection
                          setEditingWorkout({ weekIndex: 0, dayIndex, type: 'add' });
                          setShowExercisePicker(true);
                        }}
                        className="btn btn-secondary text-sm w-full"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add Exercise
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => setShowManualBuilder(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!manualPlan.name) {
                      alert('Please enter a program name');
                      return;
                    }
                    
                    try {
                      const newPlan: WorkoutPlan = {
                        id: crypto.randomUUID(),
                        name: manualPlan.name,
                        weeks: manualPlan.weeks || [],
                        generatedBy: 'manual',
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                      };
                      
                      await repositories.workout.createWorkoutPlan(newPlan);
                      setWorkoutPlans([newPlan, ...workoutPlans]);
                      setShowManualBuilder(false);
                      setManualPlan({
                        name: '',
                        weeks: [{
                          week: 1,
                          workouts: [{
                            day: 'Day 1',
                            exercises: []
                          }]
                        }]
                      });
                    } catch (error) {
                      console.error('Failed to save manual program:', error);
                      alert('Failed to save program. Please try again.');
                    }
                  }}
                  disabled={!manualPlan.name || !manualPlan.weeks?.[0]?.workouts?.length}
                  className="btn btn-primary"
                >
                  Save Program
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}