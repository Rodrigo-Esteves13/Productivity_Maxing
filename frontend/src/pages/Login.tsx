import { useState, type SyntheticEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { loginRequest, resendVerificationRequest } from '../api/userService';
import TwoFactorCodeForm from '../components/Auth/TwoFactorCodeForm';
import { useI18n } from '../i18n/useI18n';
import { isSafeRedirectPath } from '../lib/safeRedirect';
import PageLayout from '../components/Layout/PageLayout';
import Button from '../components/UI/Button';
import Input from '../components/UI/Input';
import FormError from '../components/UI/FormError';
import AuthCard from '../components/Auth/AuthCard';
import OAuthProviderList from '../components/Auth/OAuthProviderList';
import AuthSwitchLink from '../components/Auth/AuthSwitchLink';
import AccountBlockedPage from '../components/AccountBlocked/AccountBlockedPage';
import useSeo from '../hooks/useSeo';

interface BlockedLoginInfo {
  message: string;
  appealToken: string;
}

export default function Login() {
  const { t } = useI18n();
  useSeo({
    title: t('auth.seo.login'),
    description: 'Log in to Productivity Maxing to manage your academic tasks, deadlines, and grades.',
    path: '/login',
  });
  const navigate = useNavigate();
  const { login } = useAuth();
  const [searchParams] = useSearchParams();
  // e.g. Login reached from SharedNotebookEntry.tsx's "Log in" button on
  // an AUTHORIZED share, so the person lands back where they started
  // instead of the generic dashboard. Only ever trusted after
  // isSafeRedirectPath() below - see that helper for why.
  const redirectParam = searchParams.get('redirect');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  // Distinto de `error`: SUSPENDED/BANNED não é "credenciais erradas",
  // troca o formulário inteiro pelo mesmo ecrã de bloqueio usado a meio
  // de uma sessão (ver AccountBlockedGate.tsx) - só que aqui não existe
  // cookie nenhum ainda (o login falhou mesmo), por isso passamos o
  // appealToken de curta duração devolvido no próprio erro (ver
  // AuthService.accountBlockedResponse no backend).
  const [blockedInfo, setBlockedInfo] = useState<BlockedLoginInfo | null>(null);
  // Password certa mas email por verificar (so com a verificacao ligada no
  // backend): mostra aviso + botao de reenviar em vez de "credenciais invalidas".
  const [needsVerification, setNeedsVerification] = useState(false);
  // Conta com 2FA (so com TWO_FACTOR_ENABLED no backend): token do desafio.
  const [twoFactorToken, setTwoFactorToken] = useState<string | null>(null);
  const [resendMessage, setResendMessage] = useState('');

  const handleResend = async () => {
    setResendMessage('');
    try {
      await resendVerificationRequest(email);
      setResendMessage(t('auth.resendOk'));
    } catch {
      setResendMessage(t('auth.resendFailed'));
    }
  };

  const handleLogin = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault(); // Impede o browser de recarregar a página ao dar Enter!
    setError('');
    setNeedsVerification(false);
    setResendMessage('');

    try {
      const result = await loginRequest(email, password);
      if (result.requiresTwoFactor) {
        setTwoFactorToken(result.twoFactorToken);
        return;
      }
      const { csrfToken } = result;

      // Usa o hook para guardar o csrf token em memória e notificar a app
      login(csrfToken);
      const destination =
        redirectParam && isSafeRedirectPath(redirectParam) ? redirectParam : '/dashboard';
      navigate(destination, { replace: true });
    } catch (err) {
      const data = (err as { response?: { data?: Record<string, unknown> } })?.response?.data;
      if (data?.code === 'ACCOUNT_BLOCKED' && typeof data.appealToken === 'string') {
        setBlockedInfo({
          message: typeof data.message === 'string' ? data.message : t('auth.blockedDefault'),
          appealToken: data.appealToken,
        });
        return;
      }
      if (data?.code === 'EMAIL_NOT_VERIFIED') {
        setNeedsVerification(true);
        return;
      }
      setError(t('auth.invalidCredentials'));
    }
  };

  if (blockedInfo) {
    return (
      <AccountBlockedPage
        bearerToken={blockedInfo.appealToken}
        initialMessage={blockedInfo.message}
      />
    );
  }

  if (twoFactorToken) {
    return (
      <PageLayout>
        <AuthCard title={t('auth.twoFactorTitle')}>
          <TwoFactorCodeForm
            token={twoFactorToken}
            onSuccess={(csrfToken) => {
              login(csrfToken);
              const destination =
                redirectParam && isSafeRedirectPath(redirectParam) ? redirectParam : '/dashboard';
              navigate(destination, { replace: true });
            }}
          />
        </AuthCard>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <AuthCard title={t('auth.loginTitle')}>
        <form onSubmit={handleLogin} className="space-y-4">
          {error && <FormError message={error} />}
          {needsVerification && (
            <div className="rounded-lg border border-amber-800/50 bg-amber-900/10 p-3 text-sm text-amber-300">
              {t('auth.verifyPrompt')}
              <button
                type="button"
                onClick={handleResend}
                className="block mt-2 underline text-violet-400 hover:text-violet-300"
              >
                {t('auth.resendConfirmation')}
              </button>
              {resendMessage && <span className="block mt-1 text-xs text-neutral-400">{resendMessage}</span>}
            </div>
          )}

          <Input
            label={t('auth.email')}
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label={t('auth.password')}
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div className="text-right -mt-2">
            <Link to="/forgot-password" className="text-sm text-violet-400 hover:text-violet-300">
              {t('auth.forgotLink')}
            </Link>
          </div>

          <Button type="submit" className="w-full">
            {t('auth.login')}
          </Button>
        </form>

        <AuthSwitchLink question={t('auth.noAccount')} linkText={t('auth.signUp')} to="/register" />

        <OAuthProviderList message={t('auth.oauthLogin')} />
      </AuthCard>
    </PageLayout>
  );
}
