import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import PrivateRoute from './PrivateRoute';
import RootRedirect from './RootRedirect';
import Login from '../pages/Login';
import Dashboard from '../pages/Dashboard';
import AuthCallback from '../components/Auth/AuthCallback';
import Tasks from '../pages/Tasks';
import Profile from '../pages/Profile';

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />

        {/* --- ROTAS PRIVADAS --- */}
        <Route 
          path="/dashboard" 
          element={<PrivateRoute><Dashboard /></PrivateRoute>} 
        />
        
        {<Route 
          path="/tasks" 
          element={<PrivateRoute><Tasks /></PrivateRoute>} 
        />}

        {<Route 
          path="/profile" 
          element={<PrivateRoute><Profile /></PrivateRoute>} 
        />}
        
        {/* O lixo (apenas URLs que não existem nas rotas acima vêm parar aqui) */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}