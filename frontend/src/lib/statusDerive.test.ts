import { describe, expect, it } from 'vitest';
import { deriveStatus, formatUptime } from './statusDerive';

describe('deriveStatus', () => {
  it('is ok when http ok and database connected', () => {
    const s = deriveStatus(true, { status: 'ok', database: 'connected', uptime: 12 });
    expect(s.overall).toBe('ok');
    expect(s.checks.every((c) => c.state === 'ok')).toBe(true);
    expect(s.uptimeSeconds).toBe(12);
  });

  it('is degraded when the database is unreachable', () => {
    const s = deriveStatus(false, { status: 'error', database: 'unreachable', uptime: 5 });
    expect(s.overall).toBe('degraded');
    expect(s.checks.find((c) => c.id === 'database')?.state).toBe('fail');
    expect(s.checks.find((c) => c.id === 'api')?.state).toBe('ok');
  });

  it('is down for a non-health payload', () => {
    expect(deriveStatus(false, null).overall).toBe('down');
    expect(deriveStatus(false, { message: 'Bad gateway' }).overall).toBe('down');
    expect(deriveStatus(true, 'x').checks).toEqual([]);
  });

  it('ignores a bad uptime', () => {
    expect(deriveStatus(true, { status: 'ok', database: 'connected', uptime: 'x' }).uptimeSeconds).toBeNull();
  });
});

describe('formatUptime', () => {
  it('splits seconds', () => {
    expect(formatUptime(90061)).toEqual({ days: 1, hours: 1, minutes: 1 });
    expect(formatUptime(-5)).toEqual({ days: 0, hours: 0, minutes: 0 });
  });
});
