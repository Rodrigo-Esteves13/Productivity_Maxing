// Cor de destaque da app. O violeta e o valor por defeito e nao leva atributo
// no <html>; as restantes ativam um bloco de styles/accents.css que redefine
// as variaveis --color-violet-*. Sem verde de proposito.
export const ACCENT_IDS = ['violet', 'blue', 'cyan', 'pink', 'orange', 'red'] as const;
export type AccentId = (typeof ACCENT_IDS)[number];

export const DEFAULT_ACCENT: AccentId = 'violet';
export const ACCENT_STORAGE_KEY = 'accent-color';
export const ACCENT_ATTRIBUTE = 'data-accent';

// Cor da amostra no seletor (o tom 500 de cada escala; violet = Nightshade).
export const ACCENT_SWATCHES: Record<AccentId, string> = {
  violet: '#a52ff0',
  blue: '#3b82f6',
  cyan: '#06b6d4',
  pink: '#ec4899',
  orange: '#f97316',
  red: '#ef4444',
};

export function isAccentId(value: unknown): value is AccentId {
  return typeof value === 'string' && (ACCENT_IDS as readonly string[]).includes(value);
}

// Valor guardado desconhecido, corrompido ou vazio cai no violeta.
export function parseStoredAccent(raw: string | null | undefined): AccentId {
  return isAccentId(raw) ? raw : DEFAULT_ACCENT;
}

export function loadAccent(): AccentId {
  try {
    return parseStoredAccent(localStorage.getItem(ACCENT_STORAGE_KEY));
  } catch {
    return DEFAULT_ACCENT;
  }
}

export function saveAccent(accent: AccentId): void {
  try {
    if (accent === DEFAULT_ACCENT) localStorage.removeItem(ACCENT_STORAGE_KEY);
    else localStorage.setItem(ACCENT_STORAGE_KEY, accent);
  } catch {
    // Sem storage a preferencia so nao sobrevive a recargas.
  }
}

export function applyAccent(accent: AccentId): void {
  const root = document.documentElement;
  if (accent === DEFAULT_ACCENT) root.removeAttribute(ACCENT_ATTRIBUTE);
  else root.setAttribute(ACCENT_ATTRIBUTE, accent);
}

// Chamado antes do primeiro render (main.tsx) para nao haver flash de violeta.
export function applyStoredAccent(): void {
  applyAccent(loadAccent());
}
