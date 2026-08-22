import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import PrivateRoute from './PrivateRoute';
import AdminRoute from './AdminRoute';
import RootRedirect from './RootRedirect';
import Login from '../pages/Login';
import Register from '../pages/Register';
import ForgotPassword from '../pages/ForgotPassword';
import ResetPassword from '../pages/ResetPassword';
import AuthCallback from '../components/Auth/AuthCallback';
import CookieNotice from '../components/Legal/CookieNotice';
import CommandPalette from '../components/CommandPalette/CommandPalette';
import LoadingState from '../components/UI/LoadingState';

// Route-level code splitting: everything below only downloads its JS chunk
// when the user actually navigates there, instead of all of it (including
// recharts/xlsx-heavy pages like Dashboard, and admin-only pages almost
// nobody hits) being bundled into the one script every visitor's browser
// has to parse before anything renders. Login/Register/ForgotPassword/
// ResetPassword/AuthCallback stay eager on purpose - they're the actual
// entry point for a first-time or logged-out visitor, they're small (plain
// forms, no charting/spreadsheet libs), and lazy-loading them would just
// add a network round-trip to the page almost everyone hits first.
// Home is lazy too, but imported inside RootRedirect.tsx itself (see
// there) rather than here, since an authenticated user hitting "/" never
// needs it at all.
const Dashboard = lazy(() => import('../pages/Dashboard'));
const Tasks = lazy(() => import('../pages/Tasks'));
const Focus = lazy(() => import('../pages/Focus'));
const Profile = lazy(() => import('../pages/Profile'));
const Developer = lazy(() => import('../pages/Developer'));
const Agent = lazy(() => import('../pages/Agent'));
const Areas = lazy(() => import('../pages/Areas'));
const Users = lazy(() => import('../pages/Users'));
const Security = lazy(() => import('../pages/Security'));
const TaskTypes = lazy(() => import('../pages/TaskTypes'));
const PrivacyPolicy = lazy(() => import('../pages/PrivacyPolicy'));
const TermsOfService = lazy(() => import('../pages/TermsOfService'));
const Eula = lazy(() => import('../pages/Eula'));
const DmcaPolicy = lazy(() => import('../pages/DmcaPolicy'));
const NotFound = lazy(() => import('../pages/NotFound'));

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingState message="Loading..." className="min-h-[60vh]" />}>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          {/* Públicas - o consent screen do Google OAuth aponta para estas */}
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/eula" element={<Eula />} />
          <Route path="/dmca" element={<DmcaPolicy />} />

          {/* ROTAS PRIVADAS */}
          <Route
            path="/dashboard"
            element={<PrivateRoute><Dashboard /></PrivateRoute>}
          />
          <Route
            path="/tasks"
            element={<PrivateRoute><Tasks /></PrivateRoute>}
          />
          <Route
            path="/focus"
            element={<PrivateRoute><Focus /></PrivateRoute>}
          />
          <Route
            path="/profile"
            element={<PrivateRoute><Profile /></PrivateRoute>}
          />
          <Route
            path="/developer"
            element={<PrivateRoute><Developer /></PrivateRoute>}
          />
          <Route
            path="/agent"
            element={<PrivateRoute><Agent /></PrivateRoute>}
          />

          {/* O <AdminRoute /> envolve as páginas. Se tentarem entrar na página de áreas, o AdminRoute barra. */}
          <Route element={<AdminRoute />}>
            <Route path="/areas" element={<Areas />} />
            <Route path="/users" element={<Users />} />
            <Route path="/security" element={<Security />} />
            <Route path="/task-types" element={<TaskTypes />} />
          </Route>

          {/* O lixo (apenas URLs que não existem nas rotas acima vêm parar aqui).
              Antes disto era um <Navigate to="/" replace /> silencioso - um link
              morto ou um typo simplesmente saltava para a home sem feedback
              nenhum, e o Search Console não conseguia distinguir isso de um
              redirect válido. Agora mostra mesmo uma página 404 (noindex). */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>

      {/* Tem de estar aqui dentro do BrowserRouter, não no App.tsx - usa
          <Link> do react-router-dom, que precisa do contexto do Router. */}
      <CookieNotice />
      {/* Mesma razão: CommandPalette usa useNavigate(), que também precisa
          de estar dentro do Router. Gated internamente por isAuthenticated
          - não faz sentido nas páginas públicas de login/registo. */}
      <CommandPalette />
    </BrowserRouter>
  );
}
