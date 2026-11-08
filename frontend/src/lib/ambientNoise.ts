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

export interface AmbientEngine {
  /** Comeca (ou troca para outro tipo de ruido). Tem de vir de um clique (autoplay); pode lancar. */
  play: (kind: AmbientKind, volume: number) => void;
  setVolume: (volume: number) => void;
  /** Desliga e fecha o AudioContext. Pode voltar a chamar play() depois. */
  stop: () => void;
}

interface Voice {
  source: AudioBufferSourceNode;
  gain: GainNode;
}

// Um unico AudioContext por sessao de som: so e criado no primeiro play()
// (dentro do clique) e fechado no stop(). Trocar de tipo faz crossfade na
// mesma context em vez de abrir outra.
export function createAmbientEngine(): AmbientEngine {
  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  let voice: Voice | null = null;
  let buffers = new Map<AmbientKind, AudioBuffer>();

  const bufferFor = (ctx: AudioContext, kind: AmbientKind): AudioBuffer => {
    const cached = buffers.get(kind);
    if (cached) return cached;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * BUFFER_SECONDS, ctx.sampleRate);
    FILLERS[kind](buffer.getChannelData(0));
    buffers.set(kind, buffer);
    return buffer;
  };

  // Ancora a rampa no valor atual: depois de um setTargetAtTime a rampa
  // partia do ultimo evento agendado e dava um estalo.
  const fadeOut = (ctx: AudioContext, target: Voice) => {
    const now = ctx.currentTime;
    target.gain.gain.cancelScheduledValues(now);
    target.gain.gain.setValueAtTime(target.gain.gain.value, now);
    target.gain.gain.linearRampToValueAtTime(0, now + FADE_SECONDS);
    target.source.stop(now + FADE_SECONDS);
  };

  return {
    play: (kind, volume) => {
      if (!context || !master) {
        context = new AudioContext();
        master = context.createGain();
        master.gain.value = volume;
        master.connect(context.destination);
        buffers = new Map();
      }
      if (context.state === 'suspended') void context.resume();
      const source = context.createBufferSource();
      source.buffer = bufferFor(context, kind);
      source.loop = true;
      const gain = context.createGain();
      gain.gain.setValueAtTime(0, context.currentTime);
      gain.gain.linearRampToValueAtTime(1, context.currentTime + FADE_SECONDS);
      source.connect(gain).connect(master);
      source.start();
      master.gain.setTargetAtTime(volume, context.currentTime, FADE_SECONDS / 4);
      if (voice) fadeOut(context, voice);
      voice = { source, gain };
    },
    setVolume: (next) => {
      if (context && master) master.gain.setTargetAtTime(next, context.currentTime, FADE_SECONDS / 4);
    },
    stop: () => {
      const closing = context;
      const current = voice;
      context = null;
      master = null;
      voice = null;
      buffers = new Map();
      if (!closing) return;
      if (current) fadeOut(closing, current);
      window.setTimeout(() => void closing.close(), FADE_SECONDS * 1000);
    },
  };
}
