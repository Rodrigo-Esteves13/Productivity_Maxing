import { sanitizeClientUrl } from './client-url.util';

describe('sanitizeClientUrl', () => {
  it('drops the hash with the password recovery token', () => {
    expect(
      sanitizeClientUrl(
        'https://app.pmaxing.pt/reset-password#access_token=eyJ.secret&type=recovery',
      ),
    ).toBe('/reset-password');
  });

  it('drops the query string', () => {
    expect(sanitizeClientUrl('/login?redirect=%2Fpacks%2Fabc')).toBe('/login');
  });

  it('redacts share tokens and pack codes in the path', () => {
    expect(sanitizeClientUrl('https://app.pmaxing.pt/shared/tok123')).toBe(
      '/shared/[redacted]',
    );
    expect(sanitizeClientUrl('/packs/Xy9_k')).toBe('/packs/[redacted]');
  });

  it('keeps ordinary paths', () => {
    expect(sanitizeClientUrl('/dashboard')).toBe('/dashboard');
  });
});
