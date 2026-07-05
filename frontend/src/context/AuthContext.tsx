import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { getUserProfile } from '../api/userService';
import type { User } from '../types/models';
import { AuthContext } from './auth-context';

export function AuthProvider({ children }: { children: ReactNode }) {
  // Inicializa o estado lendo o localStorage uma única vez
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(
    !!localStorage.getItem('token')
  );
  // Dados reais do utilizador (nome, avatar, role, etc.), partilhados por
  // toda a app (Navbar, Profile, ...) para não andarmos a repetir fetches.
  const [user, setUser] = useState<User | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState<boolean>(false);

  const refreshUser = useCallback(async () => {
    if (!localStorage.getItem('token')) {
      setUser(null);
      return;
    }
    setIsLoadingUser(true);
    try {
      const data = await getUserProfile();
      setUser(data);
    } catch (err) {
      console.error('Failed to load user profile:', err);
    } finally {
      setIsLoadingUser(false);
    }
  }, []);

  // Sempre que o estado de autenticação muda (login/logout/refresh da página),
  // vai buscar os dados reais do utilizador.
  useEffect(() => {
    if (isAuthenticated) {
      refreshUser();
    } else {
      setUser(null);
    }
  }, [isAuthenticated, refreshUser]);

  const login = (token: string) => {
    localStorage.setItem('token', token);
    setIsAuthenticated(true);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setIsAuthenticated(false);
    setUser(null);
  };

  // Permite atualizar o user em memória imediatamente após um PATCH ao perfil,
  // sem precisar de um novo pedido GET.
  const updateUser = (updated: User) => {
    setUser(updated);
  };

  return (
    <AuthContext.Provider
      value={{ isAuthenticated, user, isLoadingUser, login, logout, updateUser, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}