import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus } from 'lucide-react';
import { ExerciseDBService } from '@/lib/exercise-db';
import type { ExerciseDBItem } from '@/types';

interface ExercisePickerProps {
  onSelect: (exercise: ExerciseDBItem) => void;
  onClose: () => void;
  excludeIds?: string[];
  allowCustom?: boolean;
}

export default function ExercisePicker({ onSelect, onClose, excludeIds = [], allowCustom = false }: ExercisePickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<ExerciseDBItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCustomExerciseForm, setShowCustomExerciseForm] = useState(false);
  const [customExercise, setCustomExercise] = useState({
    name: '',
    bodyPart: '',
    equipment: ['body only'],
    category: 'strength',
    difficulty: 'beginner' as 'beginner' | 'intermediate' | 'advanced',
    instructions: [] as string[],
    instructionsText: ''
  });
  const [savingCustom, setSavingCustom] = useState(false);
  const [bodyParts, setBodyParts] = useState<string[]>([]);
  const [equipment, setEquipment] = useState<string[]>([]);
  const [selectedBodyPart, setSelectedBodyPart] = useState<string>('');
  const [selectedEquipment, setSelectedEquipment] = useState<string>('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('');
  
  useEffect(() => {
    loadFilters();
    // Auto-search on typing with debounce, or show initial results
    const timer = setTimeout(() => {
      searchExercises();
    }, 300);
    
    return () => clearTimeout(timer);
  }, [searchQuery, selectedBodyPart, selectedEquipment, selectedDifficulty]);
  
  const loadFilters = async () => {
    try {
      const [parts, equip] = await Promise.all([
        ExerciseDBService.getAllBodyParts(),
        ExerciseDBService.getAllEquipment()
      ]);
      setBodyParts(parts);
      setEquipment(equip);
    } catch (error) {
      console.error('Failed to load filters:', error);
    }
  };
  
  const searchExercises = async () => {
    setLoading(true);
    try {
      let searchResults: ExerciseDBItem[] = [];
      
      if (searchQuery) {
        searchResults = await ExerciseDBService.searchExercises(searchQuery);
      } else if (selectedBodyPart) {
        searchResults = await ExerciseDBService.getExercisesByBodyPart(selectedBodyPart);
      } else if (selectedEquipment) {
        searchResults = await ExerciseDBService.getExercisesByEquipment(selectedEquipment);
      } else {
        // Show sample exercises when no search or filters
        searchResults = await ExerciseDBService.searchExercises('');
      }
      
      // Apply filters
      if (selectedDifficulty) {
        searchResults = searchResults.filter(ex => ex.difficulty === selectedDifficulty);
      }
      if (selectedBodyPart && !searchQuery) {
        searchResults = searchResults.filter(ex => ex.bodyPart === selectedBodyPart);
      }
      if (selectedEquipment && !searchQuery) {
        searchResults = searchResults.filter(ex => ex.equipment.includes(selectedEquipment));
      }
      
      // Exclude specified IDs
      if (excludeIds.length > 0) {
        searchResults = searchResults.filter(ex => !excludeIds.includes(ex.id));
      }
      
      setResults(searchResults);
    } catch (error) {
      console.error('Failed to search exercises:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleSelect = (exercise: ExerciseDBItem) => {
    onSelect(exercise);
    onClose();
  };
  
  const clearFilters = () => {
    setSearchQuery('');
    setSelectedBodyPart('');
    setSelectedEquipment('');
    setSelectedDifficulty('');
  };

  const handleSaveCustomExercise = async () => {
    if (!customExercise.name.trim()) {
      alert('Exercise name is required');
      return;
    }

    setSavingCustom(true);
    try {
      // Parse instructions from text (one per line)
      const instructionsArray = customExercise.instructionsText
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

      const exerciseData = {
        name: customExercise.name.trim(),
        bodyPart: customExercise.bodyPart || 'full body',
        equipment: customExercise.equipment,
        category: customExercise.category,
        targetMuscles: [],
        synergistMuscles: [],
        stabilizerMuscles: [],
        instructions: instructionsArray,
        difficulty: customExercise.difficulty
      };

      const id = await ExerciseDBService.addCustomExercise(exerciseData);
      
      // Get the saved exercise
      const savedExercise = await ExerciseDBService.getExerciseById(id);
      if (savedExercise) {
        // Add to results
        setResults([savedExercise, ...results]);
        // Select it and close
        onSelect(savedExercise);
      }
      
      // Reset form
      setShowCustomExerciseForm(false);
      setCustomExercise({
        name: '',
        bodyPart: '',
        equipment: ['body only'],
        category: 'strength',
        difficulty: 'beginner',
        instructions: [],
        instructionsText: ''
      });
    } catch (error) {
      console.error('Failed to save custom exercise:', error);
      alert('Failed to save custom exercise. Please try again.');
    } finally {
      setSavingCustom(false);
    }
  };
  
  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Exercise Picker</h2>
              {allowCustom && (
                <button
                  onClick={() => setShowCustomExerciseForm(!showCustomExerciseForm)}
                  className="text-sm text-blue-600 hover:text-blue-700 flex items-center"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  {showCustomExerciseForm ? 'Cancel' : 'Add Custom Exercise'}
                </button>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
          
          {/* Search */}
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search exercises..."
              className="input flex-1"
              data-testid="exercise-search-input"
            />
            <button
              onClick={searchExercises}
              disabled={loading}
              className="btn btn-primary"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </div>
        
        {/* Custom Exercise Form */}
        {showCustomExerciseForm && (
          <div className="p-6 bg-blue-50 border-b border-blue-200">
            <h3 className="font-medium text-gray-900 mb-4">Create Custom Exercise</h3>
            <div className="space-y-4">
              <div>
                <label className="label">Exercise Name *</label>
                <input
                  type="text"
                  value={customExercise.name}
                  onChange={(e) => setCustomExercise({ ...customExercise, name: e.target.value })}
                  className="input"
                  placeholder="e.g., My Custom Bench Press"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Body Part</label>
                  <select
                    value={customExercise.bodyPart}
                    onChange={(e) => setCustomExercise({ ...customExercise, bodyPart: e.target.value })}
                    className="input"
                  >
                    <option value="">Select...</option>
                    {bodyParts.map(part => (
                      <option key={part} value={part}>{part}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Equipment</label>
                  <select
                    value={customExercise.equipment[0]}
                    onChange={(e) => setCustomExercise({ ...customExercise, equipment: [e.target.value] })}
                    className="input"
                  >
                    {equipment.map(equip => (
                      <option key={equip} value={equip}>{equip}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Category</label>
                  <select
                    value={customExercise.category}
                    onChange={(e) => setCustomExercise({ ...customExercise, category: e.target.value })}
                    className="input"
                  >
                    <option value="strength">Strength</option>
                    <option value="powerlifting">Powerlifting</option>
                    <option value="bodybuilding">Bodybuilding</option>
                    <option value="strongman">Strongman</option>
                    <option value="olympic weightlifting">Olympic Weightlifting</option>
                    <option value="plyometrics">Plyometrics</option>
                    <option value="stretching">Stretching</option>
                    <option value="cardio">Cardio</option>
                  </select>
                </div>
                <div>
                  <label className="label">Difficulty</label>
                  <select
                    value={customExercise.difficulty}
                    onChange={(e) => setCustomExercise({ ...customExercise, difficulty: e.target.value as 'beginner' | 'intermediate' | 'advanced' })}
                    className="input"
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className="label">Instructions (one per line)</label>
                <textarea
                  value={customExercise.instructionsText}
                  onChange={(e) => setCustomExercise({ ...customExercise, instructionsText: e.target.value })}
                  className="input min-h-[100px]"
                  placeholder="1. Step one&#10;2. Step two&#10;3. Step three"
                />
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={handleSaveCustomExercise}
                  disabled={savingCustom}
                  className="btn btn-primary flex-1"
                >
                  {savingCustom ? 'Saving...' : 'Save Exercise'}
                </button>
                <button
                  onClick={() => {
                    setShowCustomExerciseForm(false);
                    setCustomExercise({
                      name: '',
                      bodyPart: '',
                      equipment: ['body only'],
                      category: 'strength',
                      difficulty: 'beginner',
                      instructions: [],
                      instructionsText: ''
                    });
                  }}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Filters */}
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="label text-xs">Body Part</label>
              <select
                value={selectedBodyPart}
                onChange={(e) => setSelectedBodyPart(e.target.value)}
                className="input text-sm"
              >
                <option value="">All Body Parts</option>
                {bodyParts.map(part => (
                  <option key={part} value={part}>{part}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="label text-xs">Equipment</label>
              <select
                value={selectedEquipment}
                onChange={(e) => setSelectedEquipment(e.target.value)}
                className="input text-sm"
              >
                <option value="">All Equipment</option>
                {equipment.map(equip => (
                  <option key={equip} value={equip}>{equip}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="label text-xs">Difficulty</label>
              <select
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value)}
                className="input text-sm"
              >
                <option value="">All Levels</option>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
            
            <div className="flex items-end">
              <button
                onClick={clearFilters}
                className="btn btn-secondary text-sm w-full"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>
        
        {/* Custom Exercise Form */}
        {showCustomExerciseForm && (
          <div className="p-6 bg-blue-50 border-b border-blue-200">
            <h3 className="font-medium text-gray-900 mb-4">Create Custom Exercise</h3>
            <div className="space-y-4">
              <div>
                <label className="label">Exercise Name *</label>
                <input
                  type="text"
                  value={customExercise.name}
                  onChange={(e) => setCustomExercise({ ...customExercise, name: e.target.value })}
                  className="input"
                  placeholder="e.g., My Custom Bench Press"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Body Part</label>
                  <select
                    value={customExercise.bodyPart}
                    onChange={(e) => setCustomExercise({ ...customExercise, bodyPart: e.target.value })}
                    className="input"
                  >
                    <option value="">Select...</option>
                    {bodyParts.map(part => (
                      <option key={part} value={part}>{part}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Equipment</label>
                  <select
                    value={customExercise.equipment[0]}
                    onChange={(e) => setCustomExercise({ ...customExercise, equipment: [e.target.value] })}
                    className="input"
                  >
                    {equipment.map(equip => (
                      <option key={equip} value={equip}>{equip}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Category</label>
                  <select
                    value={customExercise.category}
                    onChange={(e) => setCustomExercise({ ...customExercise, category: e.target.value })}
                    className="input"
                  >
                    <option value="strength">Strength</option>
                    <option value="powerlifting">Powerlifting</option>
                    <option value="bodybuilding">Bodybuilding</option>
                    <option value="strongman">Strongman</option>
                    <option value="olympic weightlifting">Olympic Weightlifting</option>
                    <option value="plyometrics">Plyometrics</option>
                    <option value="stretching">Stretching</option>
                    <option value="cardio">Cardio</option>
                  </select>
                </div>
                <div>
                  <label className="label">Difficulty</label>
                  <select
                    value={customExercise.difficulty}
                    onChange={(e) => setCustomExercise({ ...customExercise, difficulty: e.target.value as 'beginner' | 'intermediate' | 'advanced' })}
                    className="input"
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className="label">Instructions (one per line)</label>
                <textarea
                  value={customExercise.instructionsText}
                  onChange={(e) => setCustomExercise({ ...customExercise, instructionsText: e.target.value })}
                  className="input min-h-[100px]"
                  placeholder="1. Step one&#10;2. Step two&#10;3. Step three"
                />
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={handleSaveCustomExercise}
                  disabled={savingCustom}
                  className="btn btn-primary flex-1"
                >
                  {savingCustom ? 'Saving...' : 'Save Exercise'}
                </button>
                <button
                  onClick={() => {
                    setShowCustomExerciseForm(false);
                    setCustomExercise({
                      name: '',
                      bodyPart: '',
                      equipment: ['body only'],
                      category: 'strength',
                      difficulty: 'beginner',
                      instructions: [],
                      instructionsText: ''
                    });
                  }}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Results */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Searching exercises...</p>
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-8 text-gray-500" data-testid="exercise-search-empty-state">
              <p>No exercises found. Try adjusting your search or filters.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {results.map((exercise) => (
                <button
                  key={exercise.id}
                  onClick={() => handleSelect(exercise)}
                  className="w-full text-left p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  data-testid={`exercise-result-${exercise.id}`}
                  data-exercise-name={exercise.name}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{exercise.name}</h3>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {exercise.bodyPart}
                        </span>
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {exercise.difficulty}
                        </span>
                        {exercise.equipment.slice(0, 2).map(equip => (
                          <span key={equip} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            {equip}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="text-gray-400">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}