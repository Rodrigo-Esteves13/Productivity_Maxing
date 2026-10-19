import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { I18nContext, type TranslateVars } from './i18n-context';
import { type LanguageCode } from './languages';
import { applyLanguage, detectLanguage, saveLanguage } from './storage';
import { isLoaded, loadDictionary, translateIn } from './dictionaries';

// Comeca a descarregar a lingua guardada ja ao avaliar o modulo, em paralelo
// com o resto da app (nao so depois do primeiro render).
void loadDictionary(detectLanguage()).catch(() => undefined);

export default function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<LanguageCode>(detectLanguage);
  const [ready, setReady] = useState(() => isLoaded(lang));

  // Primeira carga: espera pelo dicionario da lingua ativa para nao piscar em
  // ingles. Se falhar (offline e sem cache), tenta o ingles; se nem esse
  // chegar, segue na mesma em vez de bloquear a app.
  useEffect(() => {
    if (ready) return;
    let cancelled = false;
    loadDictionary(lang)
      .catch(() => loadDictionary('en'))
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [lang, ready]);

  // Mudar de lingua: so troca depois de o dicionario novo chegar. Se falhar,
  // fica na lingua atual (nada de meio-traduzido).
  const setLang = useCallback((code: LanguageCode) => {
    void loadDictionary(code)
      .then(() => {
        saveLanguage(code);
        applyLanguage(code);
        setLangState(code);
      })
      .catch(() => undefined);
  }, []);

  const t = useCallback(
    (key: string, vars?: TranslateVars) => translateIn(lang, key, vars),
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  if (!ready) return null;
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
