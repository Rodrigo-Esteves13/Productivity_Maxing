import { afterEach, describe, expect, it, vi } from 'vitest';
import { emit, on } from './bus';

const cleanups: (() => void)[] = [];
const track = (off: () => void) => {
  cleanups.push(off);
  return off;
};

afterEach(() => {
  for (const off of cleanups.splice(0)) off();
  vi.unstubAllGlobals();
});

describe('bus', () => {
  it('delivers the payload synchronously, only to that event', () => {
    const calendar = vi.fn();
    const social = vi.fn();
    track(on('calendar:syncReview', calendar));
    track(on('social:changed', social));
    emit('calendar:syncReview', { force: true });
    expect(calendar).toHaveBeenCalledWith({ force: true });
    expect(social).not.toHaveBeenCalled();
    emit('social:changed');
    expect(social).toHaveBeenCalledTimes(1);
  });

  it('gives every listener the same payload object (shared refetch relies on it)', () => {
    const seen: unknown[] = [];
    track(on('areaRatings:teacherChanged', (change) => seen.push(change)));
    track(on('areaRatings:teacherChanged', (change) => seen.push(change)));
    emit('areaRatings:teacherChanged', { areaId: 'a1' });
    expect(seen).toHaveLength(2);
    expect(seen[0]).toBe(seen[1]);
  });

  it('stops delivering after unsubscribe, also in the middle of a delivery', () => {
    const second = vi.fn();
    let offSecond: () => void = () => undefined;
    track(on('social:changed', () => offSecond()));
    offSecond = track(on('social:changed', second));
    emit('social:changed');
    expect(second).not.toHaveBeenCalled();
  });

  it('a listener added during a delivery only gets the next one', () => {
    const late = vi.fn();
    const off = track(on('social:changed', () => void track(on('social:changed', late))));
    emit('social:changed');
    expect(late).not.toHaveBeenCalled();
    off();
    emit('social:changed');
    expect(late).toHaveBeenCalledTimes(1);
  });

  it('a failing listener does not block the others and the error is rethrown later', () => {
    const queued: (() => void)[] = [];
    vi.stubGlobal('queueMicrotask', (task: () => void) => queued.push(task));
    const other = vi.fn();
    track(
      on('social:changed', () => {
        throw new Error('boom');
      }),
    );
    track(on('social:changed', other));
    emit('social:changed');
    expect(other).toHaveBeenCalledTimes(1);
    expect(queued).toHaveLength(1);
    expect(queued[0]).toThrow('boom');
  });
});
