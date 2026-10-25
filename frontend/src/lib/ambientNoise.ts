// Ruido de fundo gerado no browser (Web Audio), sem ficheiros nem servicos
// externos: abafa o barulho a volta e da um sinal de "estou a estudar".
// Brown e o mais grave (chuva/rio ao longe), pink e equilibrado, white e o
// mais agudo (ventoinha).
export type AmbientKind = 'brown' | 'pink' | 'white';
export const AMBIENT_KINDS: readonly AmbientKind[] = ['brown', 'pink', 'white'];

// Segundos de ruido gerados uma vez e repetidos em loop.
const BUFFER_SECONDS = 4;
// Rampa de volume ao ligar/desligar, para nao dar um estalo.
const FADE_SECONDS = 0.4;

type Filler = (out: Float32Array) => void;

const fillWhite: Filler = (out) => {
  for (let i = 0; i < out.length; i++) out[i] = Math.random() * 2 - 1;
};

// Paul Kellet, versao economica: soma de ruido branco filtrado.
const fillPink: Filler = (out) => {
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  for (let i = 0; i < out.length; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99765 * b0 + white * 0.099046;
    b1 = 0.963 * b1 + white * 0.2965164;
    b2 = 0.57 * b2 + white * 1.0526913;
    out[i] = (b0 + b1 + b2 + white * 0.1848) * 0.11;
  }
};

// Integra ruido branco (passeio aleatorio amortecido).
const fillBrown: Filler = (out) => {
  let last = 0;
  for (let i = 0; i < out.length; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    out[i] = last * 3.5;
  }
};

const FILLERS: Record<AmbientKind, Filler> = { white: fillWhite, pink: fillPink, brown: fillBrown };

export interface AmbientPlayer {
  setVolume: (volume: number) => void;
  stop: () => void;
}

/** Comeca a tocar. Tem de ser chamado a partir de um clique (autoplay). */
export function startAmbient(kind: AmbientKind, volume: number): AmbientPlayer {
  const context = new AudioContext();
  const buffer = context.createBuffer(1, context.sampleRate * BUFFER_SECONDS, context.sampleRate);
  FILLERS[kind](buffer.getChannelData(0));

  const source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  const gain = context.createGain();
  gain.gain.setValueAtTime(0, context.currentTime);
  gain.gain.linearRampToValueAtTime(volume, context.currentTime + FADE_SECONDS);
  source.connect(gain).connect(context.destination);
  source.start();

  return {
    setVolume: (next) => gain.gain.setTargetAtTime(next, context.currentTime, FADE_SECONDS / 4),
    stop: () => {
      // Ancora a rampa no valor atual: depois de um setTargetAtTime (volume)
      // a rampa partia do ultimo evento agendado e dava um estalo.
      const now = context.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(0, now + FADE_SECONDS);
      window.setTimeout(() => void context.close(), FADE_SECONDS * 1000);
    },
  };
}
