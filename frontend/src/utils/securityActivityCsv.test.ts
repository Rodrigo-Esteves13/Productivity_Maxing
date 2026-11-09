import { describe, expect, it } from 'vitest';
import { securityActivityToCsv, type SecurityActivityExport } from './securityActivityCsv';

// t falso: devolve a chave e as variaveis, para o teste nao depender do idioma.
const t = (key: string, vars?: Record<string, string | number>) =>
  vars ? `${key}(${Object.entries(vars).map(([k, v]) => `${k}=${v}`).join(';')})` : key;

const CHROME_WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36';

function baseExport(overrides: Partial<SecurityActivityExport> = {}): SecurityActivityExport {
  return {
    generatedAt: '2026-11-09T12:00:00.000Z',
    accountCreatedAt: '2025-01-01T00:00:00.000Z',
    twoFactorEnabledAt: null,
    sessions: [],
    events: [],
    sessionsTruncated: false,
    eventsTruncated: false,
    ...overrides,
  };
}

function lines(csv: string): string[] {
  return csv.trimEnd().split('\n');
}

describe('securityActivityToCsv', () => {
  it('writes a translated header and a trailing newline', () => {
    const csv = securityActivityToCsv(baseExport({ accountCreatedAt: null }), t);
    expect(csv).toBe(
      'securityExport.col.date,securityExport.col.event,securityExport.col.device,securityExport.col.ip,securityExport.col.details\n',
    );
  });

  it('lists session start, last activity and sign out, newest first', () => {
    const csv = securityActivityToCsv(
      baseExport({
        twoFactorEnabledAt: '2026-03-01T00:00:00.000Z',
        sessions: [
          {
            createdAt: '2026-11-01T10:00:00.000Z',
            lastSeenAt: '2026-11-05T10:00:00.000Z',
            expiresAt: '2026-12-05T10:00:00.000Z',
            revokedAt: '2026-11-06T10:00:00.000Z',
            revokedReason: 'REVOKED_BY_USER',
            userAgent: CHROME_WINDOWS,
            ipMasked: '203.0.113.x',
            current: false,
          },
        ],
      }),
      t,
    );
    const rows = lines(csv).slice(1);
    expect(rows).toHaveLength(5);
    expect(rows[0]).toBe(
      '2026-11-06T10:00:00.000Z,securityExport.event.signedOut,devices.browserOnSystem(browser=Chrome;os=Windows),203.0.113.x,securityExport.reason.REVOKED_BY_USER',
    );
    expect(rows[1]).toContain('securityExport.event.lastActive');
    expect(rows[2]).toContain('securityExport.event.signedIn');
    expect(rows[3]).toContain('securityExport.event.twoFactorEnabled');
    expect(rows[4]).toContain('securityExport.event.accountCreated');
  });

  it('marks the current device and shows loopback as localhost', () => {
    const csv = securityActivityToCsv(
      baseExport({
        accountCreatedAt: null,
        sessions: [
          {
            createdAt: '2026-11-01T10:00:00.000Z',
            lastSeenAt: '2026-11-01T10:00:00.000Z',
            expiresAt: '2026-12-01T10:00:00.000Z',
            revokedAt: null,
            revokedReason: null,
            userAgent: null,
            ipMasked: '127.0.0.x',
            current: true,
          },
        ],
      }),
      t,
    );
    const rows = lines(csv).slice(1);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain(',localhost,securityExport.detail.thisDevice');
    expect(rows[0]).toContain('browser=devices.unknownBrowser');
  });

  it('adds security events with their occurrence count', () => {
    const csv = securityActivityToCsv(
      baseExport({
        accountCreatedAt: null,
        events: [{ type: 'REFRESH_TOKEN_REUSE', firstAt: '2026-11-02T00:00:00.000Z', lastAt: '2026-11-03T00:00:00.000Z', count: 2 }],
      }),
      t,
    );
    expect(lines(csv)[1]).toBe(
      '2026-11-03T00:00:00.000Z,securityExport.securityEvent.REFRESH_TOKEN_REUSE,,,securityExport.detail.occurrences(count=2;first=2026-11-02T00:00:00.000Z)',
    );
  });

  it('neutralizes formula injection in a hostile user agent', () => {
    const csv = securityActivityToCsv(
      baseExport({
        accountCreatedAt: null,
        sessions: [
          {
            createdAt: '2026-11-01T10:00:00.000Z',
            lastSeenAt: '2026-11-01T10:00:00.000Z',
            expiresAt: '2026-12-01T10:00:00.000Z',
            revokedAt: null,
            revokedReason: null,
            userAgent: CHROME_WINDOWS,
            ipMasked: null,
            current: false,
          },
        ],
      }),
      (key, vars) => (key === 'devices.browserOnSystem' ? `=HYPERLINK("x")` : t(key, vars)),
    );
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).not.toMatch(/(^|,)=HYPERLINK/m);
  });
});
