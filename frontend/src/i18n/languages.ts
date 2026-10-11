export type LanguageCode = 'en' | 'pt' | 'es';

export interface LanguageOption {
  code: LanguageCode;
  // Nome na propria lingua (e assim que o utilizador a reconhece).
  label: string;
  // Direcao do texto: pronto para idiomas RTL (ex: 'ar') - ver applyLanguage.
  dir: 'ltr' | 'rtl';
}

export const LANGUAGES: LanguageOption[] = [
  { code: 'en', label: 'English', dir: 'ltr' },
  { code: 'pt', label: 'Português', dir: 'ltr' },
  { code: 'es', label: 'Español', dir: 'ltr' },
];

export const DEFAULT_LANGUAGE: LanguageCode = 'en';
