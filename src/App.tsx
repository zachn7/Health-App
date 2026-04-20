import { lazy, Suspense } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const Profile = lazy(() => import('./pages/Profile'));
const Coach = lazy(() => import('./pages/Coach'));
const Workouts = lazy(() => import('./pages/Workouts'));
const WorkoutLogger = lazy(() => import('./pages/WorkoutLogger'));
const Nutrition = lazy(() => import('./pages/Nutrition'));
const Meals = lazy(() => import('./pages/Meals'));
const Progress = lazy(() => import('./pages/Progress'));
const Injury = lazy(() => import('./pages/Injury'));
const Settings = lazy(() => import('./pages/Settings'));
const Privacy = lazy(() => import('./pages/Privacy'));
const PrivacyPolicy = lazy(() => import('./pages/legal/PrivacyPolicy'));
const TermsOfUse = lazy(() => import('./pages/legal/TermsOfUse'));
const MedicalDisclaimer = lazy(() => import('./pages/legal/MedicalDisclaimer'));

// Components
import Layout from './components/Layout';
import AgeGate from './components/AgeGate';

// Components
import ErrorBoundary from './components/ErrorBoundary';

// Hooks
import { useLocalStorage } from './hooks/useLocalStorage';

import { testIds } from './testIds';

function RouteFallback() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid={testIds.app.routeFallback}>
      <div className="card text-center py-10">
        <div className="text-lg font-medium text-gray-900">Loading page...</div>
        <p className="mt-2 text-sm text-gray-600">Hang tight, the app is fetching only what this route actually needs.</p>
      </div>
    </div>
  );
}

function AppContent() {
  const navigate = useNavigate();
  const [hasAcceptedAgeGate, setHasAcceptedAgeGate] = useLocalStorage('age_gate_accepted', false);
  const [hasCompletedOnboarding] = useLocalStorage('onboarding_completed', false);

  const handleAgeGatePassed = () => {
    // Force update of the state to trigger re-render
    setHasAcceptedAgeGate(true);
    
    // Navigate immediately after state update
    setTimeout(() => {
      if (hasCompletedOnboarding) {
        navigate('/');
      } else {
        navigate('/onboarding');
      }
    }, 0);
  };

  if (!hasAcceptedAgeGate) {
    return (
      <Layout>
        <AgeGate onAgeGatePassed={handleAgeGatePassed} />
      </Layout>
    );
  }

  return (
    <Layout>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route
            path="/"
            element={
              hasCompletedOnboarding ? <Dashboard /> : <Navigate to="/onboarding" replace />
            }
          />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/coach" element={
            <ErrorBoundary>
              <Coach />
            </ErrorBoundary>
          } />
          <Route path="/workouts" element={<Workouts />} />
          <Route path="/log/workout" element={<WorkoutLogger />} />
          <Route path="/nutrition" element={<Nutrition />} />
          <Route path="/meals" element={<Meals />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/injury" element={<Injury />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/legal/privacy" element={<PrivacyPolicy />} />
          <Route path="/legal/terms" element={<TermsOfUse />} />
          <Route path="/legal/disclaimer" element={<MedicalDisclaimer />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <AppContent />
      </Router>
    </ErrorBoundary>
  );
}

export default App;