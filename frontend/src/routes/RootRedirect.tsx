import { lazy } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

// Lazy here too (not just in AppRouter) so it suspends inside AppRouter's
// existing <Suspense> boundary without needing to thread the lazy
// component through as a prop. An authenticated user hitting "/" only
// ever takes the <Navigate to="/dashboard" /> branch below - this import
// only actually resolves for a logged-out visitor.
const Home = lazy(() => import('../pages/Home'));

export default function RootRedirect() {
  const { isAuthenticated, isAuthLoading } = useAuth();

  if (isAuthLoading) {
    return null;
  }

  // Autenticado -> vai direto para o dashboard, como antes.
  // Não autenticado -> mostra a homepage pública (conteúdo real em "/", não
  // um redirect - necessário para o Google conseguir rastrear/verificar a
  // homepage no processo de brand verification do OAuth).
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <Home />;
}
