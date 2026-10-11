import { DEFAULT_LANGUAGE, LANGUAGES, type LanguageCode } from './languages';

const STORAGE_KEY = 'pmaxing-language';

function isLanguage(value: unknown): value is LanguageCode {
  return LANGUAGES.some((l) => l.code === value);
}

// Idioma guardado; senao o do browser (pt/es/en); senao ingles.
export function detectLanguage(): LanguageCode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isLanguage(stored)) return stored;
  } catch {
    // sem storage: segue para o browser
  }
  const browser = (typeof navigator !== 'undefined' ? navigator.language : '').slice(0, 2).toLowerCase();
  return isLanguage(browser) ? browser : DEFAULT_LANGUAGE;
}

export function saveLanguage(code: LanguageCode): void {
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    // best-effort
  }
}

// <html lang dir>: leitores de ecra pronunciam bem, e o layout fica pronto
// para RTL (o Tailwind tem as variantes rtl:/ltr:).
export function applyLanguage(code: LanguageCode): void {
  const option = LANGUAGES.find((l) => l.code === code);
  document.documentElement.lang = code;
  document.documentElement.dir = option?.dir ?? 'ltr';
}

export function applyStoredLanguage(): void {
  applyLanguage(detectLanguage());
}
