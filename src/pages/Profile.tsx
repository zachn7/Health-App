import { useState, useEffect } from 'react';
import { repositories } from '../db';
import type { Profile, Goal, UnitSystem } from '../types';
import { ActivityLevel, ExperienceLevel, GoalType, Sex } from '../types';
import {
  formatHeight,
  formatWeight,
  cmToFtIn,
  kgToLbs,
  parseImperialHeight,
  parseImperialWeight,
  validateMetricHeight,
  validateMetricWeight,
  validateImperialHeight,
  validateImperialWeight
} from '../lib/unit-conversions';

export default function Profile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [imperialHeight, setImperialHeight] = useState({ feet: '', inches: '' });
  const [imperialWeight, setImperialWeight] = useState('');
  const [newGoal, setNewGoal] = useState<Goal>({
    id: crypto.randomUUID(),
    type: GoalType.GENERAL_FITNESS,
    targetDate: '',
    priority: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const existingProfile = await repositories.profile.get();
      if (existingProfile) {
        setProfile(existingProfile);
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async () => {
    if (!profile) return;
    
    // Validate profile before saving
    const validationErrors = validateProfile(profile);
    if (validationErrors.length > 0) {
      alert('Please fix the following errors:\n\n' + validationErrors.join('\n'));
      return;
    }
    
    setSaving(true);
    try {
      console.log('Saving profile:', profile);
      await repositories.profile.save(profile);
      console.log('Profile saved successfully!');
      
      // Switch back to view mode and show success
      setEditMode(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save profile:', error);
      
      // Enhanced error reporting for debugging
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : 'No stack trace';
      
      console.error('Profile save error details:', {
        errorMessage,
        errorStack,
        profileData: profile
      });
      
      alert(`Failed to save profile: ${errorMessage}. Please check the console for details.`);
    } finally {
      setSaving(false);
    }
  };

  const createNewProfile = () => {
    const newProfile: Profile = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      age: 25,
      sex: Sex.MALE,
      heightCm: 175,
      weightKg: 75,
      preferredUnits: 'metric',
      activityLevel: ActivityLevel.MODERATE,
      experienceLevel: ExperienceLevel.BEGINNER,
      goals: [newGoal],
      equipment: ['dumbbells', 'bodyweight'],
      schedule: {
        monday: true,
        tuesday: false,
        wednesday: true,
        thursday: false,
        friday: true,
        saturday: false,
        sunday: false
      },
      limitations: ''
    };
    setProfile(newProfile);
  };

  // Update imperial fields when profile or unit system changes
  useEffect(() => {
    if (profile) {
      if (profile.preferredUnits === 'imperial') {
        const { feet, inches } = cmToFtIn(profile.heightCm);
        setImperialHeight({ feet: feet.toString(), inches: inches.toString() });
        setImperialWeight(kgToLbs(profile.weightKg).toFixed(1));
      } else {
        setImperialHeight({ feet: '', inches: '' });
        setImperialWeight('');
      }
    }
  }, [profile, profile?.preferredUnits, profile?.heightCm, profile?.weightKg]);

  const updateField = (field: keyof Profile, value: any) => {
    if (!profile) return;
    setProfile({
      ...profile,
      [field]: value,
      updatedAt: new Date().toISOString()
    });
  };

  const updateGoal = (goalId: string, updates: Partial<Goal>) => {
    if (!profile) return;
    const updatedGoals = profile.goals.map(goal => 
      goal.id === goalId ? { ...goal, ...updates, updatedAt: new Date().toISOString() } : goal
    );
    updateField('goals', updatedGoals);
  };

  const setPrimaryGoal = (goalId: string) => {
    if (!profile) return;
    const updatedGoals = profile.goals.map(goal => ({
      ...goal,
      isPrimary: goal.id === goalId
    }));
    updateField('goals', updatedGoals);
  };

  const addGoal = () => {
    if (!profile) return;
    updateField('goals', [...profile.goals, { ...newGoal, id: crypto.randomUUID() }]);
    setNewGoal({
      id: crypto.randomUUID(),
      type: GoalType.GENERAL_FITNESS,
      targetDate: '',
      priority: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  };

  const removeGoal = (goalId: string) => {
    if (!profile) return;
    updateField('goals', profile.goals.filter(g => g.id !== goalId));
  };

  const updateHeight = (value: number) => {
    if (!profile) return;
    
    if (profile.preferredUnits === 'imperial') {
      const { feet, inches } = cmToFtIn(value);
      setImperialHeight({ feet: feet.toString(), inches: inches.toString() });
    }
    
    updateField('heightCm', value);
  };

  const updateWeight = (value: number) => {
    if (!profile) return;
    
    if (profile.preferredUnits === 'imperial') {
      setImperialWeight(kgToLbs(value).toFixed(1));
    }
    
    updateField('weightKg', value);
  };

  const updateImperialHeight = (feet: string, inches: string) => {
    setImperialHeight({ feet, inches });
    
    const cm = parseImperialHeight(feet, inches);
    if (cm !== null) {
      updateField('heightCm', cm);
    }
  };

  const updateImperialWeight = (lbs: string) => {
    setImperialWeight(lbs);
    
    const kg = parseImperialWeight(lbs);
    if (kg !== null) {
      updateField('weightKg', kg);
    }
  };

  const validateProfile = (profile: Profile): string[] => {
    const errors: string[] = [];
    
    if (!profile.age || profile.age < 13) {
      errors.push('Age must be 13 or older');
    }
    
    // Validate height based on display units but check internally
    if (profile.preferredUnits === 'imperial') {
      const feet = parseInt(imperialHeight.feet, 10);
      const inches = parseInt(imperialHeight.inches, 10);
      if (!validateImperialHeight(feet, inches)) {
        errors.push('Height must be between 3\'4" and 8\'3"');
      }
    } else {
      if (!validateMetricHeight(profile.heightCm)) {
        errors.push('Height must be between 100-250 cm');
      }
    }
    
    // Validate weight based on display units but check internally
    if (profile.preferredUnits === 'imperial') {
      const lbs = parseFloat(imperialWeight);
      if (!validateImperialWeight(lbs)) {
        errors.push('Weight must be between 66-661 lbs');
      }
    } else {
      if (!validateMetricWeight(profile.weightKg)) {
        errors.push('Weight must be between 30-300 kg');
      }
    }
    
    if (profile.goals.length === 0) {
      errors.push('At least one fitness goal is required');
    }
    
    if (!profile.equipment || profile.equipment.length === 0) {
      errors.push('At least one equipment selection is required');
    }
    
    const hasWorkoutDay = Object.values(profile.schedule).some(day => day === true);
    if (!hasWorkoutDay) {
      errors.push('At least one workout day must be selected');
    }
    
    return errors;
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">Loading profile...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Profile</h1>
          <p className="mt-2 text-gray-600">Your personal information and goals</p>
        </div>
        
        <div className="card text-center py-12">
          <h2 className="text-xl font-medium text-gray-900 mb-4">No Profile Found</h2>
          <p className="text-gray-600 mb-6">Create your profile to get started with personalized fitness plans</p>
          <button onClick={() => {
            createNewProfile();
            setEditMode(true);
          }} className="btn btn-primary">
            Create Profile
          </button>
        </div>
      </div>
    );
  }

  // View Mode - Display readonly stat cards
  if (!editMode && profile) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Profile</h1>
            <p className="mt-2 text-gray-600">Your personal information and goals</p>
          </div>
          <button
            onClick={() => setEditMode(true)}
            className="btn btn-secondary"
          >
            Edit Profile
          </button>
        </div>

        {showSuccess && (
          <div className="mb-6 p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg">
            Profile saved successfully!
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Basic Info Card */}
          <div className="card">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Age:</span>
                <span className="font-medium">{profile.age} years</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Sex:</span>
                <span className="font-medium capitalize">{profile.sex}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Height:</span>
                <span className="font-medium">
                  {formatHeight(profile.heightCm, profile.preferredUnits)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Weight:</span>
                <span className="font-medium">
                  {formatWeight(profile.weightKg, profile.preferredUnits)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Units:</span>
                <span className="font-medium capitalize">{profile.preferredUnits}</span>
              </div>
            </div>
          </div>

          {/* Activity Level Card */}
          <div className="card">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Activity & Experience</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Activity Level:</span>
                <span className="font-medium capitalize">{profile.activityLevel.replace('_', ' ')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Experience:</span>
                <span className="font-medium capitalize">{profile.experienceLevel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Workout Days:</span>
                <span className="font-medium">
                  {Object.values(profile.schedule).filter(Boolean).length} per week
                </span>
              </div>
            </div>
          </div>

          {/* Equipment Card */}
          <div className="card">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Available Equipment</h3>
            <div className="flex flex-wrap gap-1">
              {profile.equipment.map(eq => (
                <span key={eq} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full capitalize">
                  {eq.replace('-', ' ')}
                </span>
              ))}
            </div>
          </div>

          {/* Goals Card */}
          <div className="card md:col-span-2 lg:col-span-3">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Fitness Goals</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {profile.goals.map(goal => (
                <div key={goal.id} className="p-4 bg-gray-50 rounded-lg">
                  <div className="font-medium capitalize mb-2">
                    {goal.type.replace('_', ' ')}
                  </div>
                  {goal.targetDate && (
                    <div className="text-sm text-gray-600 mb-1">
                      Target: {new Date(goal.targetDate).toLocaleDateString()}
                    </div>
                  )}
                  <div className="text-sm text-gray-600">
                    Priority: {'★'.repeat(goal.priority)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Limitations Card */}
          {profile.limitations && (
            <div className="card md:col-span-2 lg:col-span-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Injury Limitations</h3>
              <p className="text-sm text-gray-600">{profile.limitations}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Edit Mode - Show the existing form
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">{editMode ? 'Edit Profile' : 'Profile'}</h1>
        <p className="mt-2 text-gray-600">Your personal information and goals</p>
      </div>
      
      <div className="space-y-6">
        {/* Basic Information */}
        <div className="card">
          <h2 className="text-xl font-medium text-gray-900 mb-6">Basic Information</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="label">Age</label>
              <input
                type="number"
                value={profile.age || ''}
                onChange={(e) => updateField('age', parseInt(e.target.value) || undefined)}
                className="input"
                min="13"
                max="120"
              />
            </div>
            
            <div>
              <label className="label">Sex</label>
              <select
                value={profile.sex || ''}
                onChange={(e) => updateField('sex', e.target.value as Sex)}
                className="input"
              >
                <option value="">Select</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            
            <div>
              <label className="label">Units</label>
              <select
                value={profile.preferredUnits || 'metric'}
                onChange={(e) => updateField('preferredUnits', e.target.value as UnitSystem)}
                className="input"
              >
                <option value="metric">Metric (cm, kg)</option>
                <option value="imperial">Imperial (ft/in, lbs)</option>
              </select>
            </div>
          </div>
          
          {/* Height Input */}
          <div className="mt-6">
            <label className="label">Height</label>
            {profile.preferredUnits === 'imperial' ? (
              <div className="flex gap-2 items-center">
                <div className="flex-1">
                  <input
                    type="number"
                    value={imperialHeight.feet}
                    onChange={(e) => updateImperialHeight(e.target.value, imperialHeight.inches)}
                    className="input"
                    min="3"
                    max="8"
                    placeholder="Feet"
                  />
                </div>
                <span className="text-gray-500">ft</span>
                <div className="flex-1">
                  <input
                    type="number"
                    value={imperialHeight.inches}
                    onChange={(e) => updateImperialHeight(imperialHeight.feet, e.target.value)}
                    className="input"
                    min="0"
                    max="11"
                    placeholder="Inches"
                  />
                </div>
                <span className="text-gray-500">in</span>
                <span className="text-sm text-gray-500 ml-2">
                  ({formatHeight(profile.heightCm, 'metric')})
                </span>
              </div>
            ) : (
              <div className="flex gap-2 items-center">
                <input
                  type="number"
                  value={profile.heightCm}
                  onChange={(e) => updateHeight(parseInt(e.target.value))}
                  className="input flex-1"
                  min="100"
                  max="250"
                />
                <span className="text-gray-500">cm</span>
                <span className="text-sm text-gray-500 ml-2">
                  ({formatHeight(profile.heightCm, 'imperial')})
                </span>
              </div>
            )}
          </div>
          
          {/* Weight Input */}
          <div className="mt-6">
            <label className="label">Weight</label>
            {profile.preferredUnits === 'imperial' ? (
              <div className="flex gap-2 items-center">
                <input
                  type="number"
                  value={imperialWeight}
                  onChange={(e) => updateImperialWeight(e.target.value)}
                  className="input flex-1"
                  min="66"
                  max="661"
                  step="0.1"
                />
                <span className="text-gray-500">lbs</span>
                <span className="text-sm text-gray-500 ml-2">
                  ({formatWeight(profile.weightKg, 'metric')})
                </span>
              </div>
            ) : (
              <div className="flex gap-2 items-center">
                <input
                  type="number"
                  value={profile.weightKg}
                  onChange={(e) => updateWeight(parseFloat(e.target.value))}
                  className="input flex-1"
                  min="30"
                  max="300"
                  step="0.1"
                />
                <span className="text-gray-500">kg</span>
                <span className="text-sm text-gray-500 ml-2">
                  ({formatWeight(profile.weightKg, 'imperial')})
                </span>
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <div>
              <label className="label">Activity Level</label>
              <select
                value={profile.activityLevel}
                onChange={(e) => updateField('activityLevel', e.target.value as ActivityLevel)}
                className="input"
              >
                <option value="sedentary">Sedentary (little to no exercise)</option>
                <option value="light">Light (1-3 days/week)</option>
                <option value="moderate">Moderate (3-5 days/week)</option>
                <option value="active">Active (6-7 days/week)</option>
                <option value="very_active">Very Active (twice per day)</option>
              </select>
            </div>
            
            <div>
              <label className="label">Experience Level</label>
              <select
                value={profile.experienceLevel}
                onChange={(e) => updateField('experienceLevel', e.target.value as ExperienceLevel)}
                className="input"
              >
                <option value="beginner">Beginner (0-1 year)</option>
                <option value="intermediate">Intermediate (1-3 years)</option>
                <option value="advanced">Advanced (3+ years)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Workout Schedule */}
        <div className="card">
          <h2 className="text-xl font-medium text-gray-900 mb-6">Workout Schedule</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            {Object.entries(profile.schedule).map(([day, enabled]) => (
              <label key={day} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => updateField('schedule', {
                    ...profile.schedule,
                    [day]: e.target.checked
                  })}
                  className="rounded"
                />
                <span className="capitalize">{day.slice(0, 3)}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Equipment */}
        <div className="card">
          <h2 className="text-xl font-medium text-gray-900 mb-6">Available Equipment</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[
              'bodyweight', 'dumbbells', 'barbell', 'squat rack', 'bench',
              'pull-up bar', 'resistance bands', 'cable machine', 'kettlebells'
            ].map(equipment => (
              <label key={equipment} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={profile.equipment.includes(equipment)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      updateField('equipment', [...profile.equipment, equipment]);
                    } else {
                      updateField('equipment', profile.equipment.filter(eq => eq !== equipment));
                    }
                  }}
                  className="rounded"
                />
                <span className="capitalize">{equipment.replace('-', ' ')}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Goals */}
        <div className="card">
          <h2 className="text-xl font-medium text-gray-900 mb-6">Fitness Goals</h2>
          
          <div className="space-y-4 mb-6">
            {profile.goals.map(goal => (
              <div key={goal.id} className={`p-4 rounded-lg border-2 ${goal.isPrimary ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="label text-xs">Goal Type</label>
                      <select
                        value={goal.type}
                        onChange={(e) => updateGoal(goal.id, { type: e.target.value as GoalType })}
                        className="input text-sm"
                      >
                        <option value="strength">Strength</option>
                        <option value="hypertrophy">Muscle Building</option>
                        <option value="fat_loss">Fat Loss</option>
                        <option value="endurance">Endurance</option>
                        <option value="general_fitness">General Fitness</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="label text-xs">Goal End Date</label>
                      <input
                        type="date"
                        value={goal.targetDate}
                        onChange={(e) => updateGoal(goal.id, { targetDate: e.target.value })}
                        className="input text-sm"
                      />
                    </div>
                    
                    <div>
                      <label className="label text-xs">Priority</label>
                      <select
                        value={goal.priority}
                        onChange={(e) => updateGoal(goal.id, { priority: parseInt(e.target.value) })}
                        className="input text-sm"
                      >
                        <option value="1">★ Low</option>
                        <option value="2">★★ Medium</option>
                        <option value="3">★★★ High</option>
                        <option value="4">★★★★ Critical</option>
                      </select>
                    </div>
                    
                    <div className="flex items-end space-x-2">
                      <button
                        onClick={() => setPrimaryGoal(goal.id)}
                        className={`btn btn-sm ${goal.isPrimary ? 'btn-primary' : 'btn-secondary'}`}
                      >
                        {goal.isPrimary ? 'Primary' : 'Set Primary'}
                      </button>
                      <button
                        onClick={() => removeGoal(goal.id)}
                        className="btn btn-sm text-red-600 hover:text-red-800 border-red-300"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
                
                {goal.targetDate && (
                  <div className="text-sm text-gray-600">
                    Target: {new Date(goal.targetDate).toLocaleDateString()} ({Math.ceil((new Date(goal.targetDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days remaining)
                  </div>
                )}
                
                {goal.isPrimary && (
                  <div className="text-sm text-green-700 font-medium mt-2">
                    ⭐ Primary goal for workout plan generation
                  </div>
                )}
              </div>
            ))}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="label">Goal Type</label>
              <select
                value={newGoal.type}
                onChange={(e) => setNewGoal({ ...newGoal, type: e.target.value as GoalType })}
                className="input"
              >
                <option value="strength">Strength</option>
                <option value="hypertrophy">Muscle Building</option>
                <option value="fat_loss">Fat Loss</option>
                <option value="endurance">Endurance</option>
                <option value="general_fitness">General Fitness</option>
              </select>
            </div>
            
            <div>
              <label className="label">Goal End Date</label>
              <input
                type="date"
                value={newGoal.targetDate}
                onChange={(e) => setNewGoal({ ...newGoal, targetDate: e.target.value })}
                className="input"
              />
            </div>
            
            <div>
              <label className="label">Priority</label>
              <select
                value={newGoal.priority}
                onChange={(e) => setNewGoal({ ...newGoal, priority: parseInt(e.target.value) })}
                className="input"
              >
                <option value="1">★ Low</option>
                <option value="2">★★ Medium</option>
                <option value="3">★★★ High</option>
                <option value="4">★★★★ Critical</option>
              </select>
            </div>
            
            <div className="flex items-end">
              <button
                onClick={addGoal}
                className="btn btn-secondary w-full"
              >
                Add Goal
              </button>
            </div>
          </div>
        </div>

        {/* Limitations */}
        <div className="card">
          <h2 className="text-xl font-medium text-gray-900 mb-6">Injury Limitations</h2>
          <textarea
            value={profile.limitations || ''}
            onChange={(e) => updateField('limitations', e.target.value)}
            className="input"
            rows={3}
            placeholder="Any injuries, physical limitations, or areas to avoid..."
          />
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={saveProfile}
            disabled={saving}
            className="btn btn-primary min-w-32"
          >
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </div>
    </div>
  );
}