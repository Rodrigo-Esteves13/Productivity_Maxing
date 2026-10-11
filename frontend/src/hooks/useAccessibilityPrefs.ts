import { useEffect, useState } from 'react';

export type FontScale = 'normal' | 'large' | 'larger' | 'largest';

// Temas: o "nightshade" (roxo escuro) e o original. Os restantes redefinem as
// mesmas variaveis de cor em styles/themes.css. "system" segue o sistema
// operativo (claro -> light, escuro -> nightshade).
export type ThemeId = 'system' | 'nightshade' | 'midnight' | 'light' | 'ocean' | 'forest' | 'sunset';

export interface ThemeOption {
  id: ThemeId;
  // Cores so para a pre-visualizacao no seletor (fundo, cartao, destaque).
  preview: { bg: string; card: string; accent: string };
}

export const THEME_OPTIONS: ThemeOption[] = [
  { id: 'nightshade', preview: { bg: '#0d0920', card: '#1b1433', accent: '#a52ff0' } },
  { id: 'midnight', preview: { bg: '#0c0c0e', card: '#18181c', accent: '#8b5cf6' } },
  { id: 'light', preview: { bg: '#f6f5fb', card: '#ffffff', accent: '#6d28d9' } },
  { id: 'ocean', preview: { bg: '#0a1222', card: '#131f35', accent: '#3b82f6' } },
  { id: 'forest', preview: { bg: '#0a150f', card: '#14261c', accent: '#10b981' } },
  { id: 'sunset', preview: { bg: '#130e07', card: '#241b10', accent: '#f59e0b' } },
];

export interface AccessibilityPrefs {
  fontScale: FontScale;
  highContrast: boolean;
  theme: ThemeId;
  // Paleta alternativa para estados (bom/mau/aviso) sem depender de verde/vermelho.
  colorblind: boolean;
  // Forca menos movimento (alem de seguir a definicao do sistema operativo).
  reduceMotion: boolean;
}

const STORAGE_KEY = 'accessibility-prefs';

const DEFAULT_PREFS: AccessibilityPrefs = {
  fontScale: 'normal',
  highContrast: false,
  theme: 'nightshade',
  colorblind: false,
  reduceMotion: false,
};

const FONT_SCALE_VALUES: Record<FontScale, string> = {
  normal: '1',
  large: '1.125',
  larger: '1.25',
  largest: '1.5',
};

export function loadPrefs(): AccessibilityPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFS;
  }
}

function resolveTheme(theme: ThemeId): Exclude<ThemeId, 'system'> {
  if (theme !== 'system') return theme;
  const prefersLight =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches;
  return prefersLight ? 'light' : 'nightshade';
}

// Applies the prefs straight to <html>, not to any component tree - font
// size, contrast and theme need to affect every page, not just whichever one
// last rendered the settings toggle.
export function applyToDocument(prefs: AccessibilityPrefs): void {
  const root = document.documentElement;
  root.style.setProperty('--font-scale', FONT_SCALE_VALUES[prefs.fontScale] ?? '1');

  const toggle = (name: string, value: string | null) =>
    value === null ? root.removeAttribute(name) : root.setAttribute(name, value);

  toggle('data-contrast', prefs.highContrast ? 'high' : null);
  toggle('data-colorblind', prefs.colorblind ? 'true' : null);
  toggle('data-motion', prefs.reduceMotion ? 'reduced' : null);

  const theme = resolveTheme(prefs.theme);
  // O tema original nao precisa de atributo (e o :root por defeito).
  toggle('data-theme', theme === 'nightshade' ? null : theme);
}

// Chamado antes do primeiro render (main.tsx): evita o "flash" do tema
// por defeito ate o React montar.
export function applyStoredPrefs(): void {
  applyToDocument(loadPrefs());
}

// Mounted once at the app root (see AccessibilityEffects) so the saved
// preference is re-applied on every fresh page load, even if the user
// never visits the Profile page in that session. Also used directly by
// the Profile settings UI to read/change the preference.
export function useAccessibilityPrefs() {
  const [prefs, setPrefs] = useState<AccessibilityPrefs>(loadPrefs);

  useEffect(() => {
    applyToDocument(prefs);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // Best-effort only - a user with storage disabled/full just doesn't
      // get the preference remembered across reloads, nothing breaks.
    }
  }, [prefs]);

  // "system": acompanha a mudanca de claro/escuro do sistema em tempo real.
  useEffect(() => {
    if (prefs.theme !== 'system' || !window.matchMedia) return;
    const query = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = () => applyToDocument(prefs);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [prefs]);

  const setFontScale = (fontScale: FontScale) => setPrefs((prev) => ({ ...prev, fontScale }));
  const toggleHighContrast = () => setPrefs((prev) => ({ ...prev, highContrast: !prev.highContrast }));
  const setTheme = (theme: ThemeId) => setPrefs((prev) => ({ ...prev, theme }));
  const toggleColorblind = () => setPrefs((prev) => ({ ...prev, colorblind: !prev.colorblind }));
  const toggleReduceMotion = () => setPrefs((prev) => ({ ...prev, reduceMotion: !prev.reduceMotion }));

  return { ...prefs, setFontScale, toggleHighContrast, setTheme, toggleColorblind, toggleReduceMotion };
}
