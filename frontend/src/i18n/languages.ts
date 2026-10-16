export type LanguageCode = 'en' | 'pt' | 'es' | 'zh' | 'ja' | 'ko' | 'fr' | 'de';

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
  { code: 'zh', label: '简体中文', dir: 'ltr' },
  { code: 'ja', label: '日本語', dir: 'ltr' },
  { code: 'ko', label: '한국어', dir: 'ltr' },
  { code: 'fr', label: 'Français', dir: 'ltr' },
  { code: 'de', label: 'Deutsch', dir: 'ltr' },
];

export const DEFAULT_LANGUAGE: LanguageCode = 'en';
