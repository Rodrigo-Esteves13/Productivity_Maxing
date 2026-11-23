import type { User } from '@prisma/client';
import {
  MergeHardeningError,
  neutralizePreexistingCredential,
  type MergeHardeningDeps,
} from './oauth-merge.policy';

const user = { id: 'u1', supabaseAuthId: 'sb-1' } as unknown as User;
const bumped = { id: 'u1', bumped: true } as unknown as User;

function deps(
  replace: MergeHardeningDeps['replacePassword'] = () => Promise.resolve(null),
) {
  return {
    replacePassword: jest.fn(replace),
    revokeSessions: jest.fn().mockResolvedValue(bumped),
    generatePassword: jest.fn().mockReturnValue('random-pass'),
  };
}

describe('neutralizePreexistingCredential (fail closed)', () => {
  it('replaces the password and revokes sessions on first merge', async () => {
    const d = deps();
    await expect(neutralizePreexistingCredential(d, user, 0)).resolves.toBe(
      bumped,
    );
    expect(d.replacePassword).toHaveBeenCalledWith('sb-1', 'random-pass');
    expect(d.revokeSessions).toHaveBeenCalledWith('u1');
  });

  it('leaves the account alone when it already had an OAuth identity', async () => {
    const d = deps();
    await expect(neutralizePreexistingCredential(d, user, 2)).resolves.toBe(
      user,
    );
    expect(d.replacePassword).not.toHaveBeenCalled();
    expect(d.revokeSessions).not.toHaveBeenCalled();
  });

  it('leaves the account alone when there is no supabase credential', async () => {
    const d = deps();
    const local = { id: 'u2', supabaseAuthId: null } as unknown as User;
    await expect(neutralizePreexistingCredential(d, local, 0)).resolves.toBe(
      local,
    );
    expect(d.replacePassword).not.toHaveBeenCalled();
  });

  it('fails closed on a supabase error: throws, sessions untouched', async () => {
    const d = deps(() => Promise.resolve({ message: 'boom', status: 500 }));
    await expect(neutralizePreexistingCredential(d, user, 0)).rejects.toThrow(
      MergeHardeningError,
    );
    expect(d.revokeSessions).not.toHaveBeenCalled();
  });

  it('fails closed when the replace call itself rejects', async () => {
    const d = deps(() => Promise.reject(new Error('network')));
    await expect(neutralizePreexistingCredential(d, user, 0)).rejects.toThrow(
      'network',
    );
    expect(d.revokeSessions).not.toHaveBeenCalled();
  });

  it.each([
    [{ message: 'nf', status: 404 }],
    [{ message: 'nf', code: 'user_not_found' }],
  ])(
    'treats an unknown credential (%j) as nothing to invalidate',
    async (e) => {
      const d = deps(() => Promise.resolve(e));
      await expect(neutralizePreexistingCredential(d, user, 0)).resolves.toBe(
        user,
      );
      expect(d.revokeSessions).not.toHaveBeenCalled();
    },
  );
});
