import { useState, useEffect } from 'react';
import { repositories, db } from '../db';
import { ExerciseDBService } from '../lib/exercise-db';
import { formatWeight } from '../lib/unit-conversions';
import { safeJSONStringify, CurrentWorkoutSchema } from '../lib/schemas';
import { Edit3, Plus, RefreshCw, Trash2, X, AlertCircle } from 'lucide-react';
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
  type?: 'replace' | 'add' | 'prescription';
  exerciseId?: string;
  exerciseIndex?: number;
  currentSets?: any;
}

export default function Workouts() {
  const [workoutPlans, setWorkoutPlans] = useState<WorkoutPlan[]>([]);
  const [, setExercises] = useState<ExerciseDBItem[]>([]);
  const [importMode, setImportMode] = useState<{ weekIndex: number; dayIndex: number } | null>(null);
  const [selectedExercises, setSelectedExercises] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [substituteError, setSubstituteError] = useState<string | null>(null);
  const [substituteSuccess, setSubstituteSuccess] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<WorkoutPlan | null>(null);
  const [selectedWeek, setSelectedWeek] = useState(0);

  const [editingWorkout, setEditingWorkout] = useState<EditingWorkout | null>(null);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [exerciseData, setExerciseData] = useState<ExerciseData>({});
  const [deleteConfirmPlan, setDeleteConfirmPlan] = useState<WorkoutPlan | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [showManualBuilder, setShowManualBuilder] = useState(false);
  const [editingPlan, setEditingPlan] = useState<{ plan: WorkoutPlan; mode: 'rename' | 'edit-days' } | null>(null);
  const [editedPlanName, setEditedPlanName] = useState('');
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
  
  const substituteExercise = async (weekIndex: number, dayIndex: number, exerciseIndex: number, exerciseId: string) => {
    if (!selectedPlan) return;
    
    // Clear previous messages
    setSubstituteError(null);
    setSubstituteSuccess(null);
    
    try {
      const { substituteExercise: coachEngineSubstitute } = await import('../lib/coach-engine');
      const profile = await repositories.profile.get();
      
      // Get exercises used in this day's workout to avoid duplicates
      const currentWorkout = selectedPlan.weeks[weekIndex]?.workouts[dayIndex];
      const usedInCurrentDay = new Set(
        currentWorkout?.exercises.map((ex: any) => ex.exerciseId) || []
      );
      
      // Create slot key for per-substitution history
      const slotKey = `${weekIndex}-${dayIndex}-${exerciseIndex}`;
      
      const newExercise = await coachEngineSubstitute(
        exerciseId,
        selectedPlan.id,
        profile?.equipment,
        usedInCurrentDay,
        slotKey
      );
      
      if (!newExercise) {
        setSubstituteError('Could not find a suitable substitute exercise');
        return;
      }
      
      await replaceExercise(weekIndex, dayIndex, exerciseId, newExercise.id);
      setSubstituteSuccess('Exercise substituted successfully');
      // Clear success message after 3 seconds
      setTimeout(() => setSubstituteSuccess(null), 3000);
    } catch (error) {
      console.error('Failed to substitute exercise:', error);
      setSubstituteError('Failed to substitute exercise. Please try again.');
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

  const editExercisePrescription = (weekIndex: number, dayIndex: number, exerciseIndex: number) => {
    if (!selectedPlan) return;
    
    const exercise = selectedPlan.weeks[weekIndex].workouts[dayIndex].exercises[exerciseIndex];
    setEditingWorkout({
      weekIndex,
      dayIndex,
      type: 'prescription',
      exerciseId: exercise.exerciseId,
      exerciseIndex,
      currentSets: { ...exercise.sets }
    });
  };

  const updateExercisePrescription = async (weekIndex: number, dayIndex: number, exerciseIndex: number, newSets: any) => {
    if (!selectedPlan) return;
    
    try {
      const updatedPlan = { ...selectedPlan };
      const workout = updatedPlan.weeks[weekIndex].workouts[dayIndex];
      
      workout.exercises[exerciseIndex] = {
        ...workout.exercises[exerciseIndex],
        sets: newSets
      };
      
      updatedPlan.updatedAt = new Date().toISOString();
      await repositories.workout.updateWorkoutPlan(updatedPlan.id, updatedPlan);
      setWorkoutPlans(prev => 
        prev.map(plan => plan.id === updatedPlan.id ? updatedPlan : plan)
      );
      setSelectedPlan(updatedPlan);
      setEditingWorkout(null);
    } catch (error) {
      console.error('Failed to update exercise prescription:', error);
      alert('Failed to update exercise prescription');
    }
  };

  const getCurrentWeek = () => {
    const today = new Date();
    const startOfYear = new Date(today.getFullYear(), 0, 1);
    const weekNumber = Math.ceil((today.getTime() - startOfYear.getTime()) / (7 * 24 * 60 * 60 * 1000));
    return weekNumber % 4;
  };











  const generateWorkoutPlan = async () => {
    try {
      const profile = await repositories.profile.get();
      if (!profile) {
        alert('Please create a profile first!');
        return;
      }
      
      setGenerating(true);
      setGenerationError(null);

      console.log('Starting workout plan generation for profile:', profile.id);
      
      // Initialize exercise DB first to ensure data is loaded
      await ExerciseDBService.initialize();
      
      // Verify exercises are available
      const exerciseCount = await db.table('exercises').count();
      console.log(`Exercise database has ${exerciseCount} exercises`);
      
      if (exerciseCount === 0) {
        throw new Error('Exercise database is empty. Please reload the page and try again.');
      }

      const { generateWorkoutPlan: coachEngineGenerate } = await import('../lib/coach-engine');
      const plan = await coachEngineGenerate(profile);
      
      // Verify plan has exercises
      const totalExercises = plan.weeks.reduce((sum, week) => 
        sum + week.workouts.reduce((weekSum, workout) => 
          weekSum + workout.exercises.length, 0), 0);
      
      console.log(`Generated plan with ${totalExercises} exercises across ${plan.weeks.length} weeks`);
      
      if (totalExercises === 0) {
        throw new Error('Generated plan has no exercises. Please try again or check your profile settings.');
      }
      
      await repositories.workout.createWorkoutPlan(plan);
      setWorkoutPlans([plan, ...workoutPlans]);
      
      console.log('Workout plan generated successfully:', plan.id);
      alert('Workout plan generated successfully!');
    } catch (error) {
      console.error('Failed to generate workout plan:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate workout plan. Please try again.';
      setGenerationError(errorMessage);
      alert(errorMessage);
    } finally {
      setGenerating(false);
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

  const startEditingPlan = (plan: WorkoutPlan, mode: 'rename' | 'edit-days') => {
    setEditingPlan({ plan, mode });
    if (mode === 'rename') {
      setEditedPlanName(plan.name);
    }
  };

  const savePlanName = async () => {
    if (!editingPlan || !editedPlanName.trim()) return;
    
    try {
      const updatedPlan = await repositories.workout.updateWorkoutPlan(editingPlan.plan.id, {
        name: editedPlanName.trim()
      });
      
      setWorkoutPlans(prev => 
        prev.map(plan => plan.id === updatedPlan.id ? updatedPlan : plan)
      );
      setSelectedPlan(updatedPlan);
      setEditingPlan(null);
      setEditedPlanName('');
    } catch (error) {
      console.error('Failed to update plan name:', error);
      alert('Failed to update plan name.');
    }
  };

  const addDayToPlan = async (plan: WorkoutPlan, weekIndex: number) => {
    try {
      const updatedPlan = { ...plan };
      const workoutCount = updatedPlan.weeks[weekIndex].workouts.length;
      
      updatedPlan.weeks[weekIndex].workouts.push({
        day: `Day ${workoutCount + 1}`,
        exercises: []
      });
      
      updatedPlan.updatedAt = new Date().toISOString();
      await repositories.workout.updateWorkoutPlan(updatedPlan.id, updatedPlan);
      
      setWorkoutPlans(prev => 
        prev.map(p => p.id === updatedPlan.id ? updatedPlan : p)
      );
      setSelectedPlan(updatedPlan);
    } catch (error) {
      console.error('Failed to add day:', error);
      alert('Failed to add day to plan.');
    }
  };

  const removeDayFromPlan = async (plan: WorkoutPlan, weekIndex: number, dayIndex: number) => {
    if (!confirm('Are you sure you want to remove this day and all its exercises?')) return;
    
    try {
      const updatedPlan = { ...plan };
      updatedPlan.weeks[weekIndex].workouts = updatedPlan.weeks[weekIndex].workouts.filter((_, idx) => idx !== dayIndex);
      
      // Re-number the days
      updatedPlan.weeks[weekIndex].workouts.forEach((workout, idx) => {
        workout.day = `Day ${idx + 1}`;
      });
      
      updatedPlan.updatedAt = new Date().toISOString();
      await repositories.workout.updateWorkoutPlan(updatedPlan.id, updatedPlan);
      
      setWorkoutPlans(prev => 
        prev.map(p => p.id === updatedPlan.id ? updatedPlan : p)
      );
      setSelectedPlan(updatedPlan);
    } catch (error) {
      console.error('Failed to remove day:', error);
      alert('Failed to remove day from plan.');
    }
  };

  const renameDayInPlan = async (plan: WorkoutPlan, weekIndex: number, dayIndex: number, newName: string) => {
    try {
      const updatedPlan = { ...plan };
      updatedPlan.weeks[weekIndex].workouts[dayIndex].day = newName;
      updatedPlan.updatedAt = new Date().toISOString();
      
      await repositories.workout.updateWorkoutPlan(updatedPlan.id, updatedPlan);
      
      setWorkoutPlans(prev => 
        prev.map(p => p.id === updatedPlan.id ? updatedPlan : p)
      );
      setSelectedPlan(updatedPlan);
    } catch (error) {
      console.error('Failed to rename day:', error);
      alert('Failed to rename day.');
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
    
    const stringifyResult = safeJSONStringify(workoutData, CurrentWorkoutSchema, 'Workouts page sessionStorage');
    
    if (stringifyResult.success && stringifyResult.result) {
      sessionStorage.setItem('currentWorkout', stringifyResult.result);
      window.location.hash = '/log/workout';
    } else {
      console.error('❌ Failed to prepare workout data:', stringifyResult.error);
      
      // Show user-friendly error
      const errorDiv = document.createElement('div');
      errorDiv.className = 'fixed top-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg z-50';
      errorDiv.innerHTML = `✗ Failed to prepare workout: ${stringifyResult.error || 'Invalid workout data'}`;
      document.body.appendChild(errorDiv);
      setTimeout(() => {
        if (document.body.contains(errorDiv)) {
          document.body.removeChild(errorDiv);
        }
      }, 5000);
    }
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
          disabled={generating}
          className="btn btn-primary"
          data-testid="generate-empty-workout-plan-btn"
        >
          {generating ? 'Generating...' : 'Generate New Workout Plan'}
        </button>
        <button
          onClick={() => setShowManualBuilder(true)}
          className="btn btn-secondary"
        >
          <Plus className="w-4 h-4 mr-1" />
          Create Program Manually
        </button>
      </div>
      
      {/* Generator Error Banner */}
      {generationError && (
        <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4" role="alert" data-testid="workout-generator-error">
          <div className="flex items-start">
            <AlertCircle className="w-5 h-5 text-yellow-600 mr-2 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h4 className="font-medium text-yellow-900 mb-1">Generation Failed</h4>
              <p className="text-sm text-yellow-800 mb-2">{generationError}</p>
              <button
                onClick={() => {
                  setGenerationError(null);
                  generateWorkoutPlan();
                }}
                className="text-sm text-yellow-700 hover:text-yellow-900 font-medium underline"
                data-testid="workout-generator-retry-btn"
              >
                Retry
              </button>
            </div>
            <button
              onClick={() => setGenerationError(null)}
              className="text-yellow-400 hover:text-yellow-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Workout Plans List */}
      <div className="space-y-4 mb-8">
        {workoutPlans.length > 0 ? (
          workoutPlans.map((plan) => (
            <div key={plan.id} className="card" data-testid={`workout-plan-${plan.id}`}>
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
                    onClick={() => startEditingPlan(plan, 'rename')}
                    className="btn btn-secondary text-sm"
                  >
                    <Edit3 className="w-3 h-3" />
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
                  {plan.weeks[currentWeekIndex]?.workouts.map((workout, dayIndex) => (
                    <div key={dayIndex} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{workout.day}</div>
                        <div className="text-xs text-gray-600">
                          {workout.exercises.length} exercises
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedPlan(plan)}
                        className="btn btn-secondary text-xs py-1 px-2"
                      >
                        View Details
                      </button>
                    </div>
                  ))}
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
              disabled={generating}
              data-testid="generate-workout-plan-btn"
              className="btn btn-primary"
            >
              {generating ? 'Generating...' : 'Generate Workout Plan'}
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
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Week {selectedWeek + 1} Workouts
                </h3>
                <div className="flex space-x-2">
                  <button
                    onClick={() => addDayToPlan(selectedPlan, selectedWeek)}
                    className="btn btn-secondary text-sm"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Day
                  </button>
                </div>
              </div>
              
              <div className="space-y-4">
                {selectedPlan.weeks[selectedWeek]?.workouts.map((workout, dayIndex) => {
                  const isEditing = editingWorkout?.weekIndex === selectedWeek && 
                                   editingWorkout?.dayIndex === dayIndex;
                  
                  return (
                    <div 
                      key={dayIndex} 
                      data-testid={`workout-day-${selectedWeek}-${dayIndex}`}
                      className="border rounded-lg p-4"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          {isEditing ? (
                            <input
                              type="text"
                              defaultValue={workout.day}
                              onBlur={(e) => {
                                const target = e.target as HTMLInputElement;
                                const newName = target.value.trim();
                                if (newName && newName !== workout.day) {
                                  renameDayInPlan(selectedPlan, selectedWeek, dayIndex, newName);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  (e.target as HTMLInputElement).blur();
                                }
                              }}
                              className="input text-sm"
                              autoFocus
                            />
                          ) : (
                            <h4 className="font-medium text-gray-900">{workout.day}</h4>
                          )}
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
                          ) : importMode?.weekIndex === selectedWeek && importMode?.dayIndex === dayIndex ? (
                            <>
                              <button
                                onClick={() => {
                                  setSelectedExercises(new Set(workout.exercises.map(ex => ex.exerciseId)));
                                }}
                                className="btn btn-secondary text-sm"
                              >
                                Select All
                              </button>
                              <button
                                onClick={async () => {
                                  if (selectedExercises.size === 0) {
                                    alert('Please select at least one exercise to import');
                                    return;
                                  }
                                  
                                  // Navigate to workout logger with selected exercises
                                  const selectedWorkoutData = {
                                    workoutPlanId: selectedPlan.id,
                                    exercises: workout.exercises.filter(ex => selectedExercises.has(ex.exerciseId)),
                                    notes: workout.notes,
                                    weekIndex: selectedWeek,
                                    dayIndex: dayIndex
                                  };
                                  
                                  const stringifyResult = safeJSONStringify(selectedWorkoutData, CurrentWorkoutSchema, 'Workouts page selected exercises');
                                  
                                  if (stringifyResult.success && stringifyResult.result) {
                                    sessionStorage.setItem('currentWorkout', stringifyResult.result);
                                    window.location.hash = '/log/workout';
                                  } else {
                                    console.error('❌ Failed to prepare selected exercises:', stringifyResult.error);
                                    
                                    // Show user-friendly error
                                    const errorDiv = document.createElement('div');
                                    errorDiv.className = 'fixed top-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg z-50';
                                    errorDiv.innerHTML = `✗ Failed to prepare exercises: ${stringifyResult.error || 'Invalid exercise data'}`;
                                    document.body.appendChild(errorDiv);
                                    setTimeout(() => {
                                      if (document.body.contains(errorDiv)) {
                                        document.body.removeChild(errorDiv);
                                      }
                                    }, 5000);
                                  }
                                }}
                                className="btn btn-primary text-sm"
                                data-testid="import-selected-btn"
                              >
                                Import Selected ({selectedExercises.size})
                              </button>
                              <button
                                onClick={() => {
                                  setImportMode(null);
                                  setSelectedExercises(new Set());
                                }}
                                className="btn btn-secondary text-sm"
                                data-testid="cancel-import-btn"
                              >
                                Cancel Import
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => setEditingWorkout({ weekIndex: selectedWeek, dayIndex })}
                                className="btn btn-secondary text-sm"
                                data-testid={`edit-workout-day-btn-${selectedWeek}-${dayIndex}`}
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setImportMode({ weekIndex: selectedWeek, dayIndex });
                                  setSelectedExercises(new Set());
                                }}
                                className="btn btn-primary text-sm"
                                data-testid="import-to-log-btn"
                              >
                                Import to Log
                              </button>
                              <button
                                onClick={() => startWorkout(selectedPlan, selectedWeek, dayIndex)}
                                className="btn btn-secondary text-sm"
                              >
                                Start Workout
                              </button>
                              <button
                                onClick={() => removeDayFromPlan(selectedPlan, selectedWeek, dayIndex)}
                                className="btn btn-danger text-sm"
                                title="Remove this day and all exercises"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        {workout.exercises.map((exercise, exIndex) => {
                          const exerciseName = getExerciseName(exercise.exerciseId);
                          const instructions = getExerciseInstructions(exercise.exerciseId);
                          
                          return (
                            <div 
                              key={exIndex}
                              data-testid={`plan-exercise-${exercise.exerciseId}`}
                              className={`border-l-4 pl-4 ${selectedExercises.has(exercise.exerciseId) ? 'border-indigo-500 bg-indigo-50' : 'border-blue-500'}`}
                            >
                              <div className="flex items-start space-x-3">
                                {importMode?.weekIndex === selectedWeek && importMode?.dayIndex === dayIndex && (
                                  <input
                                    type="checkbox"
                                    checked={selectedExercises.has(exercise.exerciseId)}
                                    onChange={() => {
                                      const newSelected = new Set(selectedExercises);
                                      if (newSelected.has(exercise.exerciseId)) {
                                        newSelected.delete(exercise.exerciseId);
                                      } else {
                                        newSelected.add(exercise.exerciseId);
                                      }
                                      setSelectedExercises(newSelected);
                                    }}
                                    className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                  />
                                )}
                                <div className="flex-1">
                                  <div className="font-medium">
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
                                  <>
                                    <div className="flex space-x-1">
                                      <button
                                        onClick={() => setShowExercisePicker(true)}
                                        className="text-blue-600 hover:text-blue-800"
                                        title="Replace exercise"
                                      >
                                        <Edit3 className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => editExercisePrescription(selectedWeek, dayIndex, exIndex)}
                                        className="text-green-600 hover:text-green-800"
                                        title="Edit sets/reps/weight"
                                      >
                                        <Edit3 className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => substituteExercise(selectedWeek, dayIndex, exIndex, exercise.exerciseId)}
                                        className="text-purple-600 hover:text-purple-800"
                                        title="Substitute with similar exercise"
                                        data-testid="substitute-exercise-btn"
                                      >
                                        <RefreshCw className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => removeExercise(selectedWeek, dayIndex, exercise.exerciseId)}
                                        className="text-red-600 hover:text-red-800"
                                        title="Remove exercise"
                                        data-testid="remove-exercise-btn"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                    {substituteError && (
                                      <div 
                                        className="absolute top-full right-0 mt-2 p-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded shadow-lg z-10"
                                        data-testid="substitute-error"
                                      >
                                        {substituteError}
                                        <button
                                          onClick={() => setSubstituteError(null)}
                                          className="ml-2 text-red-600 hover:text-red-800"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      </div>
                                    )}
                                    {substituteSuccess && (
                                      <div 
                                        className="absolute top-full right-0 mt-2 p-2 bg-green-50 border border-green-200 text-green-700 text-xs rounded shadow-lg z-10"
                                        data-testid="substitute-success"
                                      >
                                        {substituteSuccess}
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Exercise Prescription Edit Modal */}
      {editingWorkout?.type === 'prescription' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Edit Exercise Prescription</h3>
              <button
                onClick={() => setEditingWorkout(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {editingWorkout.currentSets && (
              <div className="space-y-4">
                <div>
                  <label className="label">Exercise</label>
                  <div className="text-lg font-medium text-gray-900">
                    {getExerciseName(editingWorkout.exerciseId!)}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Sets</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={editingWorkout.currentSets.sets || ''}
                      onChange={(e) => {
                        const newSets = { ...editingWorkout.currentSets };
                        newSets.sets = parseInt(e.target.value) || 1;
                        setEditingWorkout({ ...editingWorkout, currentSets: newSets });
                      }}
                      className="input"
                    />
                  </div>
                  
                  <div>
                    <label className="label">Rest Time (seconds)</label>
                    <input
                      type="number"
                      min="0"
                      max="600"
                      value={editingWorkout.currentSets.restTime || ''}
                      onChange={(e) => {
                        const newSets = { ...editingWorkout.currentSets };
                        newSets.restTime = parseInt(e.target.value) || 0;
                        setEditingWorkout({ ...editingWorkout, currentSets: newSets });
                      }}
                      className="input"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="label">Rep Scheme</label>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="fixed-reps"
                        name="rep-type"
                        checked={!editingWorkout.currentSets.repsRange}
                        onChange={() => {
                          const newSets = { ...editingWorkout.currentSets };
                          delete newSets.repsRange;
                          setEditingWorkout({ ...editingWorkout, currentSets: newSets });
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <label htmlFor="fixed-reps" className="text-sm text-gray-700">Fixed Reps</label>
                    </div>
                    
                    {!editingWorkout.currentSets.repsRange && (
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={editingWorkout.currentSets.reps || ''}
                        onChange={(e) => {
                          const newSets = { ...editingWorkout.currentSets };
                          newSets.reps = parseInt(e.target.value) || 1;
                          setEditingWorkout({ ...editingWorkout, currentSets: newSets });
                        }}
                        className="input ml-6"
                        placeholder="Reps"
                      />
                    )}
                    
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="rep-range"
                        name="rep-type"
                        checked={!!editingWorkout.currentSets.repsRange}
                        onChange={() => {
                          const newSets = { ...editingWorkout.currentSets };
                          newSets.repsRange = { min: 8, max: 12 };
                          delete newSets.reps;
                          setEditingWorkout({ ...editingWorkout, currentSets: newSets });
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <label htmlFor="rep-range" className="text-sm text-gray-700">Rep Range</label>
                    </div>
                    
                    {editingWorkout.currentSets.repsRange && (
                      <div className="flex space-x-2 ml-6">
                        <input
                          type="number"
                          min="1"
                          max="50"
                          value={editingWorkout.currentSets.repsRange?.min || ''}
                          onChange={(e) => {
                            const newSets = { ...editingWorkout.currentSets };
                            newSets.repsRange = { 
                              ...newSets.repsRange!, 
                              min: parseInt(e.target.value) || 1 
                            };
                            setEditingWorkout({ ...editingWorkout, currentSets: newSets });
                          }}
                          className="input w-20"
                          placeholder="Min"
                        />
                        <span className="self-center">to</span>
                        <input
                          type="number"
                          min="1"
                          max="50"
                          value={editingWorkout.currentSets.repsRange?.max || ''}
                          onChange={(e) => {
                            const newSets = { ...editingWorkout.currentSets };
                            newSets.repsRange = { 
                              ...newSets.repsRange!, 
                              max: parseInt(e.target.value) || 1 
                            };
                            setEditingWorkout({ ...editingWorkout, currentSets: newSets });
                          }}
                          className="input w-20"
                          placeholder="Max"
                        />
                      </div>
                    )}
                  </div>
                </div>
                
                <div>
                  <label className="label">Weight ({getWeightUnit()})</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={editingWorkout.currentSets.weight || ''}
                    onChange={(e) => {
                      const newSets = { ...editingWorkout.currentSets };
                      newSets.weight = parseFloat(e.target.value) || 0;
                      setEditingWorkout({ ...editingWorkout, currentSets: newSets });
                    }}
                    className="input"
                    placeholder="Leave empty for bodyweight"
                  />
                </div>
                
                <div>
                  <label className="label">RPE (Rate of Perceived Exertion)</label>
                  <select
                    value={editingWorkout.currentSets.rpe || ''}
                    onChange={(e) => {
                      const newSets = { ...editingWorkout.currentSets };
                      newSets.rpe = e.target.value ? parseFloat(e.target.value) : undefined;
                      setEditingWorkout({ ...editingWorkout, currentSets: newSets });
                    }}
                    className="input"
                  >
                    <option value="">Not specified</option>
                    <option value="6">6 - Very light</option>
                    <option value="7">7 - Light</option>
                    <option value="8">8 - Moderate</option>
                    <option value="9">9 - Hard</option>
                    <option value="10">10 - Maximum effort</option>
                  </select>
                </div>
                
                <div>
                  <label className="label">Notes</label>
                  <textarea
                    value={editingWorkout.currentSets.notes || ''}
                    onChange={(e) => {
                      const newSets = { ...editingWorkout.currentSets };
                      newSets.notes = e.target.value;
                      setEditingWorkout({ ...editingWorkout, currentSets: newSets });
                    }}
                    className="input"
                    rows={3}
                    placeholder="Technique cues, tempo, etc."
                  />
                </div>
                
                <div className="flex space-x-3 pt-4 border-t">
                  <button
                    onClick={() => {
                      if (editingWorkout.weekIndex !== undefined && 
                          editingWorkout.dayIndex !== undefined && 
                          editingWorkout.exerciseIndex !== undefined) {
                        updateExercisePrescription(
                          editingWorkout.weekIndex,
                          editingWorkout.dayIndex,
                          editingWorkout.exerciseIndex,
                          editingWorkout.currentSets
                        );
                      }
                    }}
                    className="btn btn-primary flex-1"
                  >
                    Save Changes
                  </button>
                  <button
                    onClick={() => setEditingWorkout(null)}
                    className="btn btn-secondary flex-1"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
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
          allowCustom={true}
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
      
      {/* Edit Plan Name Modal */}
      {editingPlan && editingPlan.mode === 'rename' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                <Edit3 className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900">Rename Workout Plan</h3>
                <p className="text-sm text-gray-600">Update the plan name</p>
              </div>
            </div>
            
            <div className="mb-4">
              <label className="label">Plan Name</label>
              <input
                type="text"
                value={editedPlanName}
                onChange={(e) => setEditedPlanName(e.target.value)}
                className="input"
                placeholder="Enter plan name"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && editedPlanName.trim()) {
                    savePlanName();
                  } else if (e.key === 'Escape') {
                    setEditingPlan(null);
                    setEditedPlanName('');
                  }
                }}
              />
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setEditingPlan(null);
                  setEditedPlanName('');
                }}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={savePlanName}
                disabled={!editedPlanName.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save Name
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