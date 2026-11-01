import { createContext } from 'react';

export interface PrivacyModeValue {
  /** true = valores de dinheiro escondidos no ecra. */
  enabled: boolean;
  toggle: () => void;
}

// Sem provider (testes, outras paginas) o modo esta desligado.
export const PrivacyModeContext = createContext<PrivacyModeValue>({ enabled: false, toggle: () => undefined });
