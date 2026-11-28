import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LIVE_MIN_GAP_MS, LIVE_STAGGER_MS, createLiveRefreshScheduler } from './liveRefreshScheduler';

describe('live refresh scheduler', () => {
  let visible = true;
  const setup = () => createLiveRefreshScheduler(() => visible);

  beforeEach(() => {
    visible = true;
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs the first refresh at once and staggers the others', () => {
    const scheduler = setup();
    const calls: string[] = [];
    for (const name of ['a', 'b', 'c']) scheduler.register(() => calls.push(name));

    scheduler.requestAll();
    expect(calls).toEqual(['a']);
    vi.advanceTimersByTime(LIVE_STAGGER_MS);
    expect(calls).toEqual(['a', 'b']);
    vi.advanceTimersByTime(LIVE_STAGGER_MS);
    expect(calls).toEqual(['a', 'b', 'c']);
  });

  it('merges visibilitychange and focus into one refresh per subscriber', () => {
    const scheduler = setup();
    const a = vi.fn();
    const b = vi.fn();
    scheduler.register(a);
    scheduler.register(b);

    scheduler.requestAll();
    scheduler.requestAll();
    vi.advanceTimersByTime(LIVE_STAGGER_MS * 4);

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('respects the minimum gap, then allows a new refresh', () => {
    const scheduler = setup();
    const run = vi.fn();
    const handle = scheduler.register(run);

    handle.request();
    vi.advanceTimersByTime(LIVE_MIN_GAP_MS - 1);
    handle.request();
    expect(run).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    handle.request();
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('ignores requests while hidden but still delivers a push', () => {
    const scheduler = setup();
    const run = vi.fn();
    scheduler.register(run);
    visible = false;

    scheduler.requestAll();
    expect(run).not.toHaveBeenCalled();
    scheduler.pushAll();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('delivers a push inside the minimum gap', () => {
    const scheduler = setup();
    const run = vi.fn();
    const handle = scheduler.register(run);

    handle.request();
    vi.advanceTimersByTime(LIVE_STAGGER_MS);
    handle.push();
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('drops queued refreshes after unregister or when the tab hides', () => {
    const scheduler = setup();
    const a = vi.fn();
    const b = vi.fn();
    const c = vi.fn();
    scheduler.register(a);
    const second = scheduler.register(b);
    scheduler.register(c);

    scheduler.requestAll();
    second.unregister();
    visible = false;
    vi.advanceTimersByTime(LIVE_STAGGER_MS * 4);

    expect(b).not.toHaveBeenCalled();
    expect(c).not.toHaveBeenCalled();
    expect(scheduler.size()).toBe(2);
  });

  it('keeps the queue going when a refresh throws', () => {
    const scheduler = setup();
    const next = vi.fn();
    scheduler.register(() => {
      throw new Error('boom');
    });
    scheduler.register(next);

    expect(() => scheduler.requestAll()).toThrow('boom');
    vi.advanceTimersByTime(LIVE_STAGGER_MS);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
