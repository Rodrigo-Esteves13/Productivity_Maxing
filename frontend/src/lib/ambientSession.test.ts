import { describe, expect, it } from 'vitest';
import { AMBIENT_IDLE, reduceAmbientSession, type AmbientSessionState } from './ambientSession';

const playingFree: AmbientSessionState = { playing: true, boundSessionId: null };
const playingBound: AmbientSessionState = { playing: true, boundSessionId: 's1' };

describe('reduceAmbientSession', () => {
  it('start liga e guarda a sessao ativa', () => {
    expect(reduceAmbientSession(AMBIENT_IDLE, { type: 'start', sessionId: 's1' })).toEqual(playingBound);
    expect(reduceAmbientSession(AMBIENT_IDLE, { type: 'start', sessionId: null })).toEqual(playingFree);
  });

  it('stop e signedOut desligam; parado fica igual', () => {
    expect(reduceAmbientSession(playingBound, { type: 'stop' })).toBe(AMBIENT_IDLE);
    expect(reduceAmbientSession(playingFree, { type: 'signedOut' })).toBe(AMBIENT_IDLE);
    expect(reduceAmbientSession(AMBIENT_IDLE, { type: 'stop' })).toBe(AMBIENT_IDLE);
  });

  it('para quando a sessao ligada acaba ou muda', () => {
    expect(reduceAmbientSession(playingBound, { type: 'session', sessionId: null })).toBe(AMBIENT_IDLE);
    expect(reduceAmbientSession(playingBound, { type: 'session', sessionId: 's2' })).toBe(AMBIENT_IDLE);
  });

  it('continua com a mesma sessao', () => {
    expect(reduceAmbientSession(playingBound, { type: 'session', sessionId: 's1' })).toBe(playingBound);
  });

  it('som sem sessao: continua sem sessao e liga-se a que comecar depois', () => {
    expect(reduceAmbientSession(playingFree, { type: 'session', sessionId: null })).toBe(playingFree);
    const bound = reduceAmbientSession(playingFree, { type: 'session', sessionId: 's9' });
    expect(bound).toEqual({ playing: true, boundSessionId: 's9' });
    expect(reduceAmbientSession(bound, { type: 'session', sessionId: null })).toBe(AMBIENT_IDLE);
  });

  it('eventos de sessao com o som parado nao fazem nada', () => {
    expect(reduceAmbientSession(AMBIENT_IDLE, { type: 'session', sessionId: 's1' })).toBe(AMBIENT_IDLE);
  });
});
