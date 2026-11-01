// Modo privacidade do dinheiro: esconde valores NO ECRA (nao protege dados).
export const PRIVACY_STORAGE_KEY = 'pmaxing.finance.privacy';
export const PRIVACY_REVEAL_MS = 5_000;
export const PRIVACY_IDLE_MS = 120_000;
export const PRIVACY_MASK = '••••';
/** Eventos que contam como atividade (reiniciam o relogio de inatividade). */
export const PRIVACY_ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'scroll', 'touchstart'] as const;

export interface PrivacyPref {
  /** Valores escondidos agora. */
  enabled: boolean;
  /** A pessoa ja ligou o modo: volta a ligar sozinho ao esconder a tab ou ficar parado. */
  armed: boolean;
}

export const DEFAULT_PRIVACY_PREF: PrivacyPref = { enabled: false, armed: false };

export function parsePrivacyPref(raw: string | null): PrivacyPref {
  if (!raw) return DEFAULT_PRIVACY_PREF;
  try {
    const value: unknown = JSON.parse(raw);
    if (value && typeof value === 'object') {
      const { enabled, armed } = value as Partial<PrivacyPref>;
      return { enabled: enabled === true, armed: armed === true };
    }
  } catch {
    // JSON invalido: volta ao valor por omissao.
  }
  return DEFAULT_PRIVACY_PREF;
}

export function readPrivacyPref(): PrivacyPref {
  try {
    return parsePrivacyPref(localStorage.getItem(PRIVACY_STORAGE_KEY));
  } catch {
    return DEFAULT_PRIVACY_PREF;
  }
}

export function writePrivacyPref(pref: PrivacyPref): void {
  try {
    localStorage.setItem(PRIVACY_STORAGE_KEY, JSON.stringify(pref));
  } catch {
    // Armazenamento bloqueado: o modo funciona so nesta sessao.
  }
}

/** Texto de um valor: o real, ou a mascara quando escondido. */
export function maskText(text: string, hidden: boolean): string {
  return hidden ? PRIVACY_MASK : text;
}

/** Ligar o modo arma o re-bloqueio automatico; desligar mantem-no armado. */
export function togglePrivacyPref(pref: PrivacyPref): PrivacyPref {
  return { enabled: !pref.enabled, armed: pref.armed || !pref.enabled };
}

/** Re-bloqueio (tab escondida ou inatividade): so se a pessoa ja usou o modo. */
export function relockPrivacyPref(pref: PrivacyPref): PrivacyPref {
  return pref.armed && !pref.enabled ? { ...pref, enabled: true } : pref;
}
