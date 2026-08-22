import { useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { getUserProfile, fetchCsrfToken, logoutRequest } from '../api/userService';
import { setCsrfToken } from '../api/csrfStore';
import type { User } from '../types/models';
import { AuthContext } from './auth-context';

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

  const refreshUser = useCallback(async () => {
    setIsLoadingUser(true);
    try {
      const data = await getUserProfile();
      setUser(data);
    } catch (err) {
      console.error('Failed to load user profile:', err);
      setUser(null);
    } finally {
      setIsLoadingUser(false);
    }
  }, []);

  // No arranque da app (e em qualquer refresh de página), tenta obter um
  // csrf token novo. Só funciona se o cookie access_token ainda for válido,
  // por isso serve também para descobrir se a sessão continua ativa.
  useEffect(() => {
    (async () => {
      try {
        const csrfToken = await fetchCsrfToken();
        setCsrfToken(csrfToken);
        setIsAuthenticated(true);
        await refreshUser();
      } catch {
        setCsrfToken(null);
        setIsAuthenticated(false);
        setUser(null);
      } finally {
        setIsAuthLoading(false);
      }
    })();
  }, [refreshUser]);

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
    setCsrfToken(csrfToken);
    setIsAuthenticated(true);
    refreshUser();
  }, [refreshUser]);

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } catch (err) {
      console.error('Logout request failed (clearing local state anyway):', err);
    } finally {
      setCsrfToken(null);
      setIsAuthenticated(false);
      setUser(null);
    }
  }, []);

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
