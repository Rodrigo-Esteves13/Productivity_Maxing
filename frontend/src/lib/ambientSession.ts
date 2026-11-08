// Estado "a tocar" do som de fundo e a regra de quando para sozinho. Puro (sem
// Web Audio, sem React) para se testar: o provider so aplica os eventos.
export interface AmbientSessionState {
  playing: boolean;
  // Sessao de estudo que estava ativa quando o som comecou (null = sem sessao).
  boundSessionId: string | null;
}

export type AmbientSessionEvent =
  | { type: 'start'; sessionId: string | null }
  | { type: 'stop' }
  // A sessao ativa mudou (id novo, ou null quando acabou).
  | { type: 'session'; sessionId: string | null }
  | { type: 'signedOut' };

export const AMBIENT_IDLE: AmbientSessionState = { playing: false, boundSessionId: null };

// Devolve o MESMO objeto quando nada muda, para quem chama poder comparar por referencia.
export function reduceAmbientSession(
  state: AmbientSessionState,
  event: AmbientSessionEvent,
): AmbientSessionState {
  switch (event.type) {
    case 'start':
      return { playing: true, boundSessionId: event.sessionId };
    case 'stop':
    case 'signedOut':
      return state.playing ? AMBIENT_IDLE : state;
    case 'session': {
      if (!state.playing) return state;
      // Som ligado sem sessao: se uma comecar, passa a acabar com ela.
      if (state.boundSessionId === null) {
        return event.sessionId === null ? state : { playing: true, boundSessionId: event.sessionId };
      }
      return event.sessionId === state.boundSessionId ? state : AMBIENT_IDLE;
    }
  }
}
