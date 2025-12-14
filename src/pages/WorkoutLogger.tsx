
import { useState, useEffect } from 'react';
import { repositories } from '../db';
import type { WorkoutLog, ExerciseLogEntry } from '../types';

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

  useEffect(() => {
    loadWorkoutData();
  }, []);

  const loadWorkoutData = async () => {
    try {
      // Check for workout passed from Workouts page
      const storedWorkout = sessionStorage.getItem('currentWorkout');
      if (storedWorkout) {
        setCurrentWorkout(JSON.parse(storedWorkout));
        sessionStorage.removeItem('currentWorkout');
      }
      
      // Load today's workout if exists
      const today = new Date().toISOString().split('T')[0];
      const todayLog = await repositories.workout.getWorkoutLog(today);
      setWorkoutLog(todayLog || null);
      
      // Load recent workouts
      const recent = await repositories.workout.getWorkoutLogs();
      setRecentWorkouts(recent.slice(0, 5));
      
      // Load exercises for names
      const exercisesResponse = await fetch('/src/assets/data/exercises.seed.json');
      const exercisesData = await exercisesResponse.json();
      
      // Initialize exercise entries if starting new workout
      if (currentWorkout && !todayLog) {
        const entries: ExerciseLogEntry[] = currentWorkout.exercises.map((ex) => {
          const exercise = exercisesData.find((e: any) => e.id === ex.exerciseId);
          return {
            exerciseId: ex.exerciseId,
            exerciseName: exercise?.name || `Exercise ${ex.exerciseId}`,
            sets: []
          };
        });
        setExerciseEntries(entries);
      } else if (todayLog) {
        setExerciseEntries(todayLog.entries);
        setSessionNotes(todayLog.sessionNotes || '');
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

  const updateSet = (exerciseIndex: number, setIndex: number, field: 'reps' | 'weight', value: number | undefined) => {
    const updatedEntries = [...exerciseEntries];
    if (field === 'reps') {
      updatedEntries[exerciseIndex].sets[setIndex].reps = value || 0;
    } else {
      updatedEntries[exerciseIndex].sets[setIndex].weight = value;
    }
    setExerciseEntries(updatedEntries);
  };

  const removeSet = (exerciseIndex: number, setIndex: number) => {
    const updatedEntries = [...exerciseEntries];
    updatedEntries[exerciseIndex].sets.splice(setIndex, 1);
    // Renumber the remaining sets
    updatedEntries[exerciseIndex].sets.forEach((set, idx) => {
      set.set = idx + 1;
    });
    setExerciseEntries(updatedEntries);
  };

  const finishWorkout = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const duration = startTime ? Math.round((new Date().getTime() - startTime.getTime()) / 1000 / 60) : 0;
      
      const log: WorkoutLog = {
        id: crypto.randomUUID(),
        date: today,
        workoutPlanId: currentWorkout?.workoutPlanId,
        entries: exerciseEntries.filter(entry => entry.sets.length > 0),
        cardioEntries: [],
        sessionNotes: sessionNotes,
        duration: duration,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await repositories.workout.createWorkoutLog(log);
      setWorkoutLog(log);
      setIsLogging(false);
      alert('Workout logged successfully! Great job! 💪');
      
      // Reload recent workouts
      const updated = await repositories.workout.getWorkoutLogs();
      setRecentWorkouts(updated.slice(0, 5));
    } catch (error) {
      console.error('Failed to save workout log:', error);
      alert('Failed to save workout log. Please try again.');
    }
  };

  const getWorkoutDuration = () => {
    if (!startTime) return '0:00';
    const elapsed = Math.round((new Date().getTime() - startTime.getTime()) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
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
        <h1 className="text-3xl font-bold text-gray-900">Workout Logger</h1>
        <p className="mt-2 text-gray-600">Record your training sessions</p>
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
      ) : isLogging ? (
        <div className="card mb-6 bg-blue-50 border-blue-200">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-medium text-blue-900">Workout in Progress</h2>
              <p className="text-blue-700">Duration: {getWorkoutDuration()}</p>
            </div>
            <button
              onClick={finishWorkout}
              className="btn btn-success"
            >
              Finish Workout
            </button>
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
          <h2 className="text-lg font-medium text-gray-900 mb-2">No Workout Selected</h2>
          <p className="text-gray-600 mb-4">
            Select a workout from the Workouts page to start logging
          </p>
          <button
            onClick={() => window.location.hash = '/workouts'}
            className="btn btn-primary"
          >
            Go to Workouts
          </button>
        </div>
      )}
      
      {/* Workout Logging Interface */}
      {isLogging && exerciseEntries.map((exercise, exerciseIndex) => (
        <div key={exercise.exerciseId} className="card mb-4">
          <h3 className="text-lg font-medium text-gray-900 mb-4">{exercise.exerciseName}</h3>
          
          {exercise.sets.length > 0 ? (
            <div className="mb-4">
              <div className="grid grid-cols-12 gap-2 text-sm font-medium text-gray-600 mb-2">
                <div className="col-span-2">Set</div>
                <div className="col-span-3">Reps</div>
                <div className="col-span-3">Weight (kg)</div>
                <div className="col-span-2">Volume</div>
                <div className="col-span-2">Actions</div>
              </div>
              
              {exercise.sets.map((set, setIndex) => {
                const volume = (set.weight || 0) * (set.reps || 0);
                return (
                  <div key={setIndex} className="grid grid-cols-12 gap-2 mb-2">
                    <div className="col-span-2 flex items-center">{set.set}</div>
                    <div className="col-span-3">
                      <input
                        type="number"
                        value={set.reps || ''}
                        onChange={(e) => updateSet(exerciseIndex, setIndex, 'reps', parseInt(e.target.value) || 0)}
                        className="input text-sm"
                        min="0"
                        max="100"
                      />
                    </div>
                    <div className="col-span-3">
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
                    <div className="col-span-2 flex items-center text-sm">{volume} kg</div>
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
                <span className="ml-4 text-sm text-gray-600">
                  Total Volume: {exercise.sets.reduce((sum, set) => sum + ((set.weight || 0) * (set.reps || 0)), 0)} kg
                </span>
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
      
      {/* Session Notes */}
      {isLogging && (
        <div className="card mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Session Notes (Optional)</h3>
          <textarea
            value={sessionNotes}
            onChange={(e) => setSessionNotes(e.target.value)}
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
              <div key={log.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <div>
                  <div className="font-medium">{new Date(log.date).toLocaleDateString()}</div>
                  <div className="text-sm text-gray-600">
                    {log.entries.length} exercises • {log.duration} minutes
                  </div>
                  <div className="text-sm text-gray-600">
                    {log.entries.reduce((sum, entry) => sum + entry.sets.length, 0)} sets • 
                    {log.entries.reduce((sum, entry) => 
                      sum + entry.sets.reduce((setSum, set) => setSum + ((set.weight || 0) * (set.reps || 0)), 0), 0
                    )} kg total volume
                  </div>
                </div>
                <div className="text-sm text-gray-500">
                  {new Date(log.createdAt).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}