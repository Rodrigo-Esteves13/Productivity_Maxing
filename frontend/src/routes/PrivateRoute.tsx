import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../context/useAuth';

interface PrivateRouteProps {
  children: ReactNode;
}

export default function PrivateRoute({ children }: PrivateRouteProps) {
  const { isAuthenticated, isAuthLoading } = useAuth();
  const location = useLocation();

  // Enquanto ainda não sabemos se o cookie de sessão é válido, não
  // expulsamos ninguém - só quando a verificação (GET /auth/csrf) terminar.
  if (isAuthLoading) {
    return null;
  }

  // Guarda onde o utilizador queria ir (ex.: link de um pacote de tarefas): o
  // Login so aceita caminhos do proprio site (isSafeRedirectPath).
  const redirect = encodeURIComponent(location.pathname + location.search);
  return isAuthenticated ? children : <Navigate to={`/login?redirect=${redirect}`} replace />;
}
