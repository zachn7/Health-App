
import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Download } from 'lucide-react';
import { repositories } from '../db';
import ExercisePicker from '../components/ExercisePicker';

import type { WorkoutLog, ExerciseLogEntry, ExerciseDBItem, Profile, WorkoutPlan } from '../types';

interface CurrentWorkout {
  workoutPlanId?: string;
  exercises: {
    exerciseId: string;
    sets: {
      sets: number;
      reps?: number;
      repsRange?: { min: number; max: number };
      weight?: number;
      restTime?: number;
      notes?: string;
    };
  }[];
  notes?: string;
}

export default function WorkoutLogger() {
  const [currentWorkout, setCurrentWorkout] = useState<CurrentWorkout | null>(null);
  const [workoutLog, setWorkoutLog] = useState<WorkoutLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLogging, setIsLogging] = useState(false);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [exerciseEntries, setExerciseEntries] = useState<ExerciseLogEntry[]>([]);
  const [sessionNotes, setSessionNotes] = useState('');
  const [recentWorkouts, setRecentWorkouts] = useState<WorkoutLog[]>([]);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [manualWorkoutMode, setManualWorkoutMode] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [workoutPlans, setWorkoutPlans] = useState<WorkoutPlan[]>([]);
  const [showImportFromProgram, setShowImportFromProgram] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error' | null>(null);
  const autosaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadWorkoutData();
    loadProfile();
    loadWorkoutPlans();
  }, [selectedDate]);

  const loadWorkoutData = async () => {
    try {
      // Check for workout passed from Workouts page
      const storedWorkout = sessionStorage.getItem('currentWorkout');
      if (storedWorkout) {
        setCurrentWorkout(JSON.parse(storedWorkout));
        sessionStorage.removeItem('currentWorkout');
      }
      
      // Load workout for selected date
      const dateLog = await repositories.workout.getWorkoutLogByDate(selectedDate);
      setWorkoutLog(dateLog || null);
      
      // Load recent workouts
      const recent = await repositories.workout.getWorkoutLogs();
      setRecentWorkouts(recent.slice(0, 5));
      
      // Load exercises for names
      const exercisesResponse = await fetch('/src/assets/data/exercises.seed.json');
      const exercisesData = await exercisesResponse.json();
      
      // Initialize exercise entries if starting new workout
      if (currentWorkout && !dateLog) {
        const entries: ExerciseLogEntry[] = currentWorkout.exercises.map((ex) => {
          const exercise = exercisesData.find((e: any) => e.id === ex.exerciseId);
          return {
            exerciseId: ex.exerciseId,
            exerciseName: exercise?.name || `Exercise ${ex.exerciseId}`,
            sets: []
          };
        });
        setExerciseEntries(entries);
      } else if (dateLog) {
        setExerciseEntries(dateLog.entries);
        setSessionNotes(dateLog.sessionNotes || '');
        setIsLogging(true);
      }
    } catch (error) {
      console.error('Failed to load workout data:', error);
    } finally {
      setLoading(false);
    }
  };

  const startWorkout = () => {
    setIsLogging(true);
    setStartTime(new Date());
  };

  const addSet = (exerciseIndex: number) => {
    const newSet = {
      set: (exerciseEntries[exerciseIndex].sets.length + 1),
      reps: 0,
      weight: undefined
    };
    
    const updatedEntries = [...exerciseEntries];
    updatedEntries[exerciseIndex].sets.push(newSet);
    setExerciseEntries(updatedEntries);
  };

  const autosaveWorkout = async () => {
    if (!exerciseEntries.length || !exerciseEntries.some(entry => entry.sets.length > 0)) {
      return; // Don't save empty workouts
    }
    
    setSaveStatus('saving');
    
    try {
      const duration = startTime ? Math.round((new Date().getTime() - startTime.getTime()) / 1000 / 60) : 0;
      
      const log: WorkoutLog = {
        id: workoutLog?.id || crypto.randomUUID(),
        date: selectedDate, // Use selected date, not today
        workoutPlanId: currentWorkout?.workoutPlanId,
        entries: exerciseEntries.filter(entry => entry.sets.length > 0),
        cardioEntries: [],
        sessionNotes: sessionNotes,
        duration: duration,
        createdAt: workoutLog?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      if (workoutLog) {
        // Update existing log
        await repositories.workout.updateWorkoutLog(workoutLog.id, log);
        setWorkoutLog(log);
      } else {
        // Create new log
        await repositories.workout.createWorkoutLog(log);
        setWorkoutLog(log);
      }
      
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(null), 2000); // Clear saved status after 2 seconds
    } catch (error) {
      console.error('Failed to autosave workout:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };
  
  const updateSet = (exerciseIndex: number, setIndex: number, field: 'reps' | 'weight', value: number | undefined) => {
    const updatedEntries = [...exerciseEntries];
    if (field === 'reps') {
      updatedEntries[exerciseIndex].sets[setIndex].reps = value || 0;
    } else {
      updatedEntries[exerciseIndex].sets[setIndex].weight = value;
    }
    setExerciseEntries(updatedEntries);
    
    // Trigger autosave with debounce
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
    }
    autosaveTimeoutRef.current = setTimeout(autosaveWorkout, 2000); // 2 second debounce
  };

  const removeSet = (exerciseIndex: number, setIndex: number) => {
    const updatedEntries = [...exerciseEntries];
    updatedEntries[exerciseIndex].sets.splice(setIndex, 1);
    // Renumber the remaining sets
    updatedEntries[exerciseIndex].sets.forEach((set, idx) => {
      set.set = idx + 1;
    });
    setExerciseEntries(updatedEntries);
    
    // Trigger autosave with debounce
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
    }
    autosaveTimeoutRef.current = setTimeout(autosaveWorkout, 2000);
  };

  const finishWorkout = async () => {
    try {
      await autosaveWorkout(); // Save final state
      setIsLogging(false);
      
      // Show success message
      const successDiv = document.createElement('div');
      successDiv.className = 'fixed top-4 right-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg z-50';
      successDiv.innerHTML = '✓ Workout logged successfully! Great job! 💪';
      document.body.appendChild(successDiv);
      setTimeout(() => document.body.removeChild(successDiv), 3000);
      
      // Reload recent workouts
      const updated = await repositories.workout.getWorkoutLogs();
      setRecentWorkouts(updated.slice(0, 5));
    } catch (error) {
      console.error('Failed to finish workout:', error);
      alert('Failed to finish workout. Please try again.');
    }
  };

  const loadProfile = async () => {
    try {
      const userProfile = await repositories.profile.get();
      setProfile(userProfile || null);
    } catch (error) {
      console.error('Failed to load profile:', error);
    }
  };

  const loadWorkoutPlans = async () => {
    try {
      const plans = await repositories.workout.getWorkoutPlans();
      setWorkoutPlans(plans);
    } catch (error) {
      console.error('Failed to load workout plans:', error);
    }
  };

  const navigateDate = (direction: 'prev' | 'next' | 'today') => {
    if (direction === 'today') {
      setSelectedDate(new Date().toISOString().split('T')[0]);
    } else {
      const date = new Date(selectedDate);
      if (direction === 'prev') {
        date.setDate(date.getDate() - 1);
      } else {
        date.setDate(date.getDate() + 1);
      }
      setSelectedDate(date.toISOString().split('T')[0]);
    }
  };

  const importFromProgram = async (plan: WorkoutPlan, weekIndex: number = 0, dayIndex: number = 0) => {
    try {
      if (!plan.weeks || plan.weeks.length === 0) {
        throw new Error('No weeks found in this workout plan');
      }

      const currentWeek = plan.weeks[weekIndex];
      if (!currentWeek || !currentWeek.workouts) {
        throw new Error('No workouts found in this week of the program');
      }

      const workout = currentWeek.workouts[dayIndex];
      if (!workout) {
        throw new Error('No workout found for this day in the program');
      }

      // Load exercises for names
      const exercisesResponse = await fetch('/src/assets/data/exercises.seed.json');
      const exercisesData = await exercisesResponse.json();
      
      const entries: ExerciseLogEntry[] = workout.exercises.map((ex: any) => {
        const exercise = exercisesData.find((e: any) => e.id === ex.exerciseId);
        return {
          exerciseId: ex.exerciseId,
          exerciseName: exercise?.name || `Exercise ${ex.exerciseId}`,
          sets: []
        };
      });
      
      setExerciseEntries(entries);
      setCurrentWorkout({
        workoutPlanId: plan.id,
        exercises: workout.exercises,
        notes: workout.notes
      });
      setShowImportFromProgram(false);
      setManualWorkoutMode(false);
      setIsLogging(true); // Start logging mode
      setStartTime(new Date()); // Start the timer
      
      // Clear any existing workout log for this date first
      const existingLog = await repositories.workout.getWorkoutLogByDate(selectedDate);
      if (existingLog) {
        await repositories.workout.deleteWorkoutLog(existingLog.id);
      }
      
      // Show success message
      const successDiv = document.createElement('div');
      successDiv.className = 'fixed top-4 right-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg z-50';
      successDiv.innerHTML = `✓ Imported workout: ${workout.day}`;
      document.body.appendChild(successDiv);
      setTimeout(() => document.body.removeChild(successDiv), 3000);
      
    } catch (error) {
      console.error('Failed to import exercises:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to import exercises from program';
      
      // Show error in UI instead of alert
      const errorDiv = document.createElement('div');
      errorDiv.className = 'fixed top-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg z-50';
      errorDiv.innerHTML = `✗ ${errorMessage}`;
      document.body.appendChild(errorDiv);
      setTimeout(() => document.body.removeChild(errorDiv), 5000);
    }
  };

  const getWorkoutDuration = () => {
    if (!startTime) return '0:00';
    const elapsed = Math.round((new Date().getTime() - startTime.getTime()) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getWeightUnit = (): string => {
    return profile?.preferredUnits === 'imperial' ? 'lb' : 'kg';
  };

  const handleAddExerciseManually = () => {
    setShowExercisePicker(true);
  };

  const navigateToLog = (log: WorkoutLog) => {
    // Load the selected log's date and data
    setSelectedDate(log.date);
    
    // Load the workout data for that date
    loadWorkoutDataForDate(log.date);
  };
  
  const loadWorkoutDataForDate = async (date: string) => {
    try {
      const dateLog = await repositories.workout.getWorkoutLogByDate(date);
      setWorkoutLog(dateLog || null);
      
      if (dateLog) {
        setExerciseEntries(dateLog.entries);
        setSessionNotes(dateLog.sessionNotes || '');
        setIsLogging(true);
        setCurrentWorkout(null);
        setManualWorkoutMode(false);
      } else {
        setExerciseEntries([]);
        setSessionNotes('');
        setIsLogging(false);
        setCurrentWorkout(null);
        setManualWorkoutMode(false);
      }
    } catch (error) {
      console.error('Failed to load workout data for date:', date, error);
    }
  };
  
  const handleSelectExercise = (exercise: ExerciseDBItem) => {
    const newEntry: ExerciseLogEntry = {
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      sets: []
    };
    
    setExerciseEntries(prev => [...prev, newEntry]);
    setManualWorkoutMode(true);
  };

  const handleRemoveExercise = (exerciseIndex: number) => {
    const updatedEntries = exerciseEntries.filter((_, index) => index !== exerciseIndex);
    setExerciseEntries(updatedEntries);
    
    // If no exercises left, exit manual mode
    if (updatedEntries.length === 0) {
      setManualWorkoutMode(false);
      setIsLogging(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">Loading workout logger...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Workout Logger</h1>
            <p className="mt-2 text-gray-600">Record your training sessions</p>
          </div>
          
          {/* Save Status Indicator */}
          {saveStatus && (
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
              saveStatus === 'saved' ? 'bg-green-100 text-green-800' :
              saveStatus === 'saving' ? 'bg-blue-100 text-blue-800' :
              'bg-red-100 text-red-800'
            }`}>
              {saveStatus === 'saved' ? '✓ Saved' :
               saveStatus === 'saving' ? 'Saving...' :
               '✗ Error'}
            </div>
          )}
        </div>
      </div>
      
      {/* Date Navigation */}
      <div className="flex items-center justify-center mb-6 space-x-4">
        <button
          onClick={() => navigateDate('prev')}
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
            {new Date(selectedDate).toLocaleDateString('en-US', { 
              weekday: 'short', 
              month: 'short', 
              day: 'numeric' 
            })}
          </span>
          {selectedDate === new Date().toISOString().split('T')[0] && (
            <span className="text-xs text-blue-600 font-medium">Today</span>
          )}
        </button>
        
        <button
          onClick={() => navigateDate('next')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          disabled={selectedDate >= new Date().toISOString().split('T')[0]}
        >
          <ChevronRight className="w-5 h-5" />
        </button>
        
        <button
          onClick={() => navigateDate('today')}
          className="px-3 py-1 text-sm bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg transition-colors"
        >
          Today
        </button>
      </div>
      
      {showDatePicker && (
        <div className="mb-6 text-center">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => {
              setSelectedDate(e.target.value);
              setShowDatePicker(false);
            }}
            max={new Date().toISOString().split('T')[0]}
            className="input w-auto mx-auto"
          />
        </div>
      )}
      
      {/* Import and Manual Controls */}
      <div className="mb-6 flex flex-wrap gap-3">
        <button
          onClick={() => setShowImportFromProgram(!showImportFromProgram)}
          className="btn btn-secondary"
        >
          <Download className="w-4 h-4 mr-1" />
          Import from Program
        </button>
        
        <button
          onClick={() => {
            setManualWorkoutMode(true);
            setCurrentWorkout(null);
            setExerciseEntries([]);
          }}
          className="btn btn-outline-secondary"
        >
          Manual Workout
        </button>
        
        {showImportFromProgram && (
          <div className="card mt-4">
            <h3 className="text-lg font-medium text-gray-900 mb-3">Import from Workout Program</h3>
            
            {workoutPlans.length === 0 ? (
              <p className="text-gray-600">No workout programs found. Create one first!</p>
            ) : (
              <div className="space-y-3">
                {workoutPlans.map((plan) => (
                  <div key={plan.id} className="border border-gray-200 rounded-lg p-3">
                    <div className="font-medium">{plan.name}</div>
                    <div className="text-sm text-gray-600 mb-2">{plan.weeks.length} weeks</div>
                    
                    {plan.weeks.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {plan.weeks[0].workouts.map((workout, index) => (
                          <button
                            key={index}
                            onClick={() => importFromProgram(plan, 0, index)}
                            className="btn btn-sm btn-primary"
                          >
                            {workout.day || `Day ${index + 1}`}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            
            <button
              onClick={() => setShowImportFromProgram(false)}
              className="mt-4 btn btn-secondary"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
      
      {/* Today's Workout Status */}
      {workoutLog ? (
        <div className="card mb-6 bg-green-50 border-green-200">
          <h2 className="text-lg font-medium text-green-900 mb-2">Workout Complete! ✅</h2>
          <div className="text-green-700">
            <p>Duration: {workoutLog.duration} minutes</p>
            <p>Exercises: {workoutLog.entries.length}</p>
            <p>Total Sets: {workoutLog.entries.reduce((sum, entry) => sum + entry.sets.length, 0)}</p>
          </div>
        </div>
      ) : (isLogging || manualWorkoutMode) ? (
        <div className="card mb-6 bg-blue-50 border-blue-200">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-medium text-blue-900">
                {manualWorkoutMode ? 'Manual Workout' : 'Workout in Progress'}
              </h2>
              <p className="text-blue-700">
                {manualWorkoutMode ? `${exerciseEntries.length} exercises added` : `Duration: ${getWorkoutDuration()}`}
              </p>
            </div>
            <div className="flex gap-2">
              {manualWorkoutMode && !isLogging && exerciseEntries.length > 0 && (
                <button
                  onClick={startWorkout}
                  className="btn btn-primary"
                >
                  Start Logging
                </button>
              )}
              <button
                onClick={finishWorkout}
                className="btn btn-success"
              >
                Finish Workout
              </button>
            </div>
          </div>
        </div>
      ) : currentWorkout ? (
        <div className="card mb-6">
          <h2 className="text-lg font-medium text-gray-900 mb-2">Ready to Start</h2>
          <p className="text-gray-600 mb-4">
            {currentWorkout.exercises.length} exercises loaded
          </p>
          <button
            onClick={startWorkout}
            className="btn btn-primary"
          >
            Start Workout
          </button>
        </div>
      ) : (
        <div className="card mb-6">
          <h2 className="text-lg font-medium text-gray-900 mb-2">Choose Your Workout</h2>
          <p className="text-gray-600 mb-4">
            Select a pre-made workout or log exercises manually
          </p>
          <div className="flex gap-4">
            <button
              onClick={() => window.location.hash = '/workouts'}
              className="btn btn-primary"
            >
              Browse Workouts
            </button>
            <button
              onClick={handleAddExerciseManually}
              className="btn btn-secondary"
            >
              Log Exercises Manually
            </button>
          </div>
        </div>
      )}
      
      {/* Workout Logging Interface */}
      {(isLogging || manualWorkoutMode) && exerciseEntries.map((exercise, exerciseIndex) => (
        <div key={exercise.exerciseId} className="card mb-4">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-lg font-medium text-gray-900">{exercise.exerciseName}</h3>
            {manualWorkoutMode && (
              <button
                onClick={() => handleRemoveExercise(exerciseIndex)}
                className="text-red-500 hover:text-red-700 text-sm"
                title="Remove exercise"
              >
                Remove
              </button>
            )}
          </div>
          
          {exercise.sets.length > 0 ? (
            <div className="mb-4">
              <div className="grid grid-cols-12 gap-2 text-sm font-medium text-gray-600 mb-2">
                <div className="col-span-2">Set</div>
                <div className="col-span-4">Reps</div>
                <div className="col-span-4">Weight ({getWeightUnit()})</div>
                <div className="col-span-2">Actions</div>
              </div>
              
              {exercise.sets.map((set, setIndex) => {
                return (
                  <div key={setIndex} className="grid grid-cols-12 gap-2 mb-2">
                    <div className="col-span-2 flex items-center">{set.set}</div>
                    <div className="col-span-4">
                      <input
                        type="number"
                        value={set.reps || ''}
                        onChange={(e) => updateSet(exerciseIndex, setIndex, 'reps', parseInt(e.target.value) || 0)}
                        className="input text-sm"
                        min="0"
                        max="100"
                      />
                    </div>
                    <div className="col-span-4">
                      <input
                        type="number"
                        value={set.weight || ''}
                        onChange={(e) => updateSet(exerciseIndex, setIndex, 'weight', parseFloat(e.target.value) || undefined)}
                        className="input text-sm"
                        min="0"
                        max="1000"
                        step="0.5"
                      />
                    </div>
                    <div className="col-span-2">
                      <button
                        onClick={() => removeSet(exerciseIndex, setIndex)}
                        className="btn btn-danger text-xs py-1"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
              
              <div className="mt-3 pt-3 border-t">
                <button
                  onClick={() => addSet(exerciseIndex)}
                  className="btn btn-secondary text-sm"
                >
                  Add Set
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <button
                onClick={() => addSet(exerciseIndex)}
                className="btn btn-primary"
              >
                Add First Set
              </button>
            </div>
          )}
        </div>
      ))}
      
      {/* Add Exercise Button (Manual Mode) */}
      {manualWorkoutMode && (
        <div className="card mb-6">
          <button
            onClick={handleAddExerciseManually}
            className="btn btn-secondary"
          >
            Add Another Exercise
          </button>
        </div>
      )}
      
      {/* Session Notes */}
      {(isLogging || manualWorkoutMode) && (
        <div className="card mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Session Notes (Optional)</h3>
          <textarea
            value={sessionNotes}
            onChange={(e) => {
              setSessionNotes(e.target.value);
              
              // Trigger autosave with debounce
              if (autosaveTimeoutRef.current) {
                clearTimeout(autosaveTimeoutRef.current);
              }
              autosaveTimeoutRef.current = setTimeout(autosaveWorkout, 2000);
            }}
            className="input"
            rows={3}
            placeholder="How did the workout feel? Any notes for next time..."
          />
        </div>
      )}
      
      {/* Recent Workouts */}
      {recentWorkouts.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Recent Workouts</h2>
          
          <div className="space-y-3">
            {recentWorkouts.map((log) => (
              <button
                key={log.id}
                onClick={() => navigateToLog(log)}
                className="flex justify-between items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-left w-full"
              >
                <div>
                  <div className="font-medium">{new Date(log.date).toLocaleDateString()}</div>
                  <div className="text-sm text-gray-600">
                    {log.entries.length} exercises • {log.entries.reduce((sum, entry) => sum + entry.sets.length, 0)} sets • {log.duration} minutes
                  </div>
                </div>
                <div className="text-sm text-gray-500">
                  {new Date(log.createdAt).toLocaleTimeString()}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
      
      {/* Exercise Picker Modal */}
      {showExercisePicker && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <ExercisePicker
              onSelect={handleSelectExercise}
              onClose={() => setShowExercisePicker(false)}
              excludeIds={exerciseEntries.map(ex => ex.exerciseId)}
            />
          </div>
        </div>
      )}
    </div>
  );
}