import { isValidPadSlug } from './padSlug';

// Ultimos pads abertos neste browser (so os nomes, que ja sao publicos).
export const PAD_RECENTS_STORAGE_KEY = 'pmaxing-pad-recents';
export const PAD_RECENTS_MAX = 8;

/** Nome novo vai para a frente; repetido nao duplica; maximo PAD_RECENTS_MAX. */
export function addPadRecent(list: readonly string[], slug: string, max: number = PAD_RECENTS_MAX): string[] {
  return [slug, ...list.filter((s) => s !== slug)].slice(0, max);
}

/** Le a lista guardada: ignora lixo, nomes invalidos e repetidos. */
export function parsePadRecents(raw: string | null, max: number = PAD_RECENTS_MAX): string[] {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    const out: string[] = [];
    for (const item of data) {
      if (typeof item === 'string' && isValidPadSlug(item) && !out.includes(item)) out.push(item);
    }
    return out.slice(0, max);
  } catch {
    return [];
  }
}

export function loadPadRecents(): string[] {
  try {
    return parsePadRecents(window.localStorage.getItem(PAD_RECENTS_STORAGE_KEY));
  } catch {
    return [];
  }
}

function savePadRecents(list: readonly string[]): void {
  try {
    window.localStorage.setItem(PAD_RECENTS_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Sem storage (modo privado): so perde o atalho.
  }
}

export function rememberPad(slug: string): void {
  if (!isValidPadSlug(slug)) return;
  savePadRecents(addPadRecent(loadPadRecents(), slug));
}

export function clearPadRecents(): void {
  savePadRecents([]);
}

/** true quando colar `pasted` no texto (a substituir `selected` caracteres) passa o limite. */
export function pasteExceedsLimit(currentLength: number, selected: number, pasted: number, max: number): boolean {
  return currentLength - selected + pasted > max;
}
