import AppRouter from './routes/AppRouter';
import { AuthProvider } from './context/AuthContext';
import { AcademicProvider } from './context/AcademicContext';
import { StudySessionProvider } from './context/StudySessionProvider';
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
            {/* Needs useAuth() internally (only polls/heartbeats the active
                session once actually authenticated), so it has to sit
                inside AuthProvider - and above AcademicProvider/AppRouter
                so both GlobalStudyTimer (mounted in AppRouter, visible on
                every page) and the Focus page's own widget share this
                exact state instead of polling independently. */}
            <StudySessionProvider>
              <AcademicProvider>
                <AccessibilityEffects />
                <OfflineBanner />
                <AppRouter />
              </AcademicProvider>
            </StudySessionProvider>
          </AuthProvider>
        </AccountBlockedGate>
      </MaintenanceGate>
    </ErrorBoundary>
  );
}

export default App;
