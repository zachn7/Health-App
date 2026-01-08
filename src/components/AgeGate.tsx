import React, { useState } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';

const MINIMUM_AGE = 13;

interface AgeGateProps {
  onAgeGatePassed?: () => void;
}

export default function AgeGate({ onAgeGatePassed }: AgeGateProps) {
  const [age, setAge] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [devError, setDevError] = useState('');
  const [, setAccepted] = useLocalStorage('age_gate_accepted', false);
  const [, setTimestamp] = useLocalStorage('age_gate_timestamp', '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setDevError('');
    
    const ageNum = parseInt(age, 10);
    
    if (isNaN(ageNum) || ageNum < 1 || ageNum > 150) {
      setError('Please enter a valid age');
      return;
    }
    
    if (ageNum < MINIMUM_AGE) {
      setError(`You must be at least ${MINIMUM_AGE} years old to use this app.`);
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Save to localStorage
      setAccepted(true);
      setTimestamp(new Date().toISOString());
      
      // Save to localStorage
      setAccepted(true);
      setTimestamp(new Date().toISOString());
      
      console.log('Age gate passed, navigating...');
      
      // Keep loading state briefly for visual feedback, then call callback
      await new Promise(resolve => setTimeout(resolve, 100));
      setIsLoading(false);
      if (onAgeGatePassed) {
        onAgeGatePassed();
      }
    } catch (error) {
      setIsLoading(false);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('AgeGate: Failed to save:', error);
      setDevError(`DEV ERROR: ${errorMessage}`);
      setError('Failed to continue. Please try again.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-primary-100 flex items-center justify-center">
            <span className="text-2xl font-bold text-primary-600">🐕</span>
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            Welcome to CodePuppy Trainer
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Your personal fitness companion
          </p>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            <div>
              <label htmlFor="age" className="block text-sm font-medium text-gray-700 mb-2">
                Confirm your age
              </label>
              <input
                type="number"
                id="age"
                data-testid="age-input"
                value={age}
                onChange={(e) => {
                  setAge(e.target.value);
                  setError('');
                }}
                className="input"
                placeholder="Enter your age"
                min="1"
                max="150"
                required
              />
              {error && (
                <p className="mt-2 text-sm text-red-600" role="alert" data-testid="age-gate-error">
                  {error}
                </p>
              )}
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <h3 className="text-sm font-medium text-blue-900 mb-1">
                Age Requirement
              </h3>
              <p className="text-sm text-blue-700">
                This app is only available to users {MINIMUM_AGE} years or older.
              </p>
            </div>
            
            <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
              <h3 className="text-sm font-medium text-gray-900 mb-1">
                Privacy & Safety
              </h3>
              <p className="text-sm text-gray-700">
                This is an offline-first application. Your data is stored securely on your device and is never shared with third parties.
              </p>
            </div>
            
            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={!age || isLoading}
              data-testid="age-gate-continue"
            >
              {isLoading ? 'Saving...' : 'Continue'}
            </button>
          </form>
        </div>
        
        <div className="text-center">
          <p className="text-xs text-gray-500">
            By continuing, you confirm that you meet the age requirement and accept our{' '}
            <a href="#/legal/terms" className="text-primary-600 hover:text-primary-700">
              Terms of Use
            </a>{' '}
            and{' '}
            <a href="#/legal/privacy" className="text-primary-600 hover:text-primary-700">
              Privacy Policy
            </a>
            .
          </p>
        </div>
        
        {devError && process.env.NODE_ENV === 'development' && (
          <div className="mt-4 p-2 bg-red-100 border border-red-400 text-red-700 text-xs rounded">
            {devError}
          </div>
        )}
      </div>
    </div>
  );
}