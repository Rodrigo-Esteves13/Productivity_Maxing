import AppRouter from './routes/AppRouter';
import { AuthProvider } from './context/AuthContext';
import { AcademicProvider } from './context/AcademicContext';
import OfflineBanner from './pwa/OfflineBanner';
import AccessibilityEffects from './components/Accessibility/AccessibilityEffects';
import MaintenanceGate from './components/Maintenance/MaintenanceGate';
import AccountBlockedGate from './components/AccountBlocked/AccountBlockedGate';
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <MaintenanceGate>
        <AccountBlockedGate>
          <AuthProvider>
            <AcademicProvider>
              <AccessibilityEffects />
              <OfflineBanner />
              <AppRouter />
            </AcademicProvider>
          </AuthProvider>
        </AccountBlockedGate>
      </MaintenanceGate>
    </ErrorBoundary>
  );
}

export default App;