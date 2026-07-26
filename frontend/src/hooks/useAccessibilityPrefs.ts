import { useEffect, useState } from 'react';

export type FontScale = 'normal' | 'large' | 'larger';

export interface AccessibilityPrefs {
  fontScale: FontScale;
  highContrast: boolean;
}

export const FONT_SCALE_LABELS: Record<FontScale, string> = {
  normal: 'Normal',
  large: 'Large',
  larger: 'Larger',
};

const STORAGE_KEY = 'accessibility-prefs';

const DEFAULT_PREFS: AccessibilityPrefs = {
  fontScale: 'normal',
  highContrast: false,
};

const FONT_SCALE_VALUES: Record<FontScale, string> = {
  normal: '1',
  large: '1.125',
  larger: '1.25',
};

function loadPrefs(): AccessibilityPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFS;
  }
}

// Applies the prefs straight to <html>, not to any component tree - font
// size and contrast need to affect every page, not just whichever one
// last rendered the settings toggle (unlike useDashboardWidgetPrefs,
// which only ever needs to affect the Dashboard itself).
function applyToDocument(prefs: AccessibilityPrefs): void {
  document.documentElement.style.setProperty('--font-scale', FONT_SCALE_VALUES[prefs.fontScale]);
  if (prefs.highContrast) {
    document.documentElement.setAttribute('data-contrast', 'high');
  } else {
    document.documentElement.removeAttribute('data-contrast');
  }
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

  const setFontScale = (fontScale: FontScale) => setPrefs((prev) => ({ ...prev, fontScale }));
  const toggleHighContrast = () => setPrefs((prev) => ({ ...prev, highContrast: !prev.highContrast }));

  return { ...prefs, setFontScale, toggleHighContrast };
}
