import {
  OVERDUE_CHECKIN_GRACE_DAYS,
  computeCheckedAt,
  computeOverdueWindow,
} from './overdue-window.util';

const DAY_MS = 86_400_000;

describe('computeOverdueWindow', () => {
  it('startOfToday é a meia-noite UTC de hoje, seja a que horas for', () => {
    const { startOfToday } = computeOverdueWindow(
      new Date('2026-10-07T23:59:59.999Z'),
    );
    expect(startOfToday.toISOString()).toBe('2026-10-07T00:00:00.000Z');
  });

  it('uma task de HOJE (meia-noite UTC) nunca entra na pergunta', () => {
    const now = new Date('2026-10-07T09:30:00Z');
    const { overdueCutoff } = computeOverdueWindow(now);
    const dueToday = new Date('2026-10-07T00:00:00Z');
    expect(dueToday.getTime() < overdueCutoff.getTime()).toBe(false);
  });

  it('com a tolerância por omissão, uma task de ontem ainda não entra', () => {
    expect(OVERDUE_CHECKIN_GRACE_DAYS).toBe(1);
    const { overdueCutoff } = computeOverdueWindow(
      new Date('2026-10-07T09:30:00Z'),
    );
    const dueYesterday = new Date('2026-10-06T00:00:00Z');
    expect(dueYesterday.getTime() < overdueCutoff.getTime()).toBe(false);
  });

  it('uma task de há dois dias já entra', () => {
    const { overdueCutoff } = computeOverdueWindow(
      new Date('2026-10-07T09:30:00Z'),
    );
    const dueTwoDaysAgo = new Date('2026-10-05T00:00:00Z');
    expect(dueTwoDaysAgo.getTime() < overdueCutoff.getTime()).toBe(true);
  });

  it('tolerância 0: uma task de ontem entra logo', () => {
    const { overdueCutoff } = computeOverdueWindow(
      new Date('2026-10-07T09:30:00Z'),
      0,
    );
    const dueYesterday = new Date('2026-10-06T00:00:00Z');
    expect(dueYesterday.getTime() < overdueCutoff.getTime()).toBe(true);
  });

  it('não altera a data recebida', () => {
    const now = new Date('2026-10-07T09:30:00Z');
    computeOverdueWindow(now);
    expect(now.toISOString()).toBe('2026-10-07T09:30:00.000Z');
  });
});

describe('computeCheckedAt', () => {
  const now = new Date('2026-10-07T09:30:00Z');

  it('sem adiar (0) ou 1 dia: marca agora, volta a perguntar amanhã', () => {
    expect(computeCheckedAt(now, 0).getTime()).toBe(now.getTime());
    expect(computeCheckedAt(now, 1).getTime()).toBe(now.getTime());
  });

  it('adiar 7 dias marca agora + 6 dias', () => {
    expect(computeCheckedAt(now, 7).getTime()).toBe(now.getTime() + 6 * DAY_MS);
  });

  it('a marca adiada continua fora da pergunta durante o adiamento', () => {
    const checkedAt = computeCheckedAt(now, 7);
    // Dia 6 depois: a marca ainda é >= início desse dia, logo escondida.
    const day6 = computeOverdueWindow(new Date(now.getTime() + 5 * DAY_MS));
    expect(checkedAt.getTime() < day6.startOfToday.getTime()).toBe(false);
    // Dia 8 depois: já passou, volta a perguntar.
    const day8 = computeOverdueWindow(new Date(now.getTime() + 8 * DAY_MS));
    expect(checkedAt.getTime() < day8.startOfToday.getTime()).toBe(true);
  });
});
