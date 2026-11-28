import { describe, expect, it } from 'vitest';
import { appealState, blockedSeverity, formatRemaining } from './accountBlocked';
import type { AccountStatusInfo } from '../types/models';

const NOW = Date.parse('2026-01-01T00:00:00Z');
const at = (iso: string) => formatRemaining(iso, NOW);

describe('blockedSeverity', () => {
  it('segue o estado da conta', () => {
    expect(blockedSeverity(null)).toBe('neutral');
    expect(blockedSeverity('BANNED')).toBe('banned');
    expect(blockedSeverity('SUSPENDED')).toBe('suspended');
    expect(blockedSeverity('ACTIVE')).toBe('lifted');
  });
});

describe('formatRemaining', () => {
  it('escolhe as unidades pelo tamanho', () => {
    expect(at('2026-01-04T04:30:00Z')).toBe('3d 4h');
    expect(at('2026-01-01T06:12:00Z')).toBe('6h 12m');
    expect(at('2026-01-01T00:12:59Z')).toBe('12m');
  });
  it('prazo passado', () => {
    expect(at('2025-12-31T23:59:00Z')).toBe('any moment now');
  });
});

describe('appealState', () => {
  const data = (appeal: unknown, availability?: unknown) =>
    ({ appeal, appealAvailability: availability }) as unknown as AccountStatusInfo;
  const sent = '2026-01-01T00:00:00Z';

  it('sem appeal pode submeter', () => {
    expect(appealState(data(null), null, NOW)).toMatchObject({ pendingAppeal: null, canSubmitNewAppeal: true });
  });
  it('acabado de enviar conta como pendente ate o servidor responder', () => {
    expect(appealState(data(null), sent, NOW)).toMatchObject({
      pendingAppeal: { createdAt: sent },
      canSubmitNewAppeal: false,
    });
  });
  it('a resolucao do servidor ganha ao envio local', () => {
    const resolved = { createdAt: sent, resolvedAt: sent, resolution: 'DENIED' };
    expect(appealState(data(resolved), sent, NOW)).toMatchObject({ pendingAppeal: null, resolvedAppeal: resolved });
  });
  it('espera e limite bloqueiam um novo', () => {
    const waiting = appealState(data(null, { nextAppealAllowedAt: '2026-01-02T00:00:00Z' }), null, NOW);
    expect(waiting).toMatchObject({ cooldownActive: true, canSubmitNewAppeal: false });
    expect(appealState(data(null, { appealsExhausted: true }), null, NOW).canSubmitNewAppeal).toBe(false);
  });
});
