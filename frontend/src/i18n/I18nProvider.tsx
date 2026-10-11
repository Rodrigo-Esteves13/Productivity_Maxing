import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { I18nContext, type TranslateVars } from './i18n-context';
import { type LanguageCode } from './languages';
import { applyLanguage, detectLanguage, saveLanguage } from './storage';
import { en } from './messages/en';
import { pt } from './messages/pt';
import { es } from './messages/es';

const DICTIONARIES: Record<LanguageCode, Record<string, string>> = { en, pt, es };

export default function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<LanguageCode>(detectLanguage);

  const setLang = useCallback((code: LanguageCode) => {
    saveLanguage(code);
    applyLanguage(code);
    setLangState(code);
  }, []);

  // Falta de chave na lingua escolhida -> ingles -> a propria chave (nunca
  // fica um texto vazio na UI).
  const t = useCallback(
    (key: string, vars?: TranslateVars) => {
      const template = DICTIONARIES[lang][key] ?? en[key] ?? key;
      if (!vars) return template;
      return template.replace(/\{(\w+)\}/g, (_, name: string) =>
        vars[name] !== undefined ? String(vars[name]) : `{${name}}`,
      );
    },
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
