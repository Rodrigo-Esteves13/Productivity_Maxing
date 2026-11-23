import {
  TOTP_STEP_SECONDS,
  base32Decode,
  base32Encode,
  buildOtpauthUri,
  currentTotpStep,
  generateTotpSecret,
  hotp,
  verifyTotp,
} from './totp.util';

// RFC 6238 apendice B: segredo ASCII "12345678901234567890", SHA1.
const RFC_SECRET = base32Encode(Buffer.from('12345678901234567890'));
const NOW = 1_700_000_000_000;

function codeAtStep(step: number): string {
  return hotp(base32Decode(RFC_SECRET), step);
}

describe('totp.util risk', () => {
  it('matches the RFC 6238 vector (t=59 -> 287082)', () => {
    expect(codeAtStep(currentTotpStep(59_000))).toBe('287082');
  });

  it('accepts the current step and returns it', () => {
    const step = currentTotpStep(NOW);
    expect(verifyTotp(RFC_SECRET, codeAtStep(step), NOW)).toBe(step);
  });

  it('accepts +-1 step (clock skew)', () => {
    const step = currentTotpStep(NOW);
    expect(verifyTotp(RFC_SECRET, codeAtStep(step - 1), NOW)).toBe(step - 1);
    expect(verifyTotp(RFC_SECRET, codeAtStep(step + 1), NOW)).toBe(step + 1);
  });

  it('rejects +-2 steps', () => {
    const step = currentTotpStep(NOW);
    expect(verifyTotp(RFC_SECRET, codeAtStep(step - 2), NOW)).toBeNull();
    expect(verifyTotp(RFC_SECRET, codeAtStep(step + 2), NOW)).toBeNull();
  });

  it('rejects malformed codes before decoding the secret', () => {
    for (const bad of ['', '12345', '1234567', 'abcdef', '12 456', '12345a']) {
      expect(verifyTotp('not base32 !!!', bad, NOW)).toBeNull();
    }
  });

  it('rejects a wrong 6 digit code', () => {
    const step = currentTotpStep(NOW);
    const neighbours = [step - 1, step, step + 1].map(codeAtStep);
    const wrong = ['000000', '000001'].find((c) => !neighbours.includes(c));
    expect(wrong).toBeDefined();
    expect(verifyTotp(RFC_SECRET, wrong as string, NOW)).toBeNull();
  });

  it('produces zero padded 6 digit codes', () => {
    for (let s = 0; s < 200; s += 1) {
      expect(codeAtStep(s)).toMatch(/^\d{6}$/);
    }
  });

  it('honours a custom window', () => {
    const step = currentTotpStep(NOW);
    expect(verifyTotp(RFC_SECRET, codeAtStep(step + 1), NOW, 0)).toBeNull();
    expect(verifyTotp(RFC_SECRET, codeAtStep(step + 2), NOW, 2)).toBe(step + 2);
  });

  it('round trips base32 and generates 160 bit secrets', () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(base32Encode(base32Decode(secret))).toBe(secret);
    expect(generateTotpSecret()).not.toBe(secret);
  });

  it('rejects invalid base32 characters', () => {
    expect(() => base32Decode('abc1')).toThrow('Invalid base32 character.');
  });

  it('builds a valid otpauth URI', () => {
    const uri = buildOtpauthUri({
      secret: 'ABC234',
      accountName: 'u@example.test',
      issuer: 'Productivity Maxing',
    });
    const parsed = new URL(uri);
    expect(parsed.protocol).toBe('otpauth:');
    expect(parsed.host).toBe('totp');
    expect(decodeURIComponent(parsed.pathname)).toBe(
      '/Productivity Maxing:u@example.test',
    );
    expect(parsed.searchParams.get('secret')).toBe('ABC234');
    expect(parsed.searchParams.get('digits')).toBe('6');
    expect(parsed.searchParams.get('period')).toBe(String(TOTP_STEP_SECONDS));
    expect(parsed.searchParams.get('algorithm')).toBe('SHA1');
  });
});
