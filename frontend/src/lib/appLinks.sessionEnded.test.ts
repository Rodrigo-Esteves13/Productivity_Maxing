import { describe, expect, it } from 'vitest';
import { loginPathAfterSessionEnded } from './appLinks';

describe('loginPathAfterSessionEnded', () => {
  it('keeps the page and query the user was on', () => {
    expect(loginPathAfterSessionEnded('/wellbeing', '?tab=meds')).toBe('/login?redirect=%2Fwellbeing%3Ftab%3Dmeds');
  });

  it('falls back to plain login for the root and auth pages', () => {
    expect(loginPathAfterSessionEnded('/')).toBe('/login');
    expect(loginPathAfterSessionEnded('/login')).toBe('/login');
    expect(loginPathAfterSessionEnded('/login/2fa')).toBe('/login');
    expect(loginPathAfterSessionEnded('/auth/callback')).toBe('/login');
  });

  it('does not treat similar prefixes as auth pages', () => {
    expect(loginPathAfterSessionEnded('/authors')).toBe('/login?redirect=%2Fauthors');
  });
});
