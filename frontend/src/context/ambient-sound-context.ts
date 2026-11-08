import { createContext } from 'react';
import type { AmbientKind } from '../lib/ambientNoise';

// Som de fundo partilhado app-wide: o motor de audio vive no provider (montado
// uma vez), por isso continua a tocar ao mudar de pagina.
export interface AmbientSoundContextType {
  kind: AmbientKind;
  // 0 a 1.
  volume: number;
  isPlaying: boolean;
  // O browser nao conseguiu tocar (Web Audio indisponivel ou bloqueado).
  failed: boolean;
  // Tem de ser chamado a partir de um clique (autoplay). Sem `kind` usa o guardado.
  play: (kind?: AmbientKind) => void;
  stop: () => void;
  toggle: () => void;
  setKind: (kind: AmbientKind) => void;
  setVolume: (volume: number) => void;
}

export const AmbientSoundContext = createContext<AmbientSoundContextType | undefined>(undefined);
