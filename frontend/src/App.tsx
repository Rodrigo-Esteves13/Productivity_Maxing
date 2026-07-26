import AppRouter from './routes/AppRouter';
import { AuthProvider } from './context/AuthContext';
import { AcademicProvider } from './context/AcademicContext';
import OfflineBanner from './pwa/OfflineBanner';
import AccessibilityEffects from './components/Accessibility/AccessibilityEffects';

function App() {
  return (
    <AuthProvider>
      <AcademicProvider>
        <AccessibilityEffects />
        <OfflineBanner />
        <AppRouter />
      </AcademicProvider>
    </AuthProvider>
  );
}

export default App;