import { Navigate } from 'react-router-dom';

export default function RootRedirect() {
  const isAuthenticated = !!localStorage.getItem('token');
  
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />;
}