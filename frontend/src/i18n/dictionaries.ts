import { DEFAULT_LANGUAGE, type LanguageCode } from './languages';
import { detectLanguage } from './storage';

export type Dictionary = Record<string, string>;
export type TranslateVars = Record<string, string | number>;
type Loader = () => Promise<Dictionary>;
export type DictionaryPart = 'core' | 'rest';
export type SplitLoaders = Record<DictionaryPart, Record<LanguageCode, Loader>>;

// Cada lingua vem em dois chunks (F-43), ambos so da lingua em uso:
// - core: as chaves do codigo de arranque (login, hosts globais, toasts,
//   utils com translateNow). O I18nProvider so espera por este antes do
//   primeiro render.
// - rest: o resto. Comeca a descarregar logo a seguir ao nucleo, e tudo o que
//   carrega por lazyWithPreload (paginas, paleta, modais pontuais) espera por
//   ele antes de montar.
// A divisao e calculada no build por scripts/i18n-split.ts. Sem o plugin (dev,
// testes) o core traz o dicionario inteiro e o rest vem vazio.
const LOADERS: SplitLoaders = {
  core: {
    en: () => import('./split/en.core').then((m) => m.dict),
    pt: () => import('./split/pt.core').then((m) => m.dict),
    es: () => import('./split/es.core').then((m) => m.dict),
    zh: () => import('./split/zh.core').then((m) => m.dict),
    ja: () => import('./split/ja.core').then((m) => m.dict),
    ko: () => import('./split/ko.core').then((m) => m.dict),
    fr: () => import('./split/fr.core').then((m) => m.dict),
    de: () => import('./split/de.core').then((m) => m.dict),
  },
  rest: {
    en: () => import('./split/en.rest').then((m) => m.dict),
    pt: () => import('./split/pt.rest').then((m) => m.dict),
    es: () => import('./split/es.rest').then((m) => m.dict),
    zh: () => import('./split/zh.rest').then((m) => m.dict),
    ja: () => import('./split/ja.rest').then((m) => m.dict),
    ko: () => import('./split/ko.rest').then((m) => m.dict),
    fr: () => import('./split/fr.rest').then((m) => m.dict),
    de: () => import('./split/de.rest').then((m) => m.dict),
  },
};

// So para o ecra de erro/manutencao, que pode aparecer antes de qualquer
// dicionario chegar: nunca mostra a chave crua.
const CORE_FALLBACK: Dictionary = {
  'common.reload': 'Reload',
  'common.tryAgain': 'Try again',
  'common.error.title': 'Something went wrong',
  'common.error.body': "The app hit an unexpected error. It's been reported - reloading usually fixes it.",
  'common.maintenance.title': 'Down for maintenance',
  'common.maintenance.body': "We're doing some quick upkeep. This shouldn't take long - check back in a few minutes.",
};

export function createDictionaryStore(loaders: SplitLoaders) {
  const parts: Record<DictionaryPart, Map<LanguageCode, Dictionary>> = { core: new Map(), rest: new Map() };
  const pending: Record<DictionaryPart, Map<LanguageCode, Promise<void>>> = { core: new Map(), rest: new Map() };
  // Nucleo + resto de cada lingua, ja juntos (o que o translateIn le).
  const merged = new Map<LanguageCode, Dictionary>();
  const listeners = new Set<() => void>();
  let version = 0;

  // Carrega (uma unica vez) uma parte. Rejeita se o chunk falhar (ex: sem
  // rede) e a proxima chamada volta a pedi-lo.
  function loadPart(part: DictionaryPart, lang: LanguageCode): Promise<void> {
    if (parts[part].has(lang)) return Promise.resolve();
    let request = pending[part].get(lang);
    if (!request) {
      request = loaders[part][lang]()
        .then((dict) => {
          parts[part].set(lang, dict);
          merged.set(lang, { ...parts.core.get(lang), ...parts.rest.get(lang) });
          version += 1;
          listeners.forEach((listener) => listener());
        })
        .finally(() => pending[part].delete(lang));
      pending[part].set(lang, request);
    }
    return request;
  }

  return {
    loadCore: (lang: LanguageCode) => loadPart('core', lang),
    // Nucleo e resto em paralelo.
    loadFull: (lang: LanguageCode) =>
      Promise.all([loadPart('core', lang), loadPart('rest', lang)]).then(() => undefined),
    isCoreLoaded: (lang: LanguageCode) => parts.core.has(lang),
    isFullLoaded: (lang: LanguageCode) => parts.core.has(lang) && parts.rest.has(lang),
    // Muda sempre que chega uma parte: o I18nProvider volta a renderizar.
    getVersion: () => version,
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    // Falta de chave na lingua (ou parte ainda nao carregada) -> ingles, se
    // ja estiver carregado -> textos minimos do ecra de erro -> a propria
    // chave (nunca um texto vazio).
    translateIn(lang: LanguageCode, key: string, vars?: TranslateVars): string {
      const template = merged.get(lang)?.[key] ?? merged.get(DEFAULT_LANGUAGE)?.[key] ?? CORE_FALLBACK[key] ?? key;
      if (!vars) return template;
      return template.replace(/\{(\w+)\}/g, (_, name: string) =>
        vars[name] !== undefined ? String(vars[name]) : `{${name}}`,
      );
    },
  };
}

const store = createDictionaryStore(LOADERS);

export const {
  loadCore: loadCoreDictionary,
  loadFull: loadFullDictionary,
  isCoreLoaded,
  isFullLoaded,
  getVersion: getDictionaryVersion,
  subscribe: subscribeDictionaries,
  translateIn,
} = store;

// Para quem monta codigo fora do nucleo (lazyWithPreload): dicionario inteiro
// da lingua guardada. Se falhar, tenta o ingles, como o primeiro render do
// I18nProvider; se nem esse chegar, rejeita (o componente trata como um chunk
// que falhou: ErrorBoundary, e o proximo pedido volta a tentar).
export function loadFullForActiveLanguage(): Promise<void> {
  return loadFullDictionary(detectLanguage()).catch(() => loadFullDictionary(DEFAULT_LANGUAGE));
}

// t() com uma identidade nova por lingua e por versao dos dicionarios: quando
// o resto chega, os componentes memoizados voltam a traduzir. A versao so
// entra como argumento para o memo (e o React Compiler) a contarem.
export function createTranslator(lang: LanguageCode, _dictionaryVersion: number) {
  return (key: string, vars?: TranslateVars) => translateIn(lang, key, vars);
}
