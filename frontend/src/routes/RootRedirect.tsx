import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

export default function RootRedirect() {
  const { isAuthenticated, isAuthLoading } = useAuth();

  if (isAuthLoading) {
    return null;
  }

  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />;
}