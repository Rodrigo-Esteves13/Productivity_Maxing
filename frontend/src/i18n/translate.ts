import { detectLanguage } from './storage';
import { translateIn, type TranslateVars } from './dictionaries';

// Para codigo FORA da arvore React (ErrorBoundary, MaintenancePage, utils):
// le a lingua guardada no momento da chamada. Dentro de componentes usa
// sempre useI18n().t, que reage a mudancas de lingua.
export function translateNow(key: string, vars?: TranslateVars): string {
  return translateIn(detectLanguage(), key, vars);
}
