import { HashRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';

// Pages
import Dashboard from './pages/Dashboard';
import Onboarding from './pages/Onboarding';
import Profile from './pages/Profile';
import Coach from './pages/Coach';
import Workouts from './pages/Workouts';
import WorkoutLogger from './pages/WorkoutLogger';
import Nutrition from './pages/Nutrition';
import Progress from './pages/Progress';
import Injury from './pages/Injury';
import Settings from './pages/Settings';
import Privacy from './pages/Privacy';
import PrivacyPolicy from './pages/legal/PrivacyPolicy';
import TermsOfUse from './pages/legal/TermsOfUse';
import MedicalDisclaimer from './pages/legal/MedicalDisclaimer';

// Components
import Layout from './components/Layout';
import AgeGate from './components/AgeGate';

// Components
import ErrorBoundary from './components/ErrorBoundary';

// Hooks
import { useLocalStorage } from './hooks/useLocalStorage';

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
      <Routes>
        <Route
          path="/"
          element={
            hasCompletedOnboarding ? <Dashboard /> : <Navigate to="/onboarding" replace />
          }
        />
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
        <Route path="/progress" element={<Progress />} />
        <Route path="/injury" element={<Injury />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/legal/privacy" element={<PrivacyPolicy />} />
        <Route path="/legal/terms" element={<TermsOfUse />} />
        <Route path="/legal/disclaimer" element={<MedicalDisclaimer />} />
      </Routes>
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