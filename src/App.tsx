import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

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
import Privacy from './pages/Privacy';
import PrivacyPolicy from './pages/legal/PrivacyPolicy';
import TermsOfUse from './pages/legal/TermsOfUse';
import MedicalDisclaimer from './pages/legal/MedicalDisclaimer';

// Components
import Layout from './components/Layout';
import AgeGate from './components/AgeGate';

// Hooks
import { useLocalStorage } from './hooks/useLocalStorage';

function App() {
  const [hasAcceptedAgeGate] = useLocalStorage('age_gate_accepted', false);
  const [hasCompletedOnboarding] = useLocalStorage('onboarding_completed', false);

  if (!hasAcceptedAgeGate) {
    return <AgeGate />;
  }

  return (
    <Router>
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
          <Route path="/coach" element={<Coach />} />
          <Route path="/workouts" element={<Workouts />} />
          <Route path="/log/workout" element={<WorkoutLogger />} />
          <Route path="/nutrition" element={<Nutrition />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/injury" element={<Injury />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/legal/privacy" element={<PrivacyPolicy />} />
          <Route path="/legal/terms" element={<TermsOfUse />} />
          <Route path="/legal/disclaimer" element={<MedicalDisclaimer />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;