import { describe, expect, it } from 'vitest';
import { parseUserAgent } from './userAgent';

describe('parseUserAgent', () => {
  it('recognises Chrome on Windows', () => {
    const ua =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
    expect(parseUserAgent(ua)).toEqual({ browser: 'Chrome', os: 'Windows', kind: 'desktop' });
  });

  it('recognises Edge before Chrome', () => {
    const ua =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0';
    expect(parseUserAgent(ua).browser).toBe('Edge');
  });

  it('recognises Safari on iPhone as mobile', () => {
    const ua =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
    expect(parseUserAgent(ua)).toEqual({ browser: 'Safari', os: 'iOS', kind: 'mobile' });
  });

  it('recognises Firefox on Android as mobile', () => {
    const ua = 'Mozilla/5.0 (Android 14; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0';
    expect(parseUserAgent(ua)).toEqual({ browser: 'Firefox', os: 'Android', kind: 'mobile' });
  });

  it('treats an Android device without Mobile as a tablet', () => {
    const ua =
      'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
    expect(parseUserAgent(ua).kind).toBe('tablet');
  });

  it('returns nulls for an unknown or missing user agent', () => {
    expect(parseUserAgent(null)).toEqual({ browser: null, os: null, kind: 'desktop' });
    expect(parseUserAgent('curl/8.0')).toEqual({ browser: null, os: null, kind: 'desktop' });
  });
});
