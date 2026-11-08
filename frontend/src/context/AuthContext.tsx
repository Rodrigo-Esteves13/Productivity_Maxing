import { useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from 'react';
import { getUserProfile, fetchCsrfToken, logoutRequest } from '../api/userService';
import { setCsrfToken, setSessionUserId } from '../api/csrfStore';
import { unsubscribeThisDevice } from '../hooks/usePushNotifications';
import { clearPushPromptAnswered } from '../pwa/pushPromptStorage';
import { resetCalendarStatus } from '../hooks/useCalendarStatus';
import type { User } from '../types/models';
import { AuthContext } from './auth-context';

const SESSION_CHECK_RETRIES = 3;
const SESSION_CHECK_RETRY_MS = 1000;
const TRANSIENT_STATUS_MIN = 500;
const HTTP_TOO_MANY_REQUESTS = 429;

function isTransientError(err: unknown): boolean {
  const status = (err as { response?: { status?: number } })?.response?.status;
  return status === undefined ? (err as { code?: string })?.code !== undefined : status >= TRANSIENT_STATUS_MIN || status === HTTP_TOO_MANY_REQUESTS;
}

// Falha passageira (rede ainda a acordar depois de a tab/PC ter estado
// suspenso, 429, 5xx): a sessao pode estar valida, por isso tenta de novo.
// Um 401/erro definitivo, ou uma verificacao que ja nao e a atual, propaga.
async function withTransientRetry<T>(fn: () => Promise<T>, isCurrent: () => boolean): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!isTransientError(err) || attempt >= SESSION_CHECK_RETRIES || !isCurrent()) throw err;
      await new Promise((resolve) => setTimeout(resolve, SESSION_CHECK_RETRY_MS * (attempt + 1)));
    }
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Já não há nada para ler de forma síncrona (o cookie de sessão é
  // HttpOnly, logo invisível ao JS) - o estado inicial começa "a carregar"
  // e só se resolve depois da chamada a /auth/csrf no useEffect abaixo.
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);

  // Dados reais do utilizador (nome, avatar, role, etc.), partilhados por
  // toda a app (Navbar, Profile, ...) para não andarmos a repetir fetches.
  const [user, setUser] = useState<User | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState<boolean>(false);
  // Lido no logout sem o pôr nas deps (o logout tem de ficar estável).
  const userIdRef = useRef<string | null>(null);
  useEffect(() => {
    userIdRef.current = user?.id ?? null;
    // O cliente HTTP usa-o para nao repetir pedidos noutra conta (F-05).
    setSessionUserId(user?.id ?? null);
  }, [user]);

  const isAuthenticatedRef = useRef(false);
  useEffect(() => {
    isAuthenticatedRef.current = isAuthenticated;
  }, [isAuthenticated]);
  // Cada verificacao de sessao (e cada login/logout) recebe uma geracao nova;
  // o resultado de uma verificacao mais antiga e ignorado.
  const generationRef = useRef(0);
  // Verificacao a decorrer: um recheck enquanto ela repete reaproveita-a.
  const inFlightCheckRef = useRef<Promise<void> | null>(null);

  // Perfil com as mesmas repeticoes passageiras que a sessao. Um 5xx que
  // persiste nao apaga o user ja conhecido; um erro definitivo (401...) sim
  // (o interceptor global trata do logout).
  const loadProfile = useCallback(async (isCurrent: () => boolean) => {
    setIsLoadingUser(true);
    try {
      const data = await withTransientRetry(getUserProfile, isCurrent);
      if (isCurrent()) setUser(data);
    } catch (err) {
      if (!isCurrent()) return;
      console.error('Failed to load user profile:', err);
      if (!isTransientError(err)) setUser(null);
    } finally {
      if (isCurrent()) setIsLoadingUser(false);
    }
  }, []);

  // Ignorado se entretanto houver login/logout ou nova verificacao.
  const refreshUser = useCallback(() => {
    const generation = generationRef.current;
    return loadProfile(() => generation === generationRef.current);
  }, [loadProfile]);

  // No arranque da app (e em qualquer refresh de página), tenta obter um
  // csrf token novo. Só funciona se o cookie access_token ainda for válido,
  // por isso serve também para descobrir se a sessão continua ativa.
  const checkSession = useCallback((): Promise<void> => {
    if (inFlightCheckRef.current) return inFlightCheckRef.current;
    const generation = ++generationRef.current;
    const isCurrent = () => generation === generationRef.current;
    const run = (async () => {
      try {
        const csrfToken = await withTransientRetry(fetchCsrfToken, isCurrent);
        if (!isCurrent()) return;
        setCsrfToken(csrfToken);
        isAuthenticatedRef.current = true;
        setIsAuthenticated(true);
      } catch {
        // Login entretanto: esta falha ja nao diz nada sobre a sessao atual.
        if (!isCurrent() || isAuthenticatedRef.current) return;
        setCsrfToken(null);
        setIsAuthenticated(false);
        setUser(null);
        setIsLoadingUser(false);
        return;
      }
      await loadProfile(isCurrent);
    })();
    inFlightCheckRef.current = run;
    void run.finally(() => {
      if (inFlightCheckRef.current === run) inFlightCheckRef.current = null;
    });
    return run;
  }, [loadProfile]);

  // Login/logout tornam qualquer verificacao a decorrer obsoleta.
  const invalidateChecks = useCallback(() => {
    generationRef.current++;
    inFlightCheckRef.current = null;
  }, []);

  useEffect(() => {
    checkSession().finally(() => setIsAuthLoading(false));
  }, [checkSession]);

  // Tab que volta de suspensa (ou rede que volta) sem sessao conhecida:
  // volta a perguntar ao backend, o cookie pode continuar valido.
  useEffect(() => {
    const recheck = () => {
      if (document.visibilityState === 'visible' && !isAuthenticatedRef.current) void checkSession();
    };
    document.addEventListener('visibilitychange', recheck);
    window.addEventListener('online', recheck);
    return () => {
      document.removeEventListener('visibilitychange', recheck);
      window.removeEventListener('online', recheck);
    };
  }, [checkSession]);

  // Chamado pelo Login/Register/AuthCallback assim que o backend confirma a
  // sessão e devolve um csrfToken.
  //
  // useCallback aqui (e em logout/updateUser abaixo) não é só estilo -
  // sem isto, o `value` do Provider (ver useMemo mais abaixo) nunca fica
  // realmente estável: mesmo memoizado, um useMemo com uma função nova em
  // cada render nas suas deps invalida-se em todo o render à mesma. Era
  // exatamente isto que estava a acontecer: cada render do AuthProvider
  // (o que acontece várias vezes durante o próprio fluxo de login -
  // fetchCsrfToken -> setIsAuthenticated -> refreshUser ->
  // setIsLoadingUser) recriava um objeto `value` novo, e um Context.
  // Provider novo valor = TODOS os consumidores de useAuth() em baixo
  // (PageLayout, Navbar, todas as páginas dentro de PrivateRoute,
  // CommandPalette, ...) re-renderizam, mesmo os que não têm nada a ver
  // com auth. É isto que dava a sensação de "a app inteira faz rebuild"
  // sempre que alguém entra na conta.
  const login = useCallback((csrfToken: string) => {
    // Caches de modulo sao de um utilizador: nova sessao, cache limpa (F-07).
    resetCalendarStatus();
    // Uma verificacao antiga (ainda a repetir) ja nao pode desfazer este login.
    invalidateChecks();
    setCsrfToken(csrfToken);
    isAuthenticatedRef.current = true;
    setIsAuthenticated(true);
    setIsAuthLoading(false);
    void refreshUser();
  }, [invalidateChecks, refreshUser]);

  const logout = useCallback(async () => {
    // Antes do logout (precisa da sessão): o dispositivo deixa de receber os
    // avisos desta conta. Melhor esforço, nunca impede o logout.
    try {
      const hadPush = await unsubscribeThisDevice();
      if (hadPush && userIdRef.current) clearPushPromptAnswered(userIdRef.current);
    } catch (err) {
      console.error('Push unsubscribe on logout failed:', err);
    }
    try {
      await logoutRequest();
    } catch (err) {
      console.error('Logout request failed (clearing local state anyway):', err);
    } finally {
      invalidateChecks();
      setCsrfToken(null);
      resetCalendarStatus();
      isAuthenticatedRef.current = false;
      setIsAuthenticated(false);
      setUser(null);
      setIsLoadingUser(false);
    }
  }, [invalidateChecks]);

  // Permite atualizar o user em memória imediatamente após um PATCH ao perfil,
  // sem precisar de um novo pedido GET.
  const updateUser = useCallback((updated: User) => {
    setUser(updated);
  }, []);

  const value = useMemo(
    () => ({
      isAuthenticated,
      isAuthLoading,
      user,
      isLoadingUser,
      login,
      logout,
      updateUser,
      refreshUser,
    }),
    [isAuthenticated, isAuthLoading, user, isLoadingUser, login, logout, updateUser, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
