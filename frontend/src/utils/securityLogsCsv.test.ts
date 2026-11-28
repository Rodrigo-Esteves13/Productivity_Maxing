import { describe, expect, it } from 'vitest';
import type { SecurityLog } from '../types/models';
import { SECURITY_LOGS_CSV_COLUMNS, securityLogsToCsv } from './securityLogsCsv';

const log: SecurityLog = {
  id: '1',
  type: 'RATE_LIMIT_EXCEEDED',
  ip: '203.0.113.7',
  method: 'POST',
  path: '/auth/login',
  userAgent: '=cmd|calc',
  count: 3,
  createdAt: '2026-01-01T00:00:00.000Z',
  userId: null,
  user: null,
};

describe('securityLogsToCsv', () => {
  it('writes header and one row per log', () => {
    const csv = securityLogsToCsv([log], [...SECURITY_LOGS_CSV_COLUMNS]);
    const lines = csv.split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe(SECURITY_LOGS_CSV_COLUMNS.join(','));
    expect(lines[1]).toContain('203.0.113.7');
    expect(lines[1]).toContain('3');
  });

  it('neutralizes spreadsheet formulas in user agent', () => {
    const csv = securityLogsToCsv([log], [...SECURITY_LOGS_CSV_COLUMNS]);
    expect(csv).not.toMatch(/,=cmd/);
  });

  it('header only for an empty list', () => {
    expect(securityLogsToCsv([], ['a', 'b'])).toBe('a,b');
  });
});
