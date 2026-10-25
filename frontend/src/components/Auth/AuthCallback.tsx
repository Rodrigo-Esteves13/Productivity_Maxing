import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import { fetchCsrfToken } from '../../api/userService';
import { refreshCalendarStatus } from '../../hooks/useCalendarStatus';
import { useI18n } from '../../i18n/useI18n';
import { fillNodes } from '../../i18n/fillNodes';

const AccountBlockedPage = lazy(() => import('../AccountBlocked/AccountBlockedPage'));

// Token de recurso que o OAuthConflictRedirectFilter poe no fragmento
// (#appeal=...) quando a conta esta banida/suspensa. Lido uma vez e tirado
// da barra de endereco, para nao ficar no historico.
function takeAppealTokenFromHash(): string | null {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const token = params.get('appeal');
  if (token) {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }
  return token;
}

export default function AuthCallback() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  // Evita disparar o pedido duas vezes no StrictMode (dev) / re-renders.
  const hasRun = useRef(false);
  const [conflictEmail, setConflictEmail] = useState<string | null>(null);
  const [appealToken, setAppealToken] = useState<string | null>(null);
  const [genericError, setGenericError] = useState<{ stillAuthenticated: boolean } | null>(
    null,
  );

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    // O OAuthConflictRedirectFilter no backend redireciona para aqui com
    // ?error=account_conflict&email=... quando o mesmo email já tem conta
    // por outro método - mostramos uma mensagem clara em vez de tentar
    // continuar o login (que ia falhar de qualquer forma, sem sessão).
    const error = searchParams.get('error');
    if (error === 'account_conflict') {
      setConflictEmail(searchParams.get('email'));
      return;
    }
    // Conta banida/suspensa: mesmo ecra de bloqueio + recurso do login por
    // password (Login.tsx). Sem token cai no erro generico abaixo.
    if (error === 'account_blocked') {
      const token = takeAppealTokenFromHash();
      if (token) {
        setAppealToken(token);
      } else {
        setGenericError({ stillAuthenticated: false });
      }
      return;
    }

    (async () => {
      // ?error=oauth_failed - qualquer outro erro do fluxo OAuth (ex: falha
      // a ligar o Google Calendar). Se o pedido partiu de um fluxo "link"
      // (login/link-calendar exigem sessão prévia via JwtAuthGuard), o
      // cookie de sessão original nunca chegou a ser tocado - por isso
      // tentamos sempre buscar um csrf token para saber se ainda há sessão
      // válida, em vez de assumir logout.
      if (error === 'oauth_failed') {
        try {
          const csrfToken = await fetchCsrfToken();
          login(csrfToken);
          setGenericError({ stillAuthenticated: true });
        } catch {
          setGenericError({ stillAuthenticated: false });
        }
        return;
      }

      try {
        // O backend já definiu o cookie de sessão HttpOnly antes deste
        // redirect - só falta ir buscar um csrf token para o resto da app
        // poder fazer pedidos que alteram estado.
        const csrfToken = await fetchCsrfToken();
        login(csrfToken);
        // Invalida a cache do useCalendarStatus - cobre tanto o login normal
        // (nada muda) como o regresso do fluxo /auth/google/link-calendar
        // (aqui sim, o estado real mudou de "not connected" para "connected").
        refreshCalendarStatus();
        navigate('/dashboard', { replace: true });
      } catch {
        navigate('/login', { replace: true });
      }
    })();
  }, [navigate, login, searchParams]);

  if (appealToken) {
    return (
      <Suspense fallback={null}>
        <AccountBlockedPage bearerToken={appealToken} />
      </Suspense>
    );
  }

  if (genericError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-950 px-4">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold text-neutral-100 mb-3">
            {t('common.error.title')}
          </h1>
          <p className="text-neutral-400 mb-6">
            {t('auth.callback.errorBody')}
          </p>
          <Link
            to={genericError.stillAuthenticated ? '/profile' : '/login'}
            className="inline-block rounded-md bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-2 transition-colors"
          >
            {genericError.stillAuthenticated ? t('auth.callback.backToProfile') : t('auth.backToLogin')}
          </Link>
        </div>
      </div>
    );
  }

  if (conflictEmail) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-950 px-4">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold text-neutral-100 mb-3">
            {t('auth.callback.conflictTitle')}
          </h1>
          <p className="text-neutral-400 mb-6">
            {fillNodes(t('auth.callback.conflictBody'), { email: <strong>{conflictEmail}</strong> })}
          </p>
          <Link
            to="/login"
            className="inline-block rounded-md bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-2 transition-colors"
          >
            {t('auth.backToLogin')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-neutral-950">
      <p className="text-neutral-400 animate-pulse">{t('auth.callback.authenticating')}</p>
    </div>
  );
}