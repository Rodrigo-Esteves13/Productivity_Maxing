import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Função para ler a role do token com segurança
function getUserRole() {
  const token = localStorage.getItem('token');
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.role;
  } catch (e) {
    return null;
  }
}

export default function AdminRoute() {
  const { isAuthenticated } = useAuth();
  const role = getUserRole();

  // Se não tiver login feito, expulsa para a página de Login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Se tiver login mas NÃO for ADMIN, expulsa para a Dashboard
  if (role !== 'ADMIN') {
    return <Navigate to="/dashboard" replace />;
  }

  // Se passou nas duas validações (É autenticado e é ADMIN), deixa passar
  return <Outlet />;
}