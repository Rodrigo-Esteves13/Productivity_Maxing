import { describe, expect, it } from 'vitest';
import { LEGACY_OVERDUE_CHECK_KEY, overdueCheckKey } from './overdueCheckKey';

describe('overdueCheckKey (F-04)', () => {
  it('is different per user and never the old global key', () => {
    expect(overdueCheckKey('u1')).not.toBe(overdueCheckKey('u2'));
    expect(overdueCheckKey('u1')).not.toBe(LEGACY_OVERDUE_CHECK_KEY);
  });
});
