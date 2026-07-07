import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import PrivateRoute from './PrivateRoute';
import AdminRoute from './AdminRoute';
import RootRedirect from './RootRedirect';
import Login from '../pages/Login';
import Register from '../pages/Register';
import Dashboard from '../pages/Dashboard';
import AuthCallback from '../components/Auth/AuthCallback';
import Tasks from '../pages/Tasks';
import Profile from '../pages/Profile';
import Areas from '../pages/Areas';
import Users from '../pages/Users';
import PrivacyPolicy from '../pages/PrivacyPolicy';
import TermsOfService from '../pages/TermsOfService';
import CookieNotice from '../components/Legal/CookieNotice';

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        {/* Públicas - o consent screen do Google OAuth aponta para estas */}
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfService />} />

        {/* --- ROTAS PRIVADAS --- */}
        <Route 
          path="/dashboard" 
          element={<PrivateRoute><Dashboard /></PrivateRoute>} 
        />
        <Route 
          path="/tasks" 
          element={<PrivateRoute><Tasks /></PrivateRoute>} 
        />
        <Route 
          path="/profile" 
          element={<PrivateRoute><Profile /></PrivateRoute>} 
        />

        {/* O <AdminRoute /> envolve as páginas. Se tentarem entrar na página de áreas, o AdminRoute barra. */}
        <Route element={<AdminRoute />}>
          <Route path="/areas" element={<Areas />} />
          <Route path="/users" element={<Users />} />
        </Route>
        
        {/* O lixo (apenas URLs que não existem nas rotas acima vêm parar aqui) */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Tem de estar aqui dentro do BrowserRouter, não no App.tsx - usa
          <Link> do react-router-dom, que precisa do contexto do Router. */}
      <CookieNotice />
    </BrowserRouter>
  );
}