import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ExerciseDBService } from '@/lib/exercise-db';
import type { ExerciseDBItem } from '@/types';

interface ExercisePickerProps {
  onSelect: (exercise: ExerciseDBItem) => void;
  onClose: () => void;
  excludeIds?: string[];
}

export default function ExercisePicker({ onSelect, onClose, excludeIds = [] }: ExercisePickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<ExerciseDBItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [bodyParts, setBodyParts] = useState<string[]>([]);
  const [equipment, setEquipment] = useState<string[]>([]);
  const [selectedBodyPart, setSelectedBodyPart] = useState<string>('');
  const [selectedEquipment, setSelectedEquipment] = useState<string>('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('');
  
  useEffect(() => {
    loadFilters();
    // Auto-search on typing with debounce
    const timer = setTimeout(() => {
      if (searchQuery || selectedBodyPart || selectedEquipment || selectedDifficulty) {
        searchExercises();
      }
    }, searchQuery ? 300 : 0); // Debounce text search, immediate filter search
    
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
    if (!searchQuery && !selectedBodyPart && !selectedEquipment && !selectedDifficulty) {
      setResults([]);
      return;
    }
    
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
        // Load some sample results
        await ExerciseDBService.initialize();
        const allParts = await ExerciseDBService.getAllBodyParts();
        for (const part of allParts.slice(0, 5)) {
          const exercises = await ExerciseDBService.getExercisesByBodyPart(part);
          searchResults.push(...exercises.slice(0, 3));
        }
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
  
  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Exercise Picker</h2>
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
        
        {/* Results */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Searching exercises...</p>
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No exercises found. Try adjusting your search or filters.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {results.map((exercise) => (
                <button
                  key={exercise.id}
                  onClick={() => handleSelect(exercise)}
                  className="w-full text-left p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
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