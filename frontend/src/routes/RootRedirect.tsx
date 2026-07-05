import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

export default function RootRedirect() {
  const { isAuthenticated } = useAuth();
  
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />;
}