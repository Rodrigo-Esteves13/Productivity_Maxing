import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { I18nContext } from './i18n-context';
import { DEFAULT_LANGUAGE, type LanguageCode } from './languages';
import { applyLanguage, detectLanguage, saveLanguage } from './storage';
import {
  createTranslator,
  getDictionaryVersion,
  isCoreLoaded,
  loadCoreDictionary,
  loadFullDictionary,
  subscribeDictionaries,
} from './dictionaries';

// Comeca a descarregar o nucleo da lingua guardada ja ao avaliar o modulo, em
// paralelo com o resto da app (nao so depois do primeiro render).
void loadCoreDictionary(detectLanguage()).catch(() => undefined);

export default function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<LanguageCode>(detectLanguage);
  const [ready, setReady] = useState(() => isCoreLoaded(lang));
  const dictionaryVersion = useSyncExternalStore(subscribeDictionaries, getDictionaryVersion);

  // Primeira carga: espera so pelo NUCLEO da lingua ativa (o codigo de
  // arranque so usa chaves dele) para nao piscar em ingles. Se falhar
  // (offline e sem cache), tenta o ingles; se nem esse chegar, segue na mesma
  // em vez de bloquear a app.
  useEffect(() => {
    if (ready) return;
    let cancelled = false;
    loadCoreDictionary(lang)
      .catch(() => loadCoreDictionary(DEFAULT_LANGUAGE))
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [lang, ready]);

  // Logo a seguir ao nucleo: o resto da lingua, para as paginas (que esperam
  // por ele em lazyWithPreload) ja o encontrarem carregado.
  useEffect(() => {
    if (!ready) return;
    void loadFullDictionary(lang).catch(() => undefined);
  }, [lang, ready]);

  // Mudar de lingua: so troca depois de o dicionario novo chegar INTEIRO
  // (nucleo e resto). Se falhar, fica na lingua atual (nada de meio-traduzido).
  const setLang = useCallback((code: LanguageCode) => {
    void loadFullDictionary(code)
      .then(() => {
        saveLanguage(code);
        applyLanguage(code);
        setLangState(code);
      })
      .catch(() => undefined);
  }, []);

  const t = useMemo(() => createTranslator(lang, dictionaryVersion), [lang, dictionaryVersion]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  if (!ready) return null;
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
