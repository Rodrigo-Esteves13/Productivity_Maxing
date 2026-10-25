import { beforeEach, describe, expect, it, vi } from 'vitest';

// F-07 / a-09: a transient /calendar/status failure must not be cached as
// "not connected", and logout must clear the cached answer of the old user.

const getCalendarStatus = vi.fn();
vi.mock('../api/calendarService', () => ({ getCalendarStatus: () => getCalendarStatus() }));

describe('calendar status cache', () => {
  beforeEach(() => {
    vi.resetModules();
    getCalendarStatus.mockReset();
  });

  it('retries after a failed request instead of caching "not connected"', async () => {
    const { fetchStatus } = await import('./useCalendarStatus');
    getCalendarStatus.mockRejectedValueOnce(new Error('502'));
    expect(await fetchStatus()).toBe(false);
    getCalendarStatus.mockResolvedValueOnce({ connected: true });
    expect(await fetchStatus()).toBe(true);
    expect(getCalendarStatus).toHaveBeenCalledTimes(2);
  });

  it('reuses a good answer and forgets it on reset (logout)', async () => {
    const { fetchStatus, resetCalendarStatus } = await import('./useCalendarStatus');
    getCalendarStatus.mockResolvedValueOnce({ connected: true });
    expect(await fetchStatus()).toBe(true);
    expect(await fetchStatus()).toBe(true);
    expect(getCalendarStatus).toHaveBeenCalledTimes(1);

    resetCalendarStatus();
    getCalendarStatus.mockResolvedValueOnce({ connected: false });
    expect(await fetchStatus()).toBe(false);
    expect(getCalendarStatus).toHaveBeenCalledTimes(2);
  });
});
