import { Suspense } from 'react';
import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom';
import PrivateRoute from './PrivateRoute';
import AdminRoute from './AdminRoute';
import RootRedirect from './RootRedirect';
import Login from '../pages/Login';
import Register from '../pages/Register';
import ForgotPassword from '../pages/ForgotPassword';
import AuthCallback from '../components/Auth/AuthCallback';
import CookieNotice from '../components/Legal/CookieNotice';
import CommandPaletteHost from '../components/CommandPalette/CommandPaletteHost';
import GlobalStudyTimerHost from '../components/Study/GlobalStudyTimerHost';
import RoutePrefetcher from './RoutePrefetcher';
import CalendarSyncReviewModal from '../components/Schedule/CalendarSyncReviewModal';
import PushPermissionPrompt from '../pwa/PushPermissionPrompt';
import RouteSkeleton from '../components/UI/RouteSkeleton';
import {
  Dashboard,
  Tasks,
  Focus,
  Schedule,
  Notebook,
  Profile,
  Developer,
  Agent,
  Areas,
  Social,
  FriendNotes,
  FriendProfile,
  FriendNoteEntry,
  TaskPacks,
  ImportTaskPack,
  Users,
  Security,
  Appeals,
  FeedbackAdmin,
  FriendCodeRequestsAdmin,
  AdminUserProfile,
  TaskTypes,
  PrivacyPolicy,
  SharedNotebookEntry,
  TermsOfService,
  Eula,
  DmcaPolicy,
  WeeklyReview,
  Wellbeing,
  Changelog,
  NotFound,
  ResetPassword,
  VerifyEmail,
  SetPassword,
  LoginTwoFactor,
} from './pages';

// Route-level code splitting: everything below only downloads its JS chunk
// when the user actually navigates there, instead of all of it (including
// recharts/xlsx-heavy pages like Dashboard, and admin-only pages almost
// nobody hits) being bundled into the one script every visitor's browser
// has to parse before anything renders. Login/Register/ForgotPassword/
// AuthCallback stay eager on purpose - they're the actual entry point for a
// first-time or logged-out visitor, they're small (plain forms), and
// lazy-loading them would just add a network round-trip to the page almost
// everyone hits first. ResetPassword, VerifyEmail and the 2FA step are lazy:
// they're only opened from an email link or a 2FA account, and ResetPassword
// pulls in the whole Supabase client (~200 KB) that nothing else uses.
// Home is lazy too, but imported inside RootRedirect.tsx itself (see
// there) rather than here, since an authenticated user hitting "/" never
// needs it at all.
// As paginas (lazy, com preload) vivem em ./pages: os links do menu
// usam o mesmo modulo para as pre-carregar antes do clique.
export default function AppRouter() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteSkeleton />}>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/set-password" element={<SetPassword />} />
          <Route path="/login/2fa" element={<LoginTwoFactor />} />
          <Route path="/review" element={<PrivateRoute><WeeklyReview /></PrivateRoute>} />
          <Route path="/wellbeing" element={<PrivateRoute><Wellbeing /></PrivateRoute>} />
          <Route path="/changelog" element={<PrivateRoute><Changelog /></PrivateRoute>} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          {/* Públicas - o consent screen do Google OAuth aponta para estas */}
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/eula" element={<Eula />} />
          <Route path="/dmca" element={<DmcaPolicy />} />
          {/* Também pública - quem recebe um link de "Share" numa lesson do
              Notebook não tem (nem precisa de) conta nenhuma. */}
          <Route path="/shared/:token" element={<SharedNotebookEntry />} />

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
            path="/schedule"
            element={<PrivateRoute><Schedule /></PrivateRoute>}
          />
          <Route
            path="/notebook"
            element={<PrivateRoute><Notebook /></PrivateRoute>}
          />
          <Route
            path="/areas"
            element={<PrivateRoute><Areas /></PrivateRoute>}
          />
          <Route
            path="/social/friends/:userId"
            element={<PrivateRoute><FriendProfile /></PrivateRoute>}
          />
          <Route
            path="/social/notes/:ownerId"
            element={<PrivateRoute><FriendNotes /></PrivateRoute>}
          />
          <Route
            path="/social/notes/:ownerId/:entryId"
            element={<PrivateRoute><FriendNoteEntry /></PrivateRoute>}
          />
          <Route
            path="/social"
            element={<PrivateRoute><Social /></PrivateRoute>}
          />
          <Route
            path="/task-packs"
            element={<PrivateRoute><TaskPacks /></PrivateRoute>}
          />
          <Route
            path="/packs/:code"
            element={<PrivateRoute><ImportTaskPack /></PrivateRoute>}
          />
          <Route path="/shared-with-me" element={<Navigate to="/social" replace />} />
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

          {/* /areas é para todos (oficiais + pessoais); só as páginas abaixo são admin. */}
          <Route element={<AdminRoute />}>
            <Route path="/users" element={<Users />} />
            <Route path="/users/:userId" element={<AdminUserProfile />} />
            <Route path="/security" element={<Security />} />
            <Route path="/appeals" element={<Appeals />} />
            <Route path="/feedback" element={<FeedbackAdmin />} />
            <Route path="/friend-code-requests" element={<FriendCodeRequestsAdmin />} />
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
      <CommandPaletteHost />
      {/* Same pattern as CommandPalette above: mounted once, gated
          internally (isAuthenticated + an active session), so it stays
          visible across every navigation instead of remounting per page
          the way it would if it lived inside PageLayout instead. */}
      <GlobalStudyTimerHost />
      <RoutePrefetcher />
      {/* Montado uma vez: abre sozinho a pedir Confirm/Deny quando o
          horário, os turnos ou o plano mudam e o Google Calendar está
          ligado. Gated internamente por isAuthenticated. */}
      <CalendarSyncReviewModal />
      {/* Pede as notificacoes uma vez, logo ao entrar com sessao iniciada
          (gated por dentro). Depois a escolha vive no Profile. */}
      <PushPermissionPrompt />
    </BrowserRouter>
  );
}
