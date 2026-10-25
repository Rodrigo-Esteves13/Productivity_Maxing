import type { LanguageCode } from '../i18n/languages';

// Numeros de emergencia e de apoio (saude mental, intoxicacoes, linha de
// saude) por pais. So entram numeros confirmados numa fonte oficial ou em
// varias fontes publicas; na duvida, fica de fora. Numeros e horarios
// mudam: rever SUPPORT_LINES_REVIEWED_AT periodicamente.
export const SUPPORT_LINES_REVIEWED_AT = '2026-10-24';

// Diretorio internacional de linhas de apoio, para paises fora da lista.
export const INTERNATIONAL_HELPLINES_URL = 'https://findahelpline.com';

export type SupportLineKind = 'EMERGENCY' | 'MENTAL_HEALTH' | 'POISON' | 'HEALTH_ADVICE';

export interface SupportLine {
  kind: SupportLineKind;
  // Nome proprio do servico (nao se traduz).
  name: string;
  number: string;
}

export const SUPPORT_LINES: Record<string, SupportLine[]> = {
  PT: [
    { kind: 'EMERGENCY', name: 'INEM', number: '112' },
    { kind: 'HEALTH_ADVICE', name: 'SNS 24', number: '808 24 24 24' },
    { kind: 'MENTAL_HEALTH', name: 'SOS Voz Amiga', number: '213 544 545' },
    { kind: 'POISON', name: 'CIAV (INEM)', number: '800 250 250' },
  ],
  BR: [
    { kind: 'EMERGENCY', name: 'SAMU', number: '192' },
    { kind: 'MENTAL_HEALTH', name: 'CVV', number: '188' },
  ],
  ES: [
    { kind: 'EMERGENCY', name: 'Emergencias', number: '112' },
    { kind: 'MENTAL_HEALTH', name: 'Línea 024', number: '024' },
  ],
  FR: [
    { kind: 'EMERGENCY', name: 'Urgences', number: '112' },
    { kind: 'EMERGENCY', name: 'SAMU', number: '15' },
    { kind: 'MENTAL_HEALTH', name: '3114', number: '3114' },
  ],
  DE: [
    { kind: 'EMERGENCY', name: 'Notruf', number: '112' },
    { kind: 'MENTAL_HEALTH', name: 'TelefonSeelsorge', number: '0800 111 0 111' },
    { kind: 'MENTAL_HEALTH', name: 'TelefonSeelsorge', number: '0800 111 0 222' },
  ],
  GB: [
    { kind: 'EMERGENCY', name: 'Emergency', number: '999' },
    { kind: 'HEALTH_ADVICE', name: 'NHS 111', number: '111' },
    { kind: 'MENTAL_HEALTH', name: 'Samaritans', number: '116 123' },
  ],
  IE: [
    { kind: 'EMERGENCY', name: 'Emergency', number: '112' },
    { kind: 'MENTAL_HEALTH', name: 'Samaritans', number: '116 123' },
  ],
  US: [
    { kind: 'EMERGENCY', name: 'Emergency', number: '911' },
    { kind: 'MENTAL_HEALTH', name: '988 Suicide & Crisis Lifeline', number: '988' },
    { kind: 'POISON', name: 'Poison Help', number: '1-800-222-1222' },
  ],
  CA: [
    { kind: 'EMERGENCY', name: 'Emergency', number: '911' },
    { kind: 'MENTAL_HEALTH', name: '9-8-8 Suicide Crisis Helpline', number: '988' },
  ],
  AU: [
    { kind: 'EMERGENCY', name: 'Emergency', number: '000' },
    { kind: 'MENTAL_HEALTH', name: 'Lifeline', number: '13 11 14' },
  ],
  NZ: [
    { kind: 'EMERGENCY', name: 'Emergency', number: '111' },
    { kind: 'MENTAL_HEALTH', name: '1737 Need to talk?', number: '1737' },
  ],
  JP: [
    { kind: 'EMERGENCY', name: '救急', number: '119' },
    { kind: 'MENTAL_HEALTH', name: 'よりそいホットライン', number: '0120-279-338' },
  ],
  KR: [
    { kind: 'EMERGENCY', name: '119', number: '119' },
    { kind: 'MENTAL_HEALTH', name: '자살예방 상담전화', number: '109' },
  ],
  CN: [
    { kind: 'EMERGENCY', name: '急救', number: '120' },
    { kind: 'MENTAL_HEALTH', name: '心理援助热线', number: '12356' },
  ],
};

export const SUPPORT_COUNTRIES = Object.keys(SUPPORT_LINES);

// Pais por defeito sem pedir a localizacao: a regiao das linguas do browser
// (ex: "pt-BR"), senao o pais mais provavel da lingua da app.
const COUNTRY_BY_LANGUAGE: Record<LanguageCode, string> = {
  en: 'GB',
  pt: 'PT',
  es: 'ES',
  fr: 'FR',
  de: 'DE',
  ja: 'JP',
  ko: 'KR',
  zh: 'CN',
};

export function guessSupportCountry(lang: LanguageCode, browserLanguages: readonly string[]): string {
  for (const tag of browserLanguages) {
    const region = tag.split('-')[1]?.toUpperCase();
    if (region && SUPPORT_LINES[region]) return region;
  }
  return COUNTRY_BY_LANGUAGE[lang];
}

// "tel:" sem espacos nem hifens.
export const telHref = (number: string) => `tel:${number.replace(/[^\d+]/g, '')}`;
