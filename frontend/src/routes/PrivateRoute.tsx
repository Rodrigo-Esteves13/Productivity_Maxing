import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../context/useAuth';

interface PrivateRouteProps {
  children: ReactNode;
}

export default function PrivateRoute({ children }: PrivateRouteProps) {
  const { isAuthenticated, isAuthLoading } = useAuth();

  // Enquanto ainda não sabemos se o cookie de sessão é válido, não
  // expulsamos ninguém - só quando a verificação (GET /auth/csrf) terminar.
  if (isAuthLoading) {
    return null;
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
}
