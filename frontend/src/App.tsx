import AppRouter from './routes/AppRouter';
import { AuthProvider } from './context/AuthContext';
import { AcademicProvider } from './context/AcademicContext';
import OfflineBanner from './pwa/OfflineBanner';
import AccessibilityEffects from './components/Accessibility/AccessibilityEffects';
import MaintenanceGate from './components/Maintenance/MaintenanceGate';
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <MaintenanceGate>
        <AuthProvider>
          <AcademicProvider>
            <AccessibilityEffects />
            <OfflineBanner />
            <AppRouter />
          </AcademicProvider>
        </AuthProvider>
      </MaintenanceGate>
    </ErrorBoundary>
  );
}

export default App;