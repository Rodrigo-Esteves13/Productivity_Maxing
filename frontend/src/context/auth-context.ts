import { createContext } from 'react';
import type { User } from '../types/models';

export interface AuthContextType {
  isAuthenticated: boolean;
  // true enquanto ainda não sabemos se há uma sessão válida (a verificar o
  // cookie via /auth/csrf no arranque da app). As rotas protegidas usam
  // isto para não expulsar o utilizador para /login por engano durante essa
  // fração de segundo.
  isAuthLoading: boolean;
  user: User | null;
  isLoadingUser: boolean;
  login: (csrfToken: string) => void;
  logout: () => Promise<void>;
  updateUser: (user: User) => void;
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
