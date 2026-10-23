// Mesmas regras do PAD_SLUG_PATTERN do backend (pads.constants.ts):
// minusculas, digitos, - e _, ate 100 caracteres, a comecar por letra/digito.
export const PAD_SLUG_MAX_LENGTH = 100;
export const PAD_MAX_CONTENT_LENGTH = 100_000;
const PAD_SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]{0,99}$/;

/** "Física 1A" vira "fisica-1a". Vazio quando nao sobra nada valido. */
export function toPadSlug(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '')
    .replace(/^[-_]+/, '')
    .slice(0, PAD_SLUG_MAX_LENGTH);
}

export function isValidPadSlug(slug: string): boolean {
  return PAD_SLUG_PATTERN.test(slug);
}
