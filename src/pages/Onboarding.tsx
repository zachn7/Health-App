import React from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';

export default function Onboarding() {
  const [, setCompleted] = useLocalStorage('onboarding_completed', false);
  
  const handleComplete = () => {
    setCompleted(true);
  };
  
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Welcome to CodePuppy Trainer!</h1>
        <p className="mt-2 text-gray-600">Let's set up your profile to get started.</p>
      </div>
      
      <div className="card">
        <h2 className="text-xl font-medium text-gray-900 mb-4">Coming Soon</h2>
        <p className="text-gray-600 mb-6">
          We're still building out the onboarding experience. For now, let's get you started with the basic setup.
        </p>
        
        <button 
          onClick={handleComplete}
          className="btn btn-primary"
        >
          Continue to Dashboard
        </button>
      </div>
    </div>
  );
}