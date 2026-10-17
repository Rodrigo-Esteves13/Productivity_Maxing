import type { LanguageCode } from './languages';
import { en } from './messages/en';
import { pt } from './messages/pt';
import { es } from './messages/es';
import { zh } from './messages/zh';
import { ja } from './messages/ja';
import { ko } from './messages/ko';
import { fr } from './messages/fr';
import { de } from './messages/de';

export const DICTIONARIES: Record<LanguageCode, Record<string, string>> = { en, pt, es, zh, ja, ko, fr, de };

export type TranslateVars = Record<string, string | number>;

// Falta de chave na lingua -> ingles -> a propria chave (nunca um texto vazio).
export function translateIn(
  lang: LanguageCode,
  key: string,
  vars?: TranslateVars,
): string {
  const template = DICTIONARIES[lang][key] ?? en[key] ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    vars[name] !== undefined ? String(vars[name]) : `{${name}}`,
  );
}
