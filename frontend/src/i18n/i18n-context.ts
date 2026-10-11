import { createContext } from 'react';
import type { LanguageCode } from './languages';

export type TranslateVars = Record<string, string | number>;

export interface I18nContextValue {
  lang: LanguageCode;
  setLang: (code: LanguageCode) => void;
  // t('nav.tasks'), t('login.hello', { name }) -> "Hello, {name}"
  t: (key: string, vars?: TranslateVars) => string;
}

export const I18nContext = createContext<I18nContextValue | null>(null);
