import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { I18nContext, type TranslateVars } from './i18n-context';
import { type LanguageCode } from './languages';
import { applyLanguage, detectLanguage, saveLanguage } from './storage';
import { translateIn } from './dictionaries';

export default function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<LanguageCode>(detectLanguage);

  const setLang = useCallback((code: LanguageCode) => {
    saveLanguage(code);
    applyLanguage(code);
    setLangState(code);
  }, []);

  const t = useCallback(
    (key: string, vars?: TranslateVars) => translateIn(lang, key, vars),
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
