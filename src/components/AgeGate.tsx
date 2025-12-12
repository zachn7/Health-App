import React, { useState } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';

const MINIMUM_AGE = 13;

export default function AgeGate() {
  const [age, setAge] = useState('');
  const [error, setError] = useState('');
  const [, setAccepted] = useLocalStorage('age_gate_accepted', false);
  const [, setTimestamp] = useLocalStorage('age_gate_timestamp', '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('AgeGate: handleSubmit called with age:', age);
    
    const ageNum = parseInt(age, 10);
    
    if (isNaN(ageNum) || ageNum < 1) {
      setError('Please enter a valid age');
      return;
    }
    
    if (ageNum < MINIMUM_AGE) {
      setError(`You must be at least ${MINIMUM_AGE} years old to use this app.`);
      return;
    }
    
    console.log('AgeGate: Valid age, setting accepted state');
    setAccepted(true);
    setTimestamp(new Date().toISOString());
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
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="age" className="block text-sm font-medium text-gray-700 mb-2">
                Confirm your age
              </label>
              <input
                type="number"
                id="age"
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
                <p className="mt-2 text-sm text-red-600" role="alert">
                  {error}
                </p>
              )}
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <h3 className="text-sm font-medium text-blue-900 mb-1">
                Age Requirement
              </h3>
              <p className="text-sm text-blue-700">
                You must be at least {MINIMUM_AGE} years old to use this app.
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
              disabled={!age}
            >
              Continue
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
      </div>
    </div>
  );
}