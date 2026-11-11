import { describe, expect, it } from 'vitest';
import { avatarTierFor } from './avatarTier';

describe('avatarTierFor', () => {
  it('picks the highest tier reached', () => {
    expect(avatarTierFor(0).key).toBe('starter');
    expect(avatarTierFor(9).key).toBe('starter');
    expect(avatarTierFor(10).key).toBe('bronze');
    expect(avatarTierFor(99).key).toBe('silver');
    expect(avatarTierFor(100).key).toBe('gold');
    expect(avatarTierFor(900).key).toBe('legend');
  });
});
