import { useCallback, useState } from 'react';
import { AMBIENT_KINDS, type AmbientKind } from '../lib/ambientNoise';

const STORAGE_KEY = 'pm-focus-ambient';
const DEFAULT_PREF: AmbientPref = { kind: 'brown', volume: 0.3 };

export interface AmbientPref {
  kind: AmbientKind;
  // 0 a 1.
  volume: number;
}

function read(): AmbientPref {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<AmbientPref> | null;
    const kind = AMBIENT_KINDS.find((k) => k === raw?.kind) ?? DEFAULT_PREF.kind;
    const volume =
      typeof raw?.volume === 'number' && raw.volume >= 0 && raw.volume <= 1 ? raw.volume : DEFAULT_PREF.volume;
    return { kind, volume };
  } catch {
    return DEFAULT_PREF;
  }
}

// Ultimo som e volume escolhidos no Focus (por dispositivo). Nunca guarda
// "a tocar": o som so comeca com um clique, por causa do autoplay.
export function useAmbientSoundPref() {
  const [pref, setPrefState] = useState<AmbientPref>(read);

  const setPref = useCallback((next: AmbientPref) => {
    setPrefState(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Best-effort, como os outros prefs hooks.
    }
  }, []);

  const reset = useCallback(() => setPref(DEFAULT_PREF), [setPref]);

  return { pref, setPref, reset };
}
