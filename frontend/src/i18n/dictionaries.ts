import type { LanguageCode } from './languages';
import { en } from './messages/en';

export type Dictionary = Record<string, string>;
export type TranslateVars = Record<string, string | number>;

// So o ingles vai no bundle principal (e o fallback de qualquer chave em falta).
// As outras linguas sao chunks separados: o browser so descarrega a que o
// utilizador usa, e mais nenhuma ate ele mudar de lingua.
const LOADERS: Record<LanguageCode, () => Promise<Dictionary>> = {
  en: () => Promise.resolve(en),
  pt: () => import('./messages/pt').then((m) => m.pt),
  es: () => import('./messages/es').then((m) => m.es),
  zh: () => import('./messages/zh').then((m) => m.zh),
  ja: () => import('./messages/ja').then((m) => m.ja),
  ko: () => import('./messages/ko').then((m) => m.ko),
  fr: () => import('./messages/fr').then((m) => m.fr),
  de: () => import('./messages/de').then((m) => m.de),
};

const loaded = new Map<LanguageCode, Dictionary>([['en', en]]);
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

// Falta de chave na lingua (ou chunk ainda nao carregado) -> ingles -> a
// propria chave (nunca um texto vazio).
export function translateIn(
  lang: LanguageCode,
  key: string,
  vars?: TranslateVars,
): string {
  const template = loaded.get(lang)?.[key] ?? en[key] ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    vars[name] !== undefined ? String(vars[name]) : `{${name}}`,
  );
}
