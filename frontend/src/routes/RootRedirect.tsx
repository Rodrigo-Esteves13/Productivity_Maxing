import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import Home from '../pages/Home';

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
