import AppRouter from './routes/AppRouter';
import { AuthProvider } from './context/AuthContext';
import OfflineBanner from './pwa/OfflineBanner';

function App() {
  return (
    <AuthProvider>
      <OfflineBanner />
      <AppRouter />
    </AuthProvider>
  );
}

export default App;