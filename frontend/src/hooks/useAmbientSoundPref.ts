import { useCallback } from 'react';
import { AMBIENT_KINDS, type AmbientKind } from '../lib/ambientNoise';
import { usePersistedState, type PersistedCodec } from './usePersistedState';

const STORAGE_KEY = 'pm-focus-ambient';
const DEFAULT_PREF: AmbientPref = { kind: 'brown', volume: 0.3 };

export interface AmbientPref {
  kind: AmbientKind;
  // 0 a 1.
  volume: number;
}

const CODEC: PersistedCodec<AmbientPref> = {
  parse: (stored) => {
    try {
      const raw = JSON.parse(stored ?? 'null') as Partial<AmbientPref> | null;
      const kind = AMBIENT_KINDS.find((k) => k === raw?.kind) ?? DEFAULT_PREF.kind;
      const volume =
        typeof raw?.volume === 'number' && raw.volume >= 0 && raw.volume <= 1 ? raw.volume : DEFAULT_PREF.volume;
      return { kind, volume };
    } catch {
      return DEFAULT_PREF;
    }
  },
  serialize: (pref) => JSON.stringify(pref),
};

// Ultimo som e volume escolhidos no Focus (por dispositivo). Nunca guarda
// "a tocar": o som so comeca com um clique, por causa do autoplay.
export function useAmbientSoundPref() {
  const [pref, setPref] = usePersistedState(STORAGE_KEY, CODEC);

  const reset = useCallback(() => setPref(DEFAULT_PREF), [setPref]);

  return { pref, setPref, reset };
}
