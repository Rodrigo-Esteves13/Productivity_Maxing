import { afterEach, describe, expect, it, vi } from 'vitest';
import { deviceMatchesAppTimeZone } from './appTimeZone';

describe('deviceMatchesAppTimeZone (D-10)', () => {
  afterEach(() => vi.restoreAllMocks());
  const at = new Date('2026-07-15T10:00:00Z'); // 11:00 in Lisbon (summer)

  it('true when the device clock shows Lisbon time', () => {
    vi.spyOn(at, 'getHours').mockReturnValue(11);
    vi.spyOn(at, 'getMinutes').mockReturnValue(0);
    expect(deviceMatchesAppTimeZone(at)).toBe(true);
  });

  it('false for a device one hour behind (Azores)', () => {
    vi.spyOn(at, 'getHours').mockReturnValue(10);
    vi.spyOn(at, 'getMinutes').mockReturnValue(0);
    expect(deviceMatchesAppTimeZone(at)).toBe(false);
  });
});
