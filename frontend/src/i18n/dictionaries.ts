import type { LanguageCode } from './languages';

export type Dictionary = Record<string, string>;
export type TranslateVars = Record<string, string | number>;

// Todas as linguas (incluindo o ingles) sao chunks separados: o browser so
// descarrega a que o utilizador usa. O ingles deixou de ir no bundle principal
// (eram ~110 KB que um utilizador em PT nunca usava); a paridade de chaves e
// garantida por scripts/check-i18n.mjs, por isso nao e preciso como fallback
// sempre carregado. Se estiver carregado (ex: depois de uma falha de rede na
// lingua escolhida), continua a servir de fallback.
const LOADERS: Record<LanguageCode, () => Promise<Dictionary>> = {
  en: () => import('./messages/en').then((m) => m.en),
  pt: () => import('./messages/pt').then((m) => m.pt),
  es: () => import('./messages/es').then((m) => m.es),
  zh: () => import('./messages/zh').then((m) => m.zh),
  ja: () => import('./messages/ja').then((m) => m.ja),
  ko: () => import('./messages/ko').then((m) => m.ko),
  fr: () => import('./messages/fr').then((m) => m.fr),
  de: () => import('./messages/de').then((m) => m.de),
};

const loaded = new Map<LanguageCode, Dictionary>();

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
const loading = new Map<LanguageCode, Promise<Dictionary>>();

export function isLoaded(lang: LanguageCode): boolean {
  return loaded.has(lang);
}

// Carrega (uma unica vez) o dicionario de uma lingua. Rejeita se o chunk falhar
// (ex: sem rede): quem chama decide o que fazer.
export function loadDictionary(lang: LanguageCode): Promise<Dictionary> {
  const done = loaded.get(lang);
  if (done) return Promise.resolve(done);
  let pending = loading.get(lang);
  if (!pending) {
    pending = LOADERS[lang]()
      .then((dict) => {
        loaded.set(lang, dict);
        return dict;
      })
      .finally(() => loading.delete(lang));
    loading.set(lang, pending);
  }
  return pending;
}

// Falta de chave na lingua (ou chunk ainda nao carregado) -> ingles, se ja
// estiver carregado -> textos minimos do ecra de erro -> a propria chave
// (nunca um texto vazio).
export function translateIn(
  lang: LanguageCode,
  key: string,
  vars?: TranslateVars,
): string {
  const template =
    loaded.get(lang)?.[key] ?? loaded.get('en')?.[key] ?? CORE_FALLBACK[key] ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    vars[name] !== undefined ? String(vars[name]) : `{${name}}`,
  );
}
