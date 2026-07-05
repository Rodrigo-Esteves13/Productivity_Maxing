import { createContext } from 'react';
import type { User } from '../types/models';

export interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  isLoadingUser: boolean;
  login: (token: string) => void;
  logout: () => void;
  updateUser: (user: User) => void;
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);