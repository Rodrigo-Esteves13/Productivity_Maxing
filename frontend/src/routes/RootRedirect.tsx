import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RootRedirect() {
  const { isAuthenticated } = useAuth();
  
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />;
}