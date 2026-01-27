import { useState, useEffect } from 'react';
import { repositories, db } from '../db';
import { ExerciseDBService } from '../lib/exercise-db';
import { formatWeight } from '../lib/unit-conversions';
import { safeJSONStringify, CurrentWorkoutSchema } from '../lib/schemas';
import { testIds } from '../testIds';
import { workoutPresets } from '../data/presetWorkouts';
import type { WorkoutPreset } from '../types';
import { resolveWorkoutDay } from '../lib/preset-slot-resolver';
import { Edit3, Plus, RefreshCw, Trash2, X, AlertCircle, ArrowLeftRight, Sliders, User, Settings, Sparkles, Search, Filter, XCircle, Download, AlertTriangle } from 'lucide-react';
import ExercisePicker from '../components/ExercisePicker';
import type { WorkoutPlan, ExerciseDBItem, Profile, GeneratorOptions, ExperienceLevel, GoalType } from '../types';

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
  const [activeTab, setActiveTab] = useState<'myPrograms' | 'presets'>('myPrograms');
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
  const [weekCarouselStart, setWeekCarouselStart] = useState(0);
  const VISIBLE_WEEKS = 5;

  // Preset state
  const [presetSearch, setPresetSearch] = useState('');
  const [presetFilterTags, setPresetFilterTags] = useState<string[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<WorkoutPreset | null>(null);
  const [showPresetPreview, setShowPresetPreview] = useState(false);
  const [importingPreset, setImportingPreset] = useState(false);
  const [importWarning, setImportWarning] = useState<string | null>(null);
  const [showPresetFilters, setShowPresetFilters] = useState(() => {
    const saved = localStorage.getItem('presets.workouts.filtersOpen');
    return saved === 'true';
  });

  const [editingWorkout, setEditingWorkout] = useState<EditingWorkout | null>(null);
  const [swapTarget, setSwapTarget] = useState<{ weekIndex: number; dayIndex: number; exerciseIndex: number } | null>(null);
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
  const [showGeneratorMode, setShowGeneratorMode] = useState(false);
  const [generatorMode, setGeneratorMode] = useState<'profile' | 'custom'>('profile');
  const [customOptions, setCustomOptions] = useState<GeneratorOptions>({
    mode: 'custom',
    goalType: 'general_fitness' as GoalType,
    daysPerWeek: 3,
    experienceLevel: 'beginner' as ExperienceLevel,
    equipment: ['bodyweight', 'dumbbells']
  });

  useEffect(() => {
    loadWorkoutData();
    loadProfile();
  }, []);

  // Persist preset filters open/closed state
  useEffect(() => {
    localStorage.setItem('presets.workouts.filtersOpen', String(showPresetFilters));
  }, [showPresetFilters]);

  const loadProfile = async () => {
    try {
      const userProfile = await repositories.profile.get();
      setProfile(userProfile || null);
      
      // Pre-fill custom options from profile
      if (userProfile) {
        const primaryGoal = userProfile.goals.find(g => g.isPrimary) || userProfile.goals[0];
        setCustomOptions({
          mode: 'custom',
          goalType: primaryGoal?.type || 'general_fitness',
          daysPerWeek: Object.values(userProfile.schedule).filter(Boolean).length,
          experienceLevel: userProfile.experienceLevel,
          equipment: userProfile.equipment || ['bodyweight']
        });
      }
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
    
    // Check if plan exists in database before updating
    try {
      const existingPlan = await repositories.workout.getWorkoutPlan(selectedPlan.id);
      if (!existingPlan) {
        throw new Error(`Workout plan not found: ${selectedPlan.id}`);
      }
    } catch (error) {
      console.error('Error checking plan existence before update:', error);
      throw error;
    }
    
    const updatedPlan = { ...selectedPlan };
    const workout = updatedPlan.weeks[weekIndex]?.workouts[dayIndex];
    
    if (!workout) return;
    
    const exerciseIndex = workout.exercises.findIndex(ex => ex.exerciseId === oldExerciseId);
    if (exerciseIndex !== -1) {
      workout.exercises[exerciseIndex] = {
        ...workout.exercises[exerciseIndex],
        exerciseId: newExerciseId
      };
      
      updatedPlan.updatedAt = new Date().toISOString();
      
      await repositories.workout.updateWorkoutPlan(updatedPlan.id, updatedPlan);
      
      // Update state
      setWorkoutPlans(prev => 
        prev.map(plan => plan.id === updatedPlan.id ? updatedPlan : plan)
      );
      setSelectedPlan(updatedPlan);
      
      // Load new exercise data
      await loadExerciseData([newExerciseId]);
    }
  };

  const replaceExerciseByIndex = async (weekIndex: number, dayIndex: number, exerciseIndex: number, newExerciseId: string) => {
    if (!selectedPlan) return;
    
    try {
      const updatedPlan = { ...selectedPlan };
      const workout = updatedPlan.weeks[weekIndex]?.workouts[dayIndex];
      
      if (!workout || !workout.exercises[exerciseIndex]) return;
      
      // Replace the exercise at the specific index (preserving sets/reps/weight)
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
    } catch (error) {
      console.error('Failed to replace exercise by index:', error);
      alert('Failed to replace exercise');
    }
  };
  
  const substituteExercise = async (weekIndex: number, dayIndex: number, exerciseIndex: number, exerciseId: string) => {
    if (!selectedPlan) return;
    
    // Clear any previous error/success state BEFORE starting substitution
    setSubstituteError(null);
    setSubstituteSuccess(null);
    
    // Force state flush to ensure error is cleared before async operations
    await new Promise(resolve => setTimeout(resolve, 100));
    
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
      
      // Ensure error is cleared after successful replacement
      setSubstituteError(null);
      
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

  const handleImportPreset = async (preset: WorkoutPreset) => {
    try {
      setImportingPreset(true);
      setImportWarning(null);
      
      // Resolve all workout days from the preset
      const weeks: any[] = [];
      let totalUnresolved = 0;
      
      // Create a single week (most presets are weekly)
      const week = preset.durationWeeks;
      for (let i = 0; i < week; i++) {
        const workouts: any[] = [];
        
        for (let dayIndex = 0; dayIndex < preset.days.length; dayIndex++) {
          const presetDay = preset.days[dayIndex];
          
          // Resolve exercises for this day
          const { resolved, unresolvedCount } = await resolveWorkoutDay(
            preset.id,
            dayIndex,
            presetDay.slots,
            preset.equipment
          );
          
          totalUnresolved += unresolvedCount;
          
          // Convert resolved exercises to plan format using the same order as slots
          const exercises = resolved.map((resolvedExercise, idx) => {
            const slot = presetDay.slots[idx];
            return {
              exerciseId: resolvedExercise.exerciseId,
              sets: {
                sets: slot.sets || 3,
                repsRange: resolvedExercise.unresolved
                  ? { min: 8, max: 12 }
                  : typeof slot.reps === 'object'
                    ? slot.reps
                    : undefined,
                reps: typeof slot.reps === 'number'
                  ? slot.reps
                  : undefined,
                restTime: slot.restSeconds,
                notes: resolvedExercise.unresolved ? 'Please swap this with a real exercise' : undefined,
              },
            };
          });
          
          workouts.push({
            day: presetDay.name,
            exercises,
            notes: presetDay.focus,
          });
        }
        
        weeks.push({
          week: i + 1,
          workouts,
        });
      }
      
      // Create the workout plan
      const newPlan: WorkoutPlan = {
        id: crypto.randomUUID(),
        name: preset.title,
        weeks,
        generatedBy: 'manual',
        notes: `Imported from preset: ${preset.title}\n${preset.summary}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      // Save to database
      const savedPlan = await repositories.workout.createWorkoutPlan(newPlan);
      
      // Refresh workout plans
      loadWorkoutData();
      
      // Show warning if there were unresolved exercises
      if (totalUnresolved > 0) {
        setImportWarning(`${totalUnresolved} exercise(s) could not be auto-matched. You'll need to swap them manually.`);
      }
      
      // Switch to My Programs and select the imported plan
      setActiveTab('myPrograms');
      setSelectedPlan(savedPlan);
    } catch (error) {
      console.error('Failed to import preset:', error);
      alert('Failed to import preset. Please try again.');
    } finally {
      setImportingPreset(false);
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
      // Check profile exists (required even for custom mode)
      const baseProfile = await repositories.profile.get();
      if (!baseProfile) {
        alert('Please create a profile first!');
        return;
      }
      
      setGenerating(true);
      setGenerationError(null);
      setShowGeneratorMode(false);

      console.log(`Starting workout plan generation for mode: ${generatorMode}`);
      
      // Initialize exercise DB first to ensure data is loaded
      await ExerciseDBService.initialize();
      
      // Verify exercises are available
      const exerciseCount = await db.table('exercises').count();
      console.log(`Exercise database has ${exerciseCount} exercises`);
      
      if (exerciseCount === 0) {
        throw new Error('Exercise database is empty. Please reload the page and try again.');
      }

      const { generateWorkoutPlan: coachEngineGenerate } = await import('../lib/coach-engine');
      
      // Use deterministic seed: hash of timestamp to ensure variety
      const seed = Date.now() + Math.floor(Math.random() * 10000);
      
      // Build profile for generation based on mode
      let generationProfile: Profile;
      let generationGoalId: string | undefined;
      
      if (generatorMode === 'profile') {
        // Use actual profile as-is
        generationProfile = baseProfile;
        const primaryGoal = baseProfile.goals.find(g => g.isPrimary) || baseProfile.goals[0];
        generationGoalId = primaryGoal?.id;
      } else {
        // Custom mode: build a profile with custom options
        // Create a goal object for the custom goal type
        const customGoalId = `custom-${Date.now()}`;
        const customGoal = {
          id: customGoalId,
          type: customOptions.goalType,
          targetDate: undefined,
          priority: 1,
          isPrimary: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        // Build schedule based on daysPerWeek
        const days: ('monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday')[] = 
          ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        const schedule = days.reduce((acc, day, idx) => {
          acc[day] = idx < customOptions.daysPerWeek;
          return acc;
        }, {} as any);
        
        generationProfile = {
          ...baseProfile,
          goals: [customGoal],
          experienceLevel: customOptions.experienceLevel,
          equipment: customOptions.equipment,
          schedule: schedule
        };
        generationGoalId = customGoalId;
      }
      
      const plan = await coachEngineGenerate(generationProfile, generationGoalId, seed);
      
      // Verify plan has exercises
      const totalExercises = plan.weeks.reduce((sum, week) => 
        sum + week.workouts.reduce((weekSum, workout) => 
          weekSum + workout.exercises.length, 0), 0);
      
      console.log(`Generated plan with ${totalExercises} exercises across ${plan.weeks.length} weeks`);
      
      if (totalExercises === 0) {
        throw new Error('Generated plan has no exercises. Please try again or check your profile settings.');
      }
      
      // Save the plan to the database
      await repositories.workout.createWorkoutPlan(plan);
      
      // Reload the plan from the database to ensure we have the persisted data
      const persistedPlan = await repositories.workout.getWorkoutPlan(plan.id);
      if (persistedPlan) {
        setWorkoutPlans([persistedPlan, ...workoutPlans]);
        console.log('Workout plan generated successfully');
      } else {
        console.error('Failed to reload plan from database after creation for ID:', plan.id);
        // Fallback: use the generated plan if reload fails
        setWorkoutPlans([plan, ...workoutPlans]);
      }
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

  const toggleDayCompletion = async (plan: WorkoutPlan, weekIndex: number, dayIndex: number) => {
    if (!plan) return;
    
    try {
      const updatedPlan = { ...plan };
      
      // Initialize completedDays array if it doesn't exist
      if (!updatedPlan.completedDays) {
        updatedPlan.completedDays = [];
      }
      
      // Calculate global day index across all weeks
      let dayGlobalIndex = 0;
      for (let i = 0; i < weekIndex; i++) {
        dayGlobalIndex += updatedPlan.weeks[i].workouts.length;
      }
      dayGlobalIndex += dayIndex;
      
      // Toggle completion
      const completedIndex = updatedPlan.completedDays.indexOf(dayGlobalIndex);
      if (completedIndex === -1) {
        updatedPlan.completedDays.push(dayGlobalIndex);
      } else {
        updatedPlan.completedDays.splice(completedIndex, 1);
      }
      
      updatedPlan.updatedAt = new Date().toISOString();
      await repositories.workout.updateWorkoutPlan(updatedPlan.id, updatedPlan);
      
      setWorkoutPlans(prev => 
        prev.map(p => p.id === updatedPlan.id ? updatedPlan : p)
      );
      setSelectedPlan(updatedPlan);
    } catch (error) {
      console.error('Failed to toggle day completion:', error);
      alert('Failed to update completion status.');
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

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('myPrograms')}
            data-testid={testIds.workouts.myProgramsTab}
            className={`pb-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'myPrograms'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <User className="w-4 h-4 inline mr-1" />
            My Programs
          </button>
          <button
            onClick={() => setActiveTab('presets')}
            data-testid={testIds.workouts.presetsTab}
            className={`pb-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'presets'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Sparkles className="w-4 h-4 inline mr-1" />
            Presets
          </button>
        </nav>
      </div>
      
      {activeTab === 'myPrograms' && (
        <div className="mb-6 flex flex-wrap gap-3">
          <button
            onClick={() => setShowGeneratorMode(true)}
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
      )}

      {/* Generator Mode Selection Modal */}
      {showGeneratorMode && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">Generate Workout Plan</h2>
              <button
                onClick={() => setShowGeneratorMode(false)}
                className="text-gray-500 hover:text-gray-700"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Mode Selection */}
            {generatorMode === 'profile' ? (
              <>
                <p className="text-gray-600 mb-6">Choose how you'd like to generate your workout plan:</p>
                <div className="grid md:grid-cols-2 gap-4 mb-6">
                  <button
                    onClick={() => setGeneratorMode('profile')}
                    className={`card p-6 text-left hover:border-blue-500 transition-colors border-blue-500 ring-2 ring-blue-200`}
                    data-testid="workout-program-mode-profile-btn"
                  >
                    <User className="w-8 h-8 text-blue-600 mb-3" />
                    <h3 className="font-semibold text-gray-900 mb-2">Based on Profile</h3>
                    <p className="text-sm text-gray-600">
                      Uses your saved profile settings (goal, experience, equipment) to generate a personalized plan.
                    </p>
                  </button>
                  
                  <button
                    onClick={() => setGeneratorMode('custom')}
                    className="card p-6 text-left hover:border-purple-500 transition-colors"
                    data-testid="workout-program-mode-custom-btn"
                  >
                    <Settings className="w-8 h-8 text-purple-600 mb-3" />
                    <h3 className="font-semibold text-gray-900 mb-2">Custom</h3>
                    <p className="text-sm text-gray-600">
                      Choose your own goal, training days, experience level, and equipment.
                    </p>
                  </button>
                </div>
              </>
            ) : null}
            
            {/* Custom Options Form */}
            {generatorMode === 'custom' && (
              <div className="space-y-4 mb-6">
                <button
                  onClick={() => setGeneratorMode('profile')}
                  className="text-sm text-blue-600 hover:text-blue-800 mb-4"
                >
                  ← Back to mode selection
                </button>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Goal
                  </label>
                  <select
                    value={customOptions.goalType}
                    onChange={(e) => setCustomOptions({...customOptions, goalType: e.target.value as any})}
                    className="input w-full"
                    data-testid="workout-program-custom-goal-select"
                  >
                    <option value="strength">Strength</option>
                    <option value="hypertrophy">Hypertrophy (Muscle Growth)</option>
                    <option value="fat_loss">Fat Loss</option>
                    <option value="endurance">Endurance</option>
                    <option value="general_fitness">General Fitness</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Days per week
                  </label>
                  <select
                    value={customOptions.daysPerWeek}
                    onChange={(e) => setCustomOptions({...customOptions, daysPerWeek: parseInt(e.target.value)})}
                    className="input w-full"
                    data-testid="workout-program-custom-days-select"
                  >
                    <option value={2}>2 days</option>
                    <option value={3}>3 days</option>
                    <option value={4}>4 days</option>
                    <option value={5}>5 days</option>
                    <option value={6}>6 days</option>
                    <option value={7}>7 days</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Experience level
                  </label>
                  <select
                    value={customOptions.experienceLevel}
                    onChange={(e) => setCustomOptions({...customOptions, experienceLevel: e.target.value as any})}
                    className="input w-full"
                    data-testid="workout-program-custom-experience-select"
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Available equipment
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {['bodyweight', 'dumbbells', 'barbell', 'kettlebells', 'resistance bands', 'cable machine', 'squat rack', 'bench'].map((equipment) => (
                      <label key={equipment} className="flex items-center space-x-2 text-sm">
                        <input
                          type="checkbox"
                          checked={customOptions.equipment.includes(equipment)}
                          onChange={(e) => {
                            const updated = e.target.checked
                              ? [...customOptions.equipment, equipment]
                              : customOptions.equipment.filter(e => e !== equipment);
                            setCustomOptions({...customOptions, equipment: updated});
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          data-testid={`workout-program-custom-equipment-${equipment.replace(/\s+/g, '-')}`}
                        />
                        <span className="capitalize">{equipment}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            {/* Generate Button */}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowGeneratorMode(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={generatorMode === 'profile' ? generateWorkoutPlan : generateWorkoutPlan}
                disabled={generating || customOptions.equipment.length === 0}
                className="btn btn-primary"
                data-testid="workout-program-generate-btn"
              >
                {generating ? 'Generating...' : 'Generate Workout Plan'}
              </button>
            </div>
          </div>
        </div>
      )}
      
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

      {/* My Programs Tab Content */}
      {activeTab === 'myPrograms' && (
        <>
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
              onClick={() => setShowGeneratorMode(true)}
              disabled={generating}
              data-testid="generate-workout-plan-btn"
              className="btn btn-primary"
            >
              {generating ? 'Generating...' : 'Generate Workout Plan'}
            </button>
          </div>
        )}
      </div>
      </>
      )}
      
      {/* Presets Tab Content */}
      {activeTab === 'presets' && (
        <div data-testid={testIds.workouts.presetsListRoot}>
          {/* Search and Filters */}
          <div className="card mb-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={presetSearch}
                  onChange={(e) => setPresetSearch(e.target.value)}
                  placeholder="Search workout presets by name, goal, equipment..."
                  className="input pl-10"
                  data-testid={testIds.workouts.presetSearchInput}
                />
              </div>
              <button
                onClick={() => setShowPresetFilters(!showPresetFilters)}
                className="btn btn-secondary"
                aria-expanded={showPresetFilters}
                aria-label="Toggle filters"
                data-testid={testIds.workouts.presetsFiltersToggle}
              >
                <Filter className="w-5 h-5" />
              </button>
            </div>

            {/* Tag Filters */}
            {showPresetFilters && (
              <div
                className="flex flex-wrap gap-2"
                data-testid={testIds.workouts.presetsFiltersPanel}
              >
                {Array.from(new Set(workoutPresets.flatMap(p => p.tags))).sort().map(tag => (
                <button
                  key={tag}
                  onClick={() => {
                    if (presetFilterTags.includes(tag)) {
                      setPresetFilterTags(presetFilterTags.filter(t => t !== tag));
                    } else {
                      setPresetFilterTags([...presetFilterTags, tag]);
                    }
                  }}
                  className={`px-3 py-1 rounded-full text-sm ${
                    presetFilterTags.includes(tag)
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                  data-testid={`${testIds.presets.filterChip}-${tag.replace(/\s+/g, '-')}`}
                >
                  {tag}
                </button>
              ))}
              {presetFilterTags.length > 0 && (
                <button
                  onClick={() => setPresetFilterTags([])}
                  className="px-3 py-1 rounded-full text-sm text-red-600 hover:bg-red-50"
                  data-testid={testIds.presets.clearFiltersBtn}
                >
                  <XCircle className="w-4 h-4 inline mr-1" />
                  Clear
                </button>
              )}
              </div>
            )}
          </div>

          {/* Preset List */}
          <div className="space-y-4">
            {workoutPresets
              .filter(preset => {
                const searchLower = presetSearch.toLowerCase();
                const matchesSearch =
                  preset.title.toLowerCase().includes(searchLower) ||
                  preset.summary.toLowerCase().includes(searchLower) ||
                  preset.tags.some(tag => tag.toLowerCase().includes(searchLower));
                const matchesFilters =
                  presetFilterTags.length === 0 ||
                  presetFilterTags.every(tag => preset.tags.includes(tag));
                return matchesSearch && matchesFilters;
              })
              .map(preset => (
                <div
                  key={preset.id}
                  className="card"
                  data-testid={testIds.workouts.presetCard(preset.id)}
                  data-preset-id={preset.id}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="text-lg font-medium text-gray-900">{preset.title}</h3>
                      <p className="text-sm text-gray-600 mt-1">{preset.summary}</p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {preset.tags.slice(0, 4).map(tag => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded"
                          >
                            {tag}
                          </span>
                        ))}
                        <span className="text-xs text-gray-500">
                          {preset.daysPerWeek}x/week • {preset.durationWeeks} weeks • {preset.level}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {preset.equipment.length > 0 ? `Equipment: ${preset.equipment.join(', ')}` : 'No equipment required'}
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleImportPreset(preset)}
                        disabled={importingPreset}
                        className="btn btn-primary text-sm"
                        data-testid={testIds.workouts.presetImportBtn(preset.id)}
                      >
                        {importingPreset ? (
                          <RefreshCw className="w-4 h-4 mr-1 inline animate-spin" />
                        ) : (
                          <Download className="w-4 h-4 mr-1 inline" />
                        )}
                        Import as Copy
                      </button>
                      <button
                        onClick={() => {
                          setSelectedPreset(preset);
                          setShowPresetPreview(true);
                        }}
                        className="btn btn-secondary text-sm"
                        data-testid={`${testIds.presets.previewBtn}-${preset.id}`}
                      >
                        Preview
                      </button>
                    </div>
                  </div>
                </div>
              ))}

            {workoutPresets.filter(preset => {
              const searchLower = presetSearch.toLowerCase();
              const matchesSearch =
                preset.title.toLowerCase().includes(searchLower) ||
                preset.summary.toLowerCase().includes(searchLower) ||
                preset.tags.some(tag => tag.toLowerCase().includes(searchLower));
              const matchesFilters =
                presetFilterTags.length === 0 ||
                presetFilterTags.every(tag => preset.tags.includes(tag));
              return matchesSearch && matchesFilters;
            }).length === 0 && (
              <div className="card text-center py-12">
                <Search className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No matching presets</h3>
                <p className="text-sm text-gray-600">Try adjusting your search or filters</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Preset Preview Dialog */}
      {showPresetPreview && selectedPreset && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
          data-testid={testIds.presets.previewDialog}
        >
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{selectedPreset.title}</h2>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedPreset.tags.map(tag => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowPresetPreview(false);
                    setSelectedPreset(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                  data-testid={testIds.presets.closePreviewBtn}
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <p className="text-gray-700 mb-4">{selectedPreset.summary}</p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-gray-50 p-3 rounded">
                  <div className="text-xs text-gray-500">Duration</div>
                  <div className="font-medium text-gray-900">{selectedPreset.durationWeeks} weeks</div>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <div className="text-xs text-gray-500">Frequency</div>
                  <div className="font-medium text-gray-900">{selectedPreset.daysPerWeek}x/week</div>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <div className="text-xs text-gray-500">Session</div>
                  <div className="font-medium text-gray-900">{selectedPreset.sessionMinutes} min</div>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <div className="text-xs text-gray-500">Level</div>
                  <div className="font-medium text-gray-900">{selectedPreset.level}</div>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-900 mb-2">Equipment Required</h3>
                <p className="text-sm text-gray-600">
                  {selectedPreset.equipment.length > 0
                    ? selectedPreset.equipment.join(', ')
                    : 'Bodyweight only (no equipment required)'
                  }
                </p>
              </div>

              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-900 mb-2">Progression</h3>
                <p className="text-sm text-gray-600">{selectedPreset.progression}</p>
              </div>

              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-900 mb-2">Workout Structure</h3>
                <div className="space-y-3">
                  {selectedPreset.days.map((day, index) => (
                    <div key={index} className="border rounded p-3">
                      <h4 className="font-medium text-gray-900 mb-2">{day.name}</h4>
                      <p className="text-xs text-gray-600 mb-2">{day.focus}</p>
                      <ul className="space-y-1">
                        {day.slots.map((slot, slotIndex) => (
                          <li key={slotIndex} className="text-xs text-gray-700 flex justify-between">
                            <span>{slot.label}</span>
                            <span className="text-gray-500">
                              {slot.sets} × {typeof slot.reps === 'object' ? `${slot.reps.min}-${slot.reps.max}` : slot.reps}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>

              {selectedPreset.evidence && selectedPreset.evidence.length > 0 && (
                <div className="border-t pt-4">
                  <h3 className="text-sm font-medium text-gray-900 mb-2">Scientific Evidence</h3>
                  {selectedPreset.evidence.map((evidence, index) => (
                    <div key={index} className="mb-3">
                      <div className="text-xs font-medium text-gray-900">{evidence.title}</div>
                      <div className="text-xs text-gray-500">{evidence.source}</div>
                      <div className="text-xs text-gray-600 mt-1">{evidence.note}</div>
                      {evidence.url && (
                        <a
                          href={evidence.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:text-blue-800"
                        >
                          Read more
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Selected Plan Details (My Programs only) */}
      {activeTab === 'myPrograms' && selectedPlan && (
        <div className="card">
          {/* Import Warning Banner */}
          {importWarning && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start space-x-3" data-testid={testIds.workouts.importWarning}>
              <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="font-medium text-yellow-800">Some exercises need attention</h4>
                <p className="text-sm text-yellow-700 mt-1">{importWarning}</p>
              </div>
              <button
                onClick={() => setImportWarning(null)}
                className="text-yellow-600 hover:text-yellow-800 flex-shrink-0"
                aria-label="Dismiss warning"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

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
              <div className="flex items-center justify-between">
                <label className="label mb-0">Select Week</label>
                {selectedPlan.weeks.length > VISIBLE_WEEKS && (
                  <div className="flex space-x-1">
                    <button
                      onClick={() => setWeekCarouselStart(Math.max(0, weekCarouselStart - 1))}
                      disabled={weekCarouselStart === 0}
                      className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      data-testid="workout-plan-weeks-prev"
                      aria-label="Previous weeks"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setWeekCarouselStart(Math.min(selectedPlan.weeks.length - VISIBLE_WEEKS, weekCarouselStart + 1))}
                      disabled={weekCarouselStart + VISIBLE_WEEKS >= selectedPlan.weeks.length}
                      className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      data-testid="workout-plan-weeks-next"
                      aria-label="Next weeks"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
              <div className="flex space-x-2 mt-2">
                {selectedPlan.weeks
                  .slice(weekCarouselStart, weekCarouselStart + VISIBLE_WEEKS)
                  .map((_, weekIndex) => (
                    <button
                      key={weekIndex + weekCarouselStart}
                      onClick={() => setSelectedWeek(weekIndex + weekCarouselStart)}
                      className={`px-3 py-1 rounded text-sm ${
                        selectedWeek === weekIndex + weekCarouselStart
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                      data-testid={`workout-plan-week-btn-${weekIndex + weekCarouselStart}`}
                    >
                      Week {weekIndex + weekCarouselStart + 1}
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
                  
                  // Calculate global day index for completion tracking
                  let dayGlobalIndex = 0;
                  for (let i = 0; i < selectedWeek; i++) {
                    dayGlobalIndex += selectedPlan.weeks[i].workouts.length;
                  }
                  dayGlobalIndex += dayIndex;
                  const isDayCompleted = selectedPlan.completedDays?.includes(dayGlobalIndex) || false;
                  
                  return (
                    <div 
                      key={dayIndex} 
                      data-testid={`workout-day-${selectedWeek}-${dayIndex}`}
                      className={`border rounded-lg p-4 transition-opacity ${
                        isDayCompleted ? 'bg-green-50 border-green-200' : ''
                      }`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-start space-x-3 flex-1">
                          <button
                            onClick={() => toggleDayCompletion(selectedPlan, selectedWeek, dayIndex)}
                            className={`mt-0.5 flex items-center justify-center w-5 h-5 rounded border transition-colors ${
                              isDayCompleted
                                ? 'bg-green-500 border-green-500 text-white'
                                : 'border-gray-300 hover:border-green-500'
                            }`}
                            data-testid={`workout-plan-day-complete-${selectedWeek}-${dayIndex}`}
                            aria-label={isDayCompleted ? 'Mark as incomplete' : 'Mark as complete'}
                          >
                            {isDayCompleted && (
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>
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
                              data-testid={`workout-editor-exercise-row-${exIndex}`}
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
                                  <div className="font-medium" data-testid={`${testIds.workouts.planExercise(exercise.exerciseId)}`}>
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
                                      <span data-testid={testIds.workouts.replaceExerciseButton}>
                                        <button
                                          onClick={() => {
                                            setSwapTarget({ weekIndex: selectedWeek, dayIndex, exerciseIndex: exIndex });
                                            setShowExercisePicker(true);
                                          }}
                                          className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-xs"
                                          title="Replace with different exercise"
                                          aria-label="Swap exercise"
                                          data-testid="workout-editor-exercise-swap-btn"
                                        >
                                          <ArrowLeftRight className="w-4 h-4" />
                                          <span className="hidden md:inline">Swap</span>
                                        </button>
                                      </span>
                                      <button
                                        onClick={() => editExercisePrescription(selectedWeek, dayIndex, exIndex)}
                                        className="text-green-600 hover:text-green-800 flex items-center gap-1 text-xs"
                                        title="Edit sets, reps, and weight"
                                        aria-label="Edit sets and reps"
                                        data-testid="edit-prescription-btn"
                                      >
                                        <Sliders className="w-4 h-4" />
                                        <span className="hidden md:inline">Edit Sets</span>
                                      </button>
                                      <button
                                        onClick={() => substituteExercise(selectedWeek, dayIndex, exIndex, exercise.exerciseId)}
                                        className="text-purple-600 hover:text-purple-800 flex items-center gap-1 text-xs"
                                        title="Find similar exercise to swap"
                                        aria-label="Substitute with similar exercise"
                                        data-testid="substitute-exercise-btn"
                                      >
                                        <RefreshCw className="w-4 h-4" />
                                        <span className="hidden md:inline">Auto-Swap</span>
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
                if (swapTarget) {
                  // Swap mode: replace the specific exercise by index
                  replaceExerciseByIndex(swapTarget.weekIndex, swapTarget.dayIndex, swapTarget.exerciseIndex, exercise.id);
                  setSwapTarget(null);
                } else if (editingWorkout.exerciseId) {
                  replaceExercise(editingWorkout.weekIndex, editingWorkout.dayIndex, editingWorkout.exerciseId, exercise.id);
                } else {
                  addExercise(editingWorkout.weekIndex, editingWorkout.dayIndex, exercise.id);
                }
              }
            }
          }}
          onClose={() => {
            setShowExercisePicker(false);
            setSwapTarget(null);
            // Don't clear editingWorkout - keep edit mode active after swap
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