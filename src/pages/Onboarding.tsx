import { useNavigate } from 'react-router-dom';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { repositories } from '../db';

export default function Onboarding() {
  const navigate = useNavigate();
  const [, setCompleted] = useLocalStorage('onboarding_completed', false);
  
  const handleGetStarted = async () => {
    // Check if profile exists
    try {
      const existingProfile = await repositories.profile.get();
      if (!existingProfile) {
        // Navigate to profile creation
        navigate('/profile');
      } else {
        // Profile exists, complete onboarding
        setCompleted(true);
        navigate('/');
      }
    } catch (error) {
      console.error('Failed to check profile:', error);
      navigate('/profile');
    }
  };
  
  const handleSkipSetup = () => {
    setCompleted(true);
    navigate('/');
  };
  
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8 text-center">
        <div className="mx-auto h-16 w-16 rounded-full bg-primary-100 flex items-center justify-center mb-6">
          <span className="text-3xl">🐕</span>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Welcome to CodePuppy Trainer!</h1>
        <p className="text-lg text-gray-600">Your personal offline fitness companion</p>
      </div>
      
      <div className="space-y-6">
        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-lg border border-blue-200">
            <div className="text-2xl mb-3">💪</div>
            <h3 className="font-semibold text-blue-900 mb-2">Smart Workout Plans</h3>
            <p className="text-sm text-blue-700">AI-generated workout plans tailored to your goals and equipment</p>
          </div>
          
          <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-lg border border-green-200">
            <div className="text-2xl mb-3">🥗</div>
            <h3 className="font-semibold text-green-900 mb-2">Nutrition Tracking</h3>
            <p className="text-sm text-green-700">Track calories and macros with custom macro splits</p>
          </div>
          
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-lg border border-purple-200">
            <div className="text-2xl mb-3">📊</div>
            <h3 className="font-semibold text-purple-900 mb-2">Progress Tracking</h3>
            <p className="text-sm text-purple-700">Monitor your fitness journey with detailed analytics</p>
          </div>
          
          <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-6 rounded-lg border border-amber-200">
            <div className="text-2xl mb-3">⚡</div>
            <h3 className="font-semibold text-amber-900 mb-2">100% Offline</h3>
            <p className="text-sm text-amber-700">Your data stays on your device - no internet required!</p>
          </div>
        </div>
        
        {/* Call to Action */}
        <div className="card">
          <h2 className="text-xl font-medium text-gray-900 mb-4">Ready to Get Started?</h2>
          <p className="text-gray-600 mb-6">
            Let's set up your profile to create personalized fitness plans just for you.
          </p>
          
          <div className="flex gap-4">
            <button 
              data-testid="onboarding-setup-profile"
              onClick={handleGetStarted}
              className="btn btn-primary flex-1"
            >
              Set Up Profile
            </button>
            
            <button 
              data-testid="onboarding-skip"
              onClick={handleSkipSetup}
              className="btn btn-secondary"
            >
              Skip for Now
            </button>
          </div>
          
          <p className="text-xs text-gray-500 mt-4 text-center">
            You can always complete your profile later from the Settings
          </p>
        </div>
        
        {/* Important Info */}
        <div className="bg-amber-50 border border-amber-200 rounded-md p-4">
          <h3 className="text-sm font-medium text-amber-900 mb-2">
            🎯 Important Note
          </h3>
          <p className="text-sm text-amber-700">
            This app provides fitness and nutrition guidance for educational purposes only. 
            Always consult with healthcare professionals before starting new exercise or nutrition programs.
          </p>
        </div>
      </div>
    </div>
  );
}