import { maskIp, truncateUserAgent } from './session-client.util';
import { USER_AGENT_MAX_LENGTH } from './session.constants';

describe('maskIp', () => {
  it('keeps only the first three octets of an IPv4 address', () => {
    expect(maskIp('203.0.113.42')).toBe('203.0.113.x');
  });

  it('treats an IPv4-mapped IPv6 address as IPv4', () => {
    expect(maskIp('::ffff:198.51.100.7')).toBe('198.51.100.x');
  });

  it('keeps only the first three groups (/48) of an IPv6 address', () => {
    expect(maskIp('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toBe(
      '2001:db8:85a3::x',
    );
  });

  it('expands compressed IPv6 before cutting', () => {
    expect(maskIp('2001:db8::1')).toBe('2001:db8:0::x');
    expect(maskIp('::1')).toBe('0:0:0::x');
  });

  it('never returns the full address', () => {
    const ip = '192.0.2.200';
    expect(maskIp(ip)).not.toContain('200');
  });

  it('returns null for values that are not IPs', () => {
    expect(maskIp(undefined)).toBeNull();
    expect(maskIp('')).toBeNull();
    expect(maskIp('not-an-ip')).toBeNull();
  });
});

describe('truncateUserAgent', () => {
  it('cuts long user agents to the column limit', () => {
    const long = 'Mozilla/5.0 '.repeat(100);
    const result = truncateUserAgent(long);
    expect(result).toHaveLength(USER_AGENT_MAX_LENGTH);
  });

  it('strips control characters', () => {
    expect(truncateUserAgent('Mozilla\u0000/5.0\n(Test)')).toBe(
      'Mozilla/5.0(Test)',
    );
  });

  it('returns null for empty values', () => {
    expect(truncateUserAgent(undefined)).toBeNull();
    expect(truncateUserAgent('   ')).toBeNull();
  });
});
