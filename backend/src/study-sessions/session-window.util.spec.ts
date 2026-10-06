import {
  MAX_BACKDATE_DAYS,
  MAX_SESSION_MINUTES,
  validateSessionWindow,
} from './session-window.util';

const NOW = new Date('2026-10-05T12:00:00Z');
const at = (iso: string) => new Date(iso);

describe('validateSessionWindow', () => {
  it('aceita um intervalo normal no passado', () => {
    expect(
      validateSessionWindow(
        at('2026-10-05T09:00:00Z'),
        at('2026-10-05T10:30:00Z'),
        NOW,
      ),
    ).toBeNull();
  });

  it('recusa fim antes ou igual ao inicio', () => {
    expect(
      validateSessionWindow(
        at('2026-10-05T10:00:00Z'),
        at('2026-10-05T10:00:00Z'),
        NOW,
      ),
    ).not.toBeNull();
    expect(
      validateSessionWindow(
        at('2026-10-05T10:00:00Z'),
        at('2026-10-05T09:00:00Z'),
        NOW,
      ),
    ).not.toBeNull();
  });

  it('recusa fim no futuro, mas tolera um minuto de relogio desfasado', () => {
    expect(
      validateSessionWindow(
        at('2026-10-05T11:00:00Z'),
        at('2026-10-05T12:30:00Z'),
        NOW,
      ),
    ).not.toBeNull();
    expect(
      validateSessionWindow(
        at('2026-10-05T11:00:00Z'),
        at('2026-10-05T12:00:30Z'),
        NOW,
      ),
    ).toBeNull();
  });

  it('recusa sessoes mais longas do que o maximo', () => {
    const start = at('2026-10-04T10:00:00Z');
    const justOver = new Date(
      start.getTime() + (MAX_SESSION_MINUTES + 1) * 60_000,
    );
    const exactly = new Date(start.getTime() + MAX_SESSION_MINUTES * 60_000);
    expect(validateSessionWindow(start, justOver, NOW)).not.toBeNull();
    expect(validateSessionWindow(start, exactly, NOW)).toBeNull();
  });

  it('recusa sessoes demasiado antigas', () => {
    const old = new Date(NOW.getTime() - (MAX_BACKDATE_DAYS + 1) * 86_400_000);
    expect(
      validateSessionWindow(old, new Date(old.getTime() + 3_600_000), NOW),
    ).not.toBeNull();
  });

  it('recusa datas invalidas', () => {
    expect(
      validateSessionWindow(new Date('x'), at('2026-10-05T10:00:00Z'), NOW),
    ).not.toBeNull();
  });
});
