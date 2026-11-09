import { escapeCsvField } from './taskExportFormats';
import { parseUserAgent } from '../lib/userAgent';
import { displayMaskedIp } from '../lib/maskedIp';

// Resposta de GET /auth/security-activity/export (datas em ISO). So dados da
// propria conta; o backend nunca manda hashes, tokens nem o IP completo.
export type SessionRevokeReason =
  | 'LOGOUT'
  | 'REVOKED_BY_USER'
  | 'SIGNED_OUT_OTHERS'
  | 'GLOBAL_SIGNOUT'
  | 'TOKEN_REUSE';

export type SecurityActivityEventType = 'REFRESH_TOKEN_REUSE' | 'RATE_LIMIT_EXCEEDED';

export interface SecurityActivitySession {
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  revokedAt: string | null;
  revokedReason: SessionRevokeReason | null;
  userAgent: string | null;
  ipMasked: string | null;
  current: boolean;
}

export interface SecurityActivityEvent {
  type: SecurityActivityEventType;
  firstAt: string;
  lastAt: string;
  count: number;
}

export interface SecurityActivityExport {
  generatedAt: string;
  accountCreatedAt: string | null;
  twoFactorEnabledAt: string | null;
  sessions: SecurityActivitySession[];
  events: SecurityActivityEvent[];
  sessionsTruncated: boolean;
  eventsTruncated: boolean;
}

type Translate = (key: string, vars?: Record<string, string | number>) => string;

// Colunas do CSV, por ordem. O cabecalho e traduzido por quem chama via
// securityExport.col.<chave>.
export const SECURITY_CSV_COLUMNS = ['date', 'event', 'device', 'ip', 'details'] as const;

interface CsvRow {
  date: string;
  event: string;
  device: string;
  ip: string;
  details: string;
}

function deviceLabel(userAgent: string | null, t: Translate): string {
  const parsed = parseUserAgent(userAgent);
  return t('devices.browserOnSystem', {
    browser: parsed.browser ?? t('devices.unknownBrowser'),
    os: parsed.os ?? t('devices.unknownSystem'),
  });
}

function sessionRows(session: SecurityActivitySession, t: Translate): CsvRow[] {
  const device = deviceLabel(session.userAgent, t);
  const ip = session.ipMasked ? displayMaskedIp(session.ipMasked) : '';
  const details = session.current ? t('securityExport.detail.thisDevice') : '';
  const rows: CsvRow[] = [
    { date: session.createdAt, event: t('securityExport.event.signedIn'), device, ip, details },
    { date: session.lastSeenAt, event: t('securityExport.event.lastActive'), device, ip, details },
  ];
  if (session.revokedAt) {
    rows.push({
      date: session.revokedAt,
      event: t('securityExport.event.signedOut'),
      device,
      ip,
      details: session.revokedReason ? t(`securityExport.reason.${session.revokedReason}`) : '',
    });
  }
  return rows;
}

function eventRow(event: SecurityActivityEvent, t: Translate): CsvRow {
  return {
    date: event.lastAt,
    event: t(`securityExport.securityEvent.${event.type}`),
    device: '',
    ip: '',
    details: t('securityExport.detail.occurrences', { count: event.count, first: event.firstAt }),
  };
}

/**
 * CSV da atividade de seguranca: uma linha por acontecimento, mais recente
 * primeiro. Todas as celulas passam por escapeCsvField (injecao de formulas).
 */
export function securityActivityToCsv(data: SecurityActivityExport, t: Translate): string {
  const rows: CsvRow[] = [];
  if (data.accountCreatedAt) {
    rows.push({ date: data.accountCreatedAt, event: t('securityExport.event.accountCreated'), device: '', ip: '', details: '' });
  }
  if (data.twoFactorEnabledAt) {
    rows.push({ date: data.twoFactorEnabledAt, event: t('securityExport.event.twoFactorEnabled'), device: '', ip: '', details: '' });
  }
  for (const session of data.sessions) rows.push(...sessionRows(session, t));
  for (const event of data.events) rows.push(eventRow(event, t));

  // ISO 8601 em UTC ordena bem como texto; estavel para datas iguais.
  rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  const header = SECURITY_CSV_COLUMNS.map((key) => escapeCsvField(t(`securityExport.col.${key}`))).join(',');
  const lines = rows.map((row) => SECURITY_CSV_COLUMNS.map((key) => escapeCsvField(row[key])).join(','));
  return [header, ...lines].join('\n') + '\n';
}
