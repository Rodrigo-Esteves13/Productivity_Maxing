import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

export default function AdminRoute() {
  // O JWT já não é legível por JS (cookie HttpOnly), por isso a role vem do
  // user carregado no AuthContext via /auth/me, e não de descodificar o
  // token à mão.
  const { isAuthenticated, isAuthLoading, user, isLoadingUser } = useAuth();

  if (isAuthLoading || isLoadingUser) {
    return null;
  }

  // Se não tiver login feito, expulsa para a página de Login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Se tiver login mas NÃO for ADMIN, expulsa para a Dashboard
  if (user?.role !== 'ADMIN') {
    return <Navigate to="/dashboard" replace />;
  }

  // Se passou nas duas validações (É autenticado e é ADMIN), deixa passar
  return <Outlet />;
}
