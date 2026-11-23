import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DOMAIN_CHANGE_SETTLE_MS,
  getDomainVersion,
  getDomainsVersion,
  notifyDomainChanged,
  resetDomainEventsForTests,
  subscribeToDomainChanges,
} from './domainEvents';

describe('domainEvents', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetDomainEventsForTests();
  });

  afterEach(() => {
    resetDomainEventsForTests();
    vi.useRealTimers();
  });

  it('starts every domain at version 0', () => {
    expect(getDomainVersion('tasks')).toBe(0);
    expect(getDomainVersion('studySessions')).toBe(0);
    expect(getDomainVersion('grades')).toBe(0);
  });

  it('publishes the bump only after the settle window', () => {
    const listener = vi.fn();
    subscribeToDomainChanges(listener);

    notifyDomainChanged('tasks');
    expect(getDomainVersion('tasks')).toBe(0);
    expect(listener).not.toHaveBeenCalled();

    vi.advanceTimersByTime(DOMAIN_CHANGE_SETTLE_MS);
    expect(getDomainVersion('tasks')).toBe(1);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('coalesces a burst of writes into one notification and one bump', () => {
    const listener = vi.fn();
    subscribeToDomainChanges(listener);

    for (let i = 0; i < 20; i += 1) {
      notifyDomainChanged('tasks');
      vi.advanceTimersByTime(DOMAIN_CHANGE_SETTLE_MS - 1);
    }
    expect(listener).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getDomainVersion('tasks')).toBe(1);
  });

  it('bumps only the domains that changed', () => {
    notifyDomainChanged('studySessions', 'grades');
    vi.advanceTimersByTime(DOMAIN_CHANGE_SETTLE_MS);

    expect(getDomainVersion('tasks')).toBe(0);
    expect(getDomainVersion('studySessions')).toBe(1);
    expect(getDomainVersion('grades')).toBe(1);
  });

  it('gives a combined version that changes when any listed domain changes', () => {
    const before = getDomainsVersion(['tasks', 'grades']);

    notifyDomainChanged('studySessions');
    vi.advanceTimersByTime(DOMAIN_CHANGE_SETTLE_MS);
    expect(getDomainsVersion(['tasks', 'grades'])).toBe(before);

    notifyDomainChanged('grades');
    vi.advanceTimersByTime(DOMAIN_CHANGE_SETTLE_MS);
    expect(getDomainsVersion(['tasks', 'grades'])).toBe(before + 1);
  });

  it('ignores a call with no domains', () => {
    const listener = vi.fn();
    subscribeToDomainChanges(listener);
    notifyDomainChanged();
    vi.advanceTimersByTime(DOMAIN_CHANGE_SETTLE_MS);
    expect(listener).not.toHaveBeenCalled();
  });

  it('stops calling a listener after it unsubscribes', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToDomainChanges(listener);
    unsubscribe();

    notifyDomainChanged('tasks');
    vi.advanceTimersByTime(DOMAIN_CHANGE_SETTLE_MS);
    expect(listener).not.toHaveBeenCalled();
    expect(getDomainVersion('tasks')).toBe(1);
  });

  it('lets a listener unsubscribe while being notified without skipping others', () => {
    const second = vi.fn();
    const unsubscribeFirst = subscribeToDomainChanges(() => unsubscribeFirst());
    subscribeToDomainChanges(second);

    notifyDomainChanged('tasks');
    vi.advanceTimersByTime(DOMAIN_CHANGE_SETTLE_MS);
    expect(second).toHaveBeenCalledTimes(1);
  });
});
