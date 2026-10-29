import AppRouter from './routes/AppRouter';
import { AuthProvider } from './context/AuthContext';
import { AcademicProvider } from './context/AcademicContext';
import { StudySessionProvider } from './context/StudySessionProvider';
import AccessibilityEffects from './components/Accessibility/AccessibilityEffects';
import CompletionBurst from './components/Accessibility/CompletionBurst';
import MaintenanceGate from './components/Maintenance/MaintenanceGate';
import AccountBlockedGate from './components/AccountBlocked/AccountBlockedGate';
import AccountStatusWatcher from './components/AccountBlocked/AccountStatusWatcher';
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary';
import { FeedbackProvider } from './context/FeedbackProvider';
import I18nProvider from './i18n/I18nProvider';
import { LucideProvider } from 'lucide-react';

// Tamanho por defeito dos icones (ver components/UI/Icons.tsx).
const ICON_SIZE_PX = 16;
// Um pouco mais fino que o 2 do lucide: equilibra com texto de peso normal.
const ICON_STROKE_WIDTH = 1.75;

function App() {
  return (
    <LucideProvider size={ICON_SIZE_PX} strokeWidth={ICON_STROKE_WIDTH}>
    <ErrorBoundary>
      <I18nProvider>
      <FeedbackProvider>
      <MaintenanceGate>
        <AccountBlockedGate>
          <AuthProvider>
            <AccountStatusWatcher />
            {/* Needs useAuth() internally (only polls/heartbeats the active
                session once actually authenticated), so it has to sit
                inside AuthProvider - and above AcademicProvider/AppRouter
                so both GlobalStudyTimer (mounted in AppRouter, visible on
                every page) and the Focus page's own widget share this
                exact state instead of polling independently. */}
            <StudySessionProvider>
              <AcademicProvider>
                <AccessibilityEffects />
                <CompletionBurst />
                <AppRouter />
              </AcademicProvider>
            </StudySessionProvider>
          </AuthProvider>
        </AccountBlockedGate>
      </MaintenanceGate>
      </FeedbackProvider>
      </I18nProvider>
    </ErrorBoundary>
    </LucideProvider>
  );
}

export default App;
