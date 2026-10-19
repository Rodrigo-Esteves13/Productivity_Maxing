import { describe, expect, it } from 'vitest';
import { telemetryUrl } from './telemetryUrl';

describe('telemetryUrl', () => {
  it('keeps only the path (never query or hash)', () => {
    expect(telemetryUrl({ pathname: '/reset-password' })).toBe('/reset-password');
  });

  it('redacts share tokens and pack codes', () => {
    expect(telemetryUrl({ pathname: '/shared/abc123' })).toBe('/shared/[redacted]');
    expect(telemetryUrl({ pathname: '/packs/Xy9' })).toBe('/packs/[redacted]');
  });

  it('leaves normal pages untouched', () => {
    expect(telemetryUrl({ pathname: '/tasks' })).toBe('/tasks');
  });
});
