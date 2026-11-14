import { describe, expect, it, vi } from 'vitest';
import { holdWakeLock } from './useWakeLock';

function fakes(visible = true) {
  const release = vi.fn(function (this: { released: boolean }) {
    this.released = true;
    return Promise.resolve();
  });
  const request = vi.fn(() => Promise.resolve({ released: false, release } as unknown as WakeLockSentinel));
  let listener: (() => void) | null = null;
  const host = {
    visibilityState: (visible ? 'visible' : 'hidden') as DocumentVisibilityState,
    addEventListener: vi.fn((_: 'visibilitychange', fn: () => void) => {
      listener = fn;
    }),
    removeEventListener: vi.fn(),
  };
  return { request, release, host, fire: () => listener?.(), wakeLock: { request } as unknown as WakeLock };
}

describe('holdWakeLock', () => {
  it('requests the screen lock and releases it', async () => {
    const f = fakes();
    const stop = holdWakeLock(f.wakeLock, f.host);
    await vi.waitFor(() => expect(f.request).toHaveBeenCalledWith('screen'));
    stop();
    expect(f.release).toHaveBeenCalled();
    expect(f.host.removeEventListener).toHaveBeenCalled();
  });

  it('waits for the tab to be visible and asks again when it returns', async () => {
    const f = fakes(false);
    holdWakeLock(f.wakeLock, f.host);
    expect(f.request).not.toHaveBeenCalled();
    f.host.visibilityState = 'visible';
    f.fire();
    await vi.waitFor(() => expect(f.request).toHaveBeenCalledTimes(1));
  });

  it('survives a refused request', async () => {
    const f = fakes();
    f.request.mockRejectedValueOnce(new Error('denied'));
    const stop = holdWakeLock(f.wakeLock, f.host);
    await vi.waitFor(() => expect(f.request).toHaveBeenCalled());
    expect(() => stop()).not.toThrow();
  });
});
