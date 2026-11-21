// Sequencias de teclas da paleta: "g" seguido de uma letra navega.
export const SEQUENCE_PREFIX = 'g';
export const SEQUENCE_TIMEOUT_MS = 1000;
export const HELP_KEY = '?';
export const OPEN_SHORTCUTS_HELP_EVENT = 'pmaxing:open-shortcuts-help';

export interface GoTarget {
  key: string;
  path: string;
  labelKey: string;
}

export const GO_TARGETS: GoTarget[] = [
  { key: 'd', path: '/dashboard', labelKey: 'nav.dashboard' },
  { key: 't', path: '/tasks', labelKey: 'nav.tasks' },
  { key: 'f', path: '/focus', labelKey: 'nav.focus' },
  { key: 's', path: '/schedule', labelKey: 'nav.schedule' },
  { key: 'n', path: '/notebook', labelKey: 'nav.notebook' },
  { key: 'a', path: '/areas', labelKey: 'nav.areas' },
];

// armedAt: instante (ms) em que o prefixo foi premido; null = a espera.
export interface SequenceState {
  armedAt: number | null;
}

export const INITIAL_SEQUENCE: SequenceState = { armedAt: null };

export interface SequenceResult {
  state: SequenceState;
  path: string | null;
  // A tecla fez parte da sequencia (armou ou completou): quem a ouve deve
  // impedir os outros atalhos da pagina de a tratar tambem (ex: g n vs n).
  consumed: boolean;
}

export function advanceSequence(
  state: SequenceState,
  key: string,
  now: number,
  targets: GoTarget[] = GO_TARGETS,
  timeoutMs: number = SEQUENCE_TIMEOUT_MS,
): SequenceResult {
  const armed = state.armedAt !== null && now - state.armedAt <= timeoutMs;
  if (armed) {
    const target = targets.find((t) => t.key === key);
    if (target) return { state: INITIAL_SEQUENCE, path: target.path, consumed: true };
  }
  if (key === SEQUENCE_PREFIX) return { state: { armedAt: now }, path: null, consumed: true };
  return { state: INITIAL_SEQUENCE, path: null, consumed: false };
}
