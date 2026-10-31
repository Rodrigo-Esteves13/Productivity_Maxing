import { createHmac } from 'crypto';
import { RefreshTokenCodec } from './refresh-token.codec';
import { isAllowedRefreshOrigin } from './refresh-origin.util';

const SESSION_ID = '0b9a4f8e-3c55-4d0f-9a43-7d1f0a6f2e11';

describe('RefreshTokenCodec', () => {
  const codec = new RefreshTokenCodec('codec-spec-secret');

  it('mints a token bound to the session and stores only its hash', () => {
    const { token, hash } = codec.mint(SESSION_ID);
    expect(token.startsWith(`${SESSION_ID}.`)).toBe(true);
    expect(hash).toBe(RefreshTokenCodec.hash(token));
    expect(hash).not.toContain(token);
    expect(codec.parse(token)).toBe(SESSION_ID);
  });

  it('mints a different token every time', () => {
    expect(codec.mint(SESSION_ID).token).not.toBe(codec.mint(SESSION_ID).token);
  });

  it('rejects a token whose mac was forged for a known session id', () => {
    const { token } = codec.mint(SESSION_ID);
    const [id, nonce] = token.split('.');
    expect(codec.parse(`${id}.${nonce}.forgedmac`)).toBeNull();
  });

  it('rejects a token signed with another secret', () => {
    const other = new RefreshTokenCodec('another-secret');
    expect(codec.parse(other.mint(SESSION_ID).token)).toBeNull();
  });

  it('rejects malformed values', () => {
    expect(codec.parse(undefined)).toBeNull();
    expect(codec.parse('')).toBeNull();
    expect(codec.parse('a.b')).toBeNull();
    expect(codec.parse('not-a-uuid.abc.def')).toBeNull();
  });

  it('refuses to start without a secret', () => {
    expect(() => new RefreshTokenCodec('')).toThrow();
  });

  it('rejects tampering with any segment of a real token', () => {
    const { token } = codec.mint(SESSION_ID);
    const [id, nonce, mac] = token.split('.');
    const flip = (s: string) =>
      `${s.slice(0, -1)}${s.endsWith('A') ? 'B' : 'A'}`;
    expect(codec.parse(`${id}.${flip(nonce)}.${mac}`)).toBeNull();
    expect(codec.parse(`${id}.${nonce}.${flip(mac)}`)).toBeNull();
    // Mesmo id noutra capitalizacao: o mac foi calculado sobre o original.
    expect(codec.parse(`${id.toUpperCase()}.${nonce}.${mac}`)).toBeNull();
    // Outra sessao com o mac desta.
    expect(
      codec.parse(`1c9a4f8e-3c55-4d0f-9a43-7d1f0a6f2e11.${nonce}.${mac}`),
    ).toBeNull();
    expect(codec.parse(`${token}.extra`)).toBeNull();
    expect(codec.parse(`${id}.${nonce}.${mac}=`)).toBeNull();
    expect(codec.parse(`${id}.${nonce}.${mac.slice(0, -2)}`)).toBeNull();
  });

  it('derives a MAC key different from the raw secret (domain separation)', () => {
    // Um HMAC feito com o JWT_SECRET cru nunca passa como mac de refresh.
    const nonce = 'a'.repeat(43);
    const rawMac = createHmac('sha256', 'codec-spec-secret')
      .update(`${SESSION_ID}.${nonce}`)
      .digest('base64url');
    expect(codec.parse(`${SESSION_ID}.${nonce}.${rawMac}`)).toBeNull();
  });
});

describe('isAllowedRefreshOrigin', () => {
  const FRONTEND = 'https://app.pmaxing.pt';

  it('accepts the frontend origin', () => {
    expect(isAllowedRefreshOrigin('https://app.pmaxing.pt', FRONTEND)).toBe(
      true,
    );
  });

  it('refuses other origins and a missing Origin header', () => {
    expect(isAllowedRefreshOrigin('https://evil.example', FRONTEND)).toBe(
      false,
    );
    expect(isAllowedRefreshOrigin('http://app.pmaxing.pt', FRONTEND)).toBe(
      false,
    );
    expect(isAllowedRefreshOrigin(undefined, FRONTEND)).toBe(false);
    expect(isAllowedRefreshOrigin('null', FRONTEND)).toBe(false);
  });

  it.each([
    ['suffix host', 'https://app.pmaxing.pt.evil.com'],
    ['userinfo trick', 'https://app.pmaxing.pt@evil.com'],
    ['prefix in path', 'https://evil.com/https://app.pmaxing.pt'],
    ['subdomain of the app', 'https://x.app.pmaxing.pt'],
    ['sibling subdomain (same site)', 'https://pads.pmaxing.pt'],
    ['other port', 'https://app.pmaxing.pt:8443'],
    ['empty string', ''],
    ['garbage', 'not a url'],
  ])('refuses %s', (_label, origin) => {
    expect(isAllowedRefreshOrigin(origin, FRONTEND)).toBe(false);
  });

  it('accepts equivalent spellings of the same origin', () => {
    expect(isAllowedRefreshOrigin('https://app.pmaxing.pt/', FRONTEND)).toBe(
      true,
    );
    expect(isAllowedRefreshOrigin('https://app.pmaxing.pt:443', FRONTEND)).toBe(
      true,
    );
    expect(isAllowedRefreshOrigin('https://APP.pmaxing.pt', FRONTEND)).toBe(
      true,
    );
    expect(
      isAllowedRefreshOrigin('https://app.pmaxing.pt', `${FRONTEND}/`),
    ).toBe(true);
  });

  it('fails closed when FRONTEND_URL itself is not a URL', () => {
    expect(isAllowedRefreshOrigin('https://app.pmaxing.pt', 'nope')).toBe(
      false,
    );
  });
});
