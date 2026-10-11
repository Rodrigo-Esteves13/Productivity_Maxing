// Lógica PURA do feed .ics (sem Prisma, sem rede, sem relógio): recebe
// eventos já calculados e devolve o texto iCalendar (RFC 5545). O
// CalendarFeedService carrega os dados; isto só os formata.

export interface FeedEvent {
  // Estável entre pedidos (nunca muda para o mesmo evento) - é o que deixa o
  // cliente de calendário atualizar um evento em vez de o duplicar.
  uid: string;
  title: string;
  description?: string | null;
  location?: string | null;
  // Categoria mostrada em alguns clientes (aula, trabalho, estudo, task...).
  category?: string | null;
  // Evento com hora: instantes UTC já resolvidos.
  start?: Date;
  end?: Date;
  // Evento de dia inteiro: "YYYY-MM-DD" (fim exclusivo = dia seguinte).
  allDayDate?: string;
}

const CRLF = '\r\n';
const PRODUCT_ID = '-//Productivity Maxing//Calendar Feed//EN';
const LISBON_TZ = 'Europe/Lisbon';

/** Escapa texto de propriedade (RFC 5545 3.3.11). */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/**
 * Dobra uma linha a 75 octetos (RFC 5545 3.1). Conta BYTES UTF-8, não
 * caracteres - um título com acentos passava dos 75 octetos sem dar por
 * isso e alguns clientes rejeitam o feed inteiro.
 */
export function foldIcsLine(line: string): string {
  const MAX_OCTETS = 75;
  const chunks: string[] = [];
  let current = '';
  let currentBytes = 0;
  // Continuações começam com 1 espaço, que também conta para o limite.
  let limit = MAX_OCTETS;

  for (const char of line) {
    const bytes = Buffer.byteLength(char, 'utf8');
    if (currentBytes + bytes > limit) {
      chunks.push(current);
      current = '';
      currentBytes = 0;
      limit = MAX_OCTETS - 1;
    }
    current += char;
    currentBytes += bytes;
  }
  chunks.push(current);
  return chunks.join(`${CRLF} `);
}

function pad(n: number, size = 2): string {
  return String(n).padStart(size, '0');
}

export function formatIcsUtc(date: Date): string {
  return (
    `${pad(date.getUTCFullYear(), 4)}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}

function formatIcsDate(dateKey: string): string {
  return dateKey.replace(/-/g, '');
}

function nextDayKey(dateKey: string): string {
  const d = new Date(`${dateKey}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// Diferença Lisboa - UTC (em minutos) num instante concreto. O processo
// corre em UTC no Render, por isso nunca se usa getHours() local.
function lisbonOffsetMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: LISBON_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  // `at` sem milissegundos para a diferença ser um número redondo de minutos.
  const atSeconds = Math.floor(at.getTime() / 1000) * 1000;
  return Math.round((asUtc - atSeconds) / 60000);
}

/**
 * "Dia + minutos desde a meia-noite, em hora de Lisboa" -> instante UTC.
 * É o formato em que a app guarda aulas/turnos/blocos de estudo. Faz uma
 * segunda passagem porque o offset pode mudar entre o palpite e o
 * resultado (noite da mudança de hora).
 */
export function lisbonWallClockToUtc(
  dateKey: string,
  minutesSinceMidnight: number,
): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  const guess =
    Date.UTC(year, month - 1, day, 0, 0, 0) + minutesSinceMidnight * 60000;
  const firstOffset = lisbonOffsetMinutes(new Date(guess));
  let utc = guess - firstOffset * 60000;
  const secondOffset = lisbonOffsetMinutes(new Date(utc));
  if (secondOffset !== firstOffset) utc = guess - secondOffset * 60000;
  return new Date(utc);
}

function eventLines(event: FeedEvent, stamp: string): string[] {
  const lines: string[] = [
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `DTSTAMP:${stamp}`,
  ];

  if (event.allDayDate) {
    lines.push(`DTSTART;VALUE=DATE:${formatIcsDate(event.allDayDate)}`);
    lines.push(
      `DTEND;VALUE=DATE:${formatIcsDate(nextDayKey(event.allDayDate))}`,
    );
    // Dia inteiro "livre": não deve marcar o dia como ocupado.
    lines.push('TRANSP:TRANSPARENT');
  } else if (event.start && event.end) {
    lines.push(`DTSTART:${formatIcsUtc(event.start)}`);
    lines.push(`DTEND:${formatIcsUtc(event.end)}`);
  } else {
    return [];
  }

  lines.push(`SUMMARY:${escapeIcsText(event.title)}`);
  if (event.description) {
    lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
  }
  if (event.location) lines.push(`LOCATION:${escapeIcsText(event.location)}`);
  if (event.category) lines.push(`CATEGORIES:${escapeIcsText(event.category)}`);
  lines.push('END:VEVENT');
  return lines;
}

/** Texto completo do .ics (linhas dobradas, terminadas em CRLF). */
export function buildIcsFeed(
  events: FeedEvent[],
  options: { calendarName: string; now?: Date },
): string {
  const stamp = formatIcsUtc(options.now ?? new Date());
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODUCT_ID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(options.calendarName)}`,
    `X-WR-TIMEZONE:${LISBON_TZ}`,
    // Dicas de refresh (Apple/Outlook respeitam; o Google decide sozinho).
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
  ];

  for (const event of events) lines.push(...eventLines(event, stamp));
  lines.push('END:VCALENDAR');

  return lines.map(foldIcsLine).join(CRLF) + CRLF;
}
