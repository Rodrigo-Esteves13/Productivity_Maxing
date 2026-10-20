import { canPasswordCredentialOpenAccount } from './password-link.policy';

describe('canPasswordCredentialOpenAccount (SCR-002)', () => {
  it('opens an account whose linked credential matches', () => {
    expect(
      canPasswordCredentialOpenAccount({ supabaseAuthId: 'sb1' }, 'sb1', 0),
    ).toBe(true);
  });

  it('refuses a different credential for an account that already has one', () => {
    expect(
      canPasswordCredentialOpenAccount({ supabaseAuthId: 'sb1' }, 'sb2', 0),
    ).toBe(false);
  });

  it('refuses any credential for an OAuth-only account', () => {
    expect(
      canPasswordCredentialOpenAccount({ supabaseAuthId: null }, 'sb9', 1),
    ).toBe(false);
  });

  it('keeps old password accounts (no supabaseAuthId, no OAuth) working', () => {
    expect(
      canPasswordCredentialOpenAccount({ supabaseAuthId: null }, 'sb1', 0),
    ).toBe(true);
  });
});
