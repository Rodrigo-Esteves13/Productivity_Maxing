// Nome de um codigo de lingua na lingua da app; um codigo que o browser nao
// conhece (vem do cliente) aparece como esta.
export function languageName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'language' }).of(code) ?? code;
  } catch {
    return code;
  }
}
