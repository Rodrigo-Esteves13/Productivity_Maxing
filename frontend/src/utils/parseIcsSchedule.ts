import type { ImportScheduleRow } from '../types/models';
import { translateNow } from '../i18n/translate';

// Fuso horário da app: muitos portais publicam em UTC (sufixo "Z") ou com
// TZID; o resto da feature (ClassOccurrence.startMinutes,
// User.quietHoursStart, o StudyPlanService) trabalha sempre em hora local
// de Lisboa. Esta conversão é o único sítio onde isso acontece - depois
// disto, "minutos desde a meia-noite" já não precisa de saber que fusos
// horários existem.
const SCHEDULE_TIMEZONE = 'Europe/Lisbon';

/**
 * Opções de import, para qualquer instituição (nada aqui é específico de
 * uma universidade). Tudo opcional - sem opções, o comportamento é o
 * "automático" de sempre.
 */
export interface IcsImportOptions {
  // Como tirar o nome da disciplina do SUMMARY:
  // 'auto' = separa por `subjectSeparator`; com 3+ partes usa a 3ª (formato
  //          "curso | ano | disciplina | turma"), senão o título inteiro;
  // 'whole' = título inteiro; número (1-based) = essa parte.
  subjectSegment: 'auto' | 'whole' | number;
  subjectSeparator: string;
  // Palavras que introduzem o docente na DESCRIPTION ("Docente:",
  // "Professor:", "Teacher:"...). Case-insensitive, sem os ":".
  professorKeywords: string[];
  // Só importa eventos cujo SUMMARY contenha PELO MENOS uma (vazio = todos).
  includeKeywords: string[];
  // Ignora eventos cujo SUMMARY contenha alguma (ex: "Feriado", "Exame").
  excludeKeywords: string[];
}

export const DEFAULT_PROFESSOR_KEYWORDS = [
  'docente',
  'professor',
  'professora',
  'teacher',
  'lecturer',
  'instructor',
  'profesor',
];

export const DEFAULT_ICS_IMPORT_OPTIONS: IcsImportOptions = {
  subjectSegment: 'auto',
  subjectSeparator: '|',
  professorKeywords: DEFAULT_PROFESSOR_KEYWORDS,
  includeKeywords: [],
  excludeKeywords: [],
};

export interface ParseIcsScheduleResult {
  rows: ImportScheduleRow[];
  errors: string[];
}

/**
 * Faz parse de um .ics de horário letivo de qualquer instituição (formato
 * ajustável com IcsImportOptions). DELIBERADAMENTE não interpreta RRULE/EXDATE: o
 * ficheiro real não usa nenhum dos dois, é uma lista plana de um VEVENT
 * por aula por semana (ver comentário em ClassOccurrence no
 * schema.prisma) - se um dia a instituição passar a publicar eventos
 * recorrentes, isto ignora RRULE/EXDATE silenciosamente e trata cada
 * VEVENT pela sua própria data, o que continua a ser o comportamento
 * mais seguro (nunca inventa ocorrências que não vêm explícitas no
 * ficheiro).
 */
export function parseIcsSchedule(
  icsText: string,
  options: Partial<IcsImportOptions> = {},
): ParseIcsScheduleResult {
  const opts: IcsImportOptions = { ...DEFAULT_ICS_IMPORT_OPTIONS, ...options };
  const lines = unfoldLines(icsText);
  const events = splitIntoVEvents(lines);

  const rows: ImportScheduleRow[] = [];
  const errors: string[] = [];

  events.forEach((eventLines, index) => {
    try {
      const row = parseVEvent(eventLines, opts);
      if (row) rows.push(row);
    } catch (error) {
      const message = error instanceof Error ? error.message : translateNow('import.unknownError');
      errors.push(translateNow('import.icsEventError', { n: index + 1, message }));
    }
  });

  return { rows, errors };
}

// Junta linhas "dobradas" (continuação de uma propriedade longa numa
// linha seguinte que começa com espaço/tab) num único array de linhas
// lógicas - regra do RFC 5545. O export da Maiêutica não usa isto na
// prática (as linhas longas, ex: SUMMARY, vêm inteiras), mas é barato de
// suportar corretamente e evita um parser frágil no dia em que mudar.
function unfoldLines(icsText: string): string[] {
  const rawLines = icsText.split(/\r\n|\n|\r/);
  const logical: string[] = [];

  for (const line of rawLines) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && logical.length > 0) {
      logical[logical.length - 1] += line.slice(1);
    } else if (line.length > 0) {
      logical.push(line);
    }
  }

  return logical;
}

function splitIntoVEvents(lines: string[]): string[][] {
  const events: string[][] = [];
  let current: string[] | null = null;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      current = [];
    } else if (line === 'END:VEVENT') {
      if (current) events.push(current);
      current = null;
    } else if (current) {
      current.push(line);
    }
  }

  return events;
}

const ICS_STATUS_CANCELLED = 'CANCELLED';

function parseVEvent(
  lines: string[],
  opts: IcsImportOptions,
): ImportScheduleRow | null {
  const props = new Map<string, string>();
  // Parâmetros (ex: TZID) por propriedade.
  const params = new Map<string, string>();

  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;
    // "SUMMARY;LANGUAGE=pt-pt" -> nome da propriedade é só "SUMMARY", o
    // resto antes do ':' são parâmetros que não precisamos de interpretar
    // aqui (não olhamos para TZID, por exemplo - ver nota no cabeçalho
    // do ficheiro sobre isto assumir sempre UTC/Z).
    const [rawName, ...rawParams] = line.slice(0, colonIndex).split(';');
    const name = rawName.toUpperCase();
    const value = line.slice(colonIndex + 1);
    const tzid = rawParams.find((p) => p.toUpperCase().startsWith('TZID='));
    if (tzid) params.set(name, tzid.slice(5).replace(/^"|"$/g, ''));
    // Se a mesma propriedade aparecer duas vezes (não deveria, mas por
    // segurança), fica a última - não vale a pena rebentar o import
    // inteiro por causa disso.
    props.set(name, value);
  }

  const uid = props.get('UID');
  const dtstartRaw = props.get('DTSTART');
  const dtendRaw = props.get('DTEND');
  const summaryRaw = props.get('SUMMARY');

  if (!uid) throw new Error('Missing UID.');
  if (!dtstartRaw) throw new Error('Missing DTSTART.');
  if (!dtendRaw) throw new Error('Missing DTEND.');
  if (!summaryRaw) throw new Error('Missing SUMMARY.');

  // Aula cancelada no portal: nao e aula (nao bloqueia o plano, nao conta
  // como presenca por marcar, nao vai para o Google).
  if (props.get('STATUS')?.trim().toUpperCase() === ICS_STATUS_CANCELLED) return null;
  if (!passesKeywordFilters(summaryRaw, opts)) return null;

  const start = toLisbonWallClock(dtstartRaw, params.get('DTSTART'));
  const end = toLisbonWallClock(dtendRaw, params.get('DTEND') ?? params.get('DTSTART'));

  if (end.dateKey !== start.dateKey) {
    // Uma aula que atravessa a meia-noite local não é algo que se espere
    // de um horário universitário - mais provável ser um erro de fuso
    // horário no ficheiro de origem. Em vez de rejeitar a linha toda,
    // fica só a acontecer no dia de início e vai até ao fim desse dia -
    // melhor um bloco ligeiramente errado do que perder a aula.
    end.minutes = 24 * 60;
  }

  if (start.minutes >= end.minutes) {
    throw new Error('DTSTART is not before DTEND.');
  }

  const location = props.get('LOCATION')?.trim() || undefined;
  const description = props.get('DESCRIPTION');

  return {
    date: `${start.dateKey}T00:00:00.000Z`,
    startMinutes: start.minutes,
    endMinutes: end.minutes,
    subject: extractSubject(summaryRaw, opts),
    location,
    professor: description ? extractProfessor(description, opts) : undefined,
    externalUid: uid.trim(),
  };
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

// Include/exclude por palavra-chave (sem acentos, sem maiúsculas).
function passesKeywordFilters(summary: string, opts: IcsImportOptions): boolean {
  const text = normalize(unescapeIcsText(summary));
  const has = (kw: string) => kw.trim() !== '' && text.includes(normalize(kw.trim()));
  if (opts.excludeKeywords.some(has)) return false;
  if (opts.includeKeywords.some((k) => k.trim() !== '')) {
    return opts.includeKeywords.some(has);
  }
  return true;
}

// "1-INF | 3º Ano | Computação Móvel | Turma A" -> "Computação Móvel" (auto).
// Se o formato for outro, escolhe-se a parte (ou o título inteiro) nas
// opções do import; nunca rebenta - cai sempre para o SUMMARY inteiro.
function extractSubject(summary: string, opts: IcsImportOptions): string {
  const whole = unescapeIcsText(summary).trim();
  if (opts.subjectSegment === 'whole' || !opts.subjectSeparator) return whole;

  const parts = whole
    .split(opts.subjectSeparator)
    .map((p) => p.trim())
    .filter(Boolean);

  if (opts.subjectSegment === 'auto') {
    return parts.length >= 3 ? parts[2] : whole;
  }
  return parts[opts.subjectSegment - 1] ?? whole;
}

// DESCRIPTION vem com "\n" escapado e uma linha "<keyword>: Nome" (Docente,
// Professor, Teacher...). As keywords são configuráveis.
function extractProfessor(description: string, opts: IcsImportOptions): string | undefined {
  const keywords = opts.professorKeywords.map((k) => normalize(k.trim()).replace(/:$/, '')).filter(Boolean);
  if (keywords.length === 0) return undefined;
  for (const rawLine of unescapeIcsText(description).split('\n')) {
    const line = rawLine.trim();
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    if (keywords.includes(normalize(line.slice(0, colon).trim()))) {
      return line.slice(colon + 1).trim() || undefined;
    }
  }
  return undefined;
}

// Escaping de texto ICS (RFC 5545 §3.3.11): \\ -> \, \; -> ;, \, -> ,,
// \n ou \N -> quebra de linha real. A ordem importa - \\ tem de ser
// tratado primeiro, senão "\\n" seria lido como "\" + newline em vez de
// ficar como um "\" literal seguido de "n".
//
// O placeholder \uE000 (início da Private Use Area do Unicode, nunca
// usado em texto normal) protege um "\" literal de ser apanhado pelos
// passos seguintes - era \u0000 antes, mas isso é um carácter de
// controlo e o oxlint (no-control-regex) assinalava-o; \uE000 cumpre a
// mesma função sem disparar o aviso.
function unescapeIcsText(value: string): string {
  return value
    .replace(/\\\\/g, '\uE000') // placeholder temporário para "\\" literal
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\uE000/g, '\\');
}

// Converte "20260914T171500Z" (UTC), "20260914T171500" com TZID, ou sem
// fuso (hora local "flutuante") para o dia e minutos na hora da app
// (Europe/Lisbon). Um TZID desconhecido cai para hora local sem converter
// em vez de rebentar o import.
function toLisbonWallClock(
  value: string,
  tzid?: string,
): {
  dateKey: string;
  minutes: number;
} {
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(value);
  if (!match) {
    throw new Error(`Unrecognized date/time format: "${value}".`);
  }

  const [, year, month, day, hour, minute, second, zulu] = match;
  const asUtcMs = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );

  let instantMs: number | null = null;
  if (zulu) {
    instantMs = asUtcMs;
  } else if (tzid && isValidTimeZone(tzid)) {
    instantMs = wallClockToInstant(asUtcMs, tzid);
  }

  // Hora flutuante (sem Z, sem TZID válido): já é hora local, não converter.
  if (instantMs === null) {
    return {
      dateKey: `${year}-${month}-${day}`,
      minutes: Number(hour) * 60 + Number(minute),
    };
  }

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: SCHEDULE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(instantMs));

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '0';
  return {
    dateKey: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
  };
}

function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// Instante UTC cuja hora de parede em `tz` é a pedida (duas passagens
// chegam para corrigir o offset, incl. mudanças de hora).
function wallClockToInstant(wallAsUtcMs: number, tz: string): number {
  const offsetAt = (ms: number) => {
    const p = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(ms));
    const g = (t: string) => Number(p.find((x) => x.type === t)?.value ?? 0);
    return Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second')) - ms;
  };
  let guess = wallAsUtcMs - offsetAt(wallAsUtcMs);
  guess = wallAsUtcMs - offsetAt(guess);
  return guess;
}
