import AppRouter from './routes/AppRouter';
import { AuthProvider } from './context/AuthContext';
import { AcademicProvider } from './context/AcademicContext';
import OfflineBanner from './pwa/OfflineBanner';

function App() {
  return (
    <AuthProvider>
      <AcademicProvider>
        <OfflineBanner />
        <AppRouter />
      </AcademicProvider>
    </AuthProvider>
  );
}

export default App;