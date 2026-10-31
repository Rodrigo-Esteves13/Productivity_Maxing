import { describe, expect, it } from 'vitest';
import { friendLinkUrl, parseFriendInput } from './friendLink';

describe('friend links', () => {
  const link = { code: 'k3J9xQ2mVb', expires: 1793400000000, token: 'abc_DEF-123' };

  it('o link volta a dar o codigo e a assinatura', () => {
    const url = friendLinkUrl(link, 'https://pmaxing.pt');
    expect(url).toBe('https://pmaxing.pt/social/add/k3J9xQ2mVb?e=1793400000000&t=abc_DEF-123');
    expect(parseFriendInput(url)).toEqual({ friendCode: 'k3J9xQ2mVb', expires: 1793400000000, token: 'abc_DEF-123' });
  });

  it('aceita so o codigo, e um link sem assinatura fica so com o codigo', () => {
    expect(parseFriendInput('  k3J9xQ2mVb ')).toEqual({ friendCode: 'k3J9xQ2mVb' });
    expect(parseFriendInput('https://pmaxing.pt/social/add/k3J9xQ2mVb')).toEqual({ friendCode: 'k3J9xQ2mVb' });
  });

  it('recusa outro texto', () => {
    expect(parseFriendInput('https://example.com/other/page')).toBeNull();
    expect(parseFriendInput('not a code!')).toBeNull();
  });
});
