import { describe, expect, it } from 'vitest';
import { guessSupportCountry, SUPPORT_LINES, telHref } from './supportLines';

describe('support lines', () => {
  it('every country has an emergency number', () => {
    for (const lines of Object.values(SUPPORT_LINES)) {
      expect(lines.some((l) => l.kind === 'EMERGENCY')).toBe(true);
    }
  });

  it('uses the browser region first, then the app language', () => {
    expect(guessSupportCountry('pt', ['pt-BR', 'en-US'])).toBe('BR');
    expect(guessSupportCountry('pt', ['pt'])).toBe('PT');
    expect(guessSupportCountry('en', ['en-XX'])).toBe('GB');
  });

  it('builds dialable tel links', () => {
    expect(telHref('808 24 24 24')).toBe('tel:808242424');
    expect(telHref('1-800-222-1222')).toBe('tel:18002221222');
  });
});
