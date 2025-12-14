import { useState, useEffect } from 'react';
import { repositories } from '../db';
import type { Profile, Goal } from '../types';
import { ActivityLevel, ExperienceLevel, GoalType, Sex } from '../types';

export default function Profile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
      alert('Profile saved successfully!');
      
      // Navigate to dashboard after successful save
      window.location.hash = '/dashboard';
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

  const updateField = (field: keyof Profile, value: any) => {
    if (!profile) return;
    setProfile({
      ...profile,
      [field]: value,
      updatedAt: new Date().toISOString()
    });
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

  const validateProfile = (profile: Profile): string[] => {
    const errors: string[] = [];
    
    if (!profile.age || profile.age < 13) {
      errors.push('Age must be 13 or older');
    }
    
    if (!profile.heightCm || profile.heightCm < 100 || profile.heightCm > 250) {
      errors.push('Height must be between 100-250 cm');
    }
    
    if (!profile.weightKg || profile.weightKg < 30 || profile.weightKg > 300) {
      errors.push('Weight must be between 30-300 kg');
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
          <button onClick={createNewProfile} className="btn btn-primary">
            Create Profile
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Profile</h1>
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
              <label className="label">Height (cm)</label>
              <input
                type="number"
                value={profile.heightCm}
                onChange={(e) => updateField('heightCm', parseInt(e.target.value))}
                className="input"
                min="100"
                max="250"
              />
            </div>
            
            <div>
              <label className="label">Weight (kg)</label>
              <input
                type="number"
                value={profile.weightKg}
                onChange={(e) => updateField('weightKg', parseFloat(e.target.value))}
                className="input"
                min="30"
                max="300"
                step="0.1"
              />
            </div>
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
              <div key={goal.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <div className="font-medium capitalize">
                    {goal.type.replace('_', ' ')}
                  </div>
                  {goal.targetDate && (
                    <div className="text-sm text-gray-600">
                      Target: {new Date(goal.targetDate).toLocaleDateString()}
                    </div>
                  )}
                  <div className="text-sm text-gray-600">
                    Priority: {'★'.repeat(goal.priority)}
                  </div>
                </div>
                <button
                  onClick={() => removeGoal(goal.id)}
                  className="text-red-600 hover:text-red-800"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
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
            
            <input
              type="date"
              value={newGoal.targetDate}
              onChange={(e) => setNewGoal({ ...newGoal, targetDate: e.target.value })}
              className="input"
            />
            
            <button
              onClick={addGoal}
              className="btn btn-secondary"
            >
              Add Goal
            </button>
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