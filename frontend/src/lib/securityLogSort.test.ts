import { describe, expect, it } from 'vitest';
import { nextSecurityLogSort } from './securityLogSort';

describe('nextSecurityLogSort', () => {
  it('toggles the active column', () => {
    expect(nextSecurityLogSort({ key: 'ip', direction: 'asc' }, 'ip')).toEqual({ key: 'ip', direction: 'desc' });
  });

  it('starts a new column ascending, date descending', () => {
    expect(nextSecurityLogSort({ key: 'ip', direction: 'desc' }, 'path')).toEqual({ key: 'path', direction: 'asc' });
    expect(nextSecurityLogSort({ key: 'ip', direction: 'asc' }, 'createdAt')).toEqual({
      key: 'createdAt',
      direction: 'desc',
    });
  });
});
