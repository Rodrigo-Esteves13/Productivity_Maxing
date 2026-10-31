import { describe, expect, it } from 'vitest';
import { displayMaskedIp } from './maskedIp';

describe('displayMaskedIp', () => {
  it('shows localhost for IPv6 and IPv4 loopback consistently', () => {
    expect(displayMaskedIp('0:0:0::x')).toBe('localhost');
    expect(displayMaskedIp('127.0.0.x')).toBe('localhost');
    expect(displayMaskedIp('127.1.2.x')).toBe('localhost');
  });

  it('leaves other masked values unchanged', () => {
    expect(displayMaskedIp('203.0.113.x')).toBe('203.0.113.x');
    expect(displayMaskedIp('2001:db8:85a3::x')).toBe('2001:db8:85a3::x');
    expect(displayMaskedIp('1127.0.0.x')).toBe('1127.0.0.x');
  });
});
