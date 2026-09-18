import type { ImportScheduleRow } from '../types/models';

// Fuso horário fixo: o .ics da Maiêutica publica tudo em UTC (sufixo "Z"
// em DTSTART/DTEND, ver X-WR-TIMEZONE:Europe/Lisbon no cabeçalho do
// ficheiro) e o resto da feature (ClassOccurrence.startMinutes,
// User.quietHoursStart, o StudyPlanService) trabalha sempre em hora local
// de Lisboa. Esta conversão é o único sítio onde isso acontece - depois
// disto, "minutos desde a meia-noite" já não precisa de saber que fusos
// horários existem.
const SCHEDULE_TIMEZONE = 'Europe/Lisbon';

export interface ParseIcsScheduleResult {
  rows: ImportScheduleRow[];
  errors: string[];
}

/**
 * Faz parse de um .ics de horário letivo (testado contra o export real da
 * Maiêutica/UMaia). DELIBERADAMENTE não interpreta RRULE/EXDATE: o
 * ficheiro real não usa nenhum dos dois, é uma lista plana de um VEVENT
 * por aula por semana (ver comentário em ClassOccurrence no
 * schema.prisma) - se um dia a instituição passar a publicar eventos
 * recorrentes, isto ignora RRULE/EXDATE silenciosamente e trata cada
 * VEVENT pela sua própria data, o que continua a ser o comportamento
 * mais seguro (nunca inventa ocorrências que não vêm explícitas no
 * ficheiro).
 */
export function parseIcsSchedule(icsText: string): ParseIcsScheduleResult {
  const lines = unfoldLines(icsText);
  const events = splitIntoVEvents(lines);

  const rows: ImportScheduleRow[] = [];
  const errors: string[] = [];

  events.forEach((eventLines, index) => {
    try {
      rows.push(parseVEvent(eventLines));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error.';
      errors.push(`Event ${index + 1}: ${message}`);
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

function parseVEvent(lines: string[]): ImportScheduleRow {
  const props = new Map<string, string>();

  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;
    // "SUMMARY;LANGUAGE=pt-pt" -> nome da propriedade é só "SUMMARY", o
    // resto antes do ':' são parâmetros que não precisamos de interpretar
    // aqui (não olhamos para TZID, por exemplo - ver nota no cabeçalho
    // do ficheiro sobre isto assumir sempre UTC/Z).
    const name = line.slice(0, colonIndex).split(';')[0].toUpperCase();
    const value = line.slice(colonIndex + 1);
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

  const start = toLisbonWallClock(dtstartRaw);
  const end = toLisbonWallClock(dtendRaw);

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
    subject: extractSubject(summaryRaw),
    location,
    professor: description ? extractProfessor(description) : undefined,
    externalUid: uid.trim(),
  };
}

// "1-INF | 3º Ano | Computação Móvel | Turma A" -> "Computação Móvel".
// Formato observado no export real: sempre 4 segmentos separados por "|"
// (curso | ano | disciplina | turma) - se vier com um número diferente de
// segmentos (export de outra instituição, ou o formato mudar), cai para o
// SUMMARY inteiro em vez de rebentar o import.
function extractSubject(summary: string): string {
  const parts = unescapeIcsText(summary)
    .split('|')
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length >= 3 ? parts[2] : unescapeIcsText(summary).trim();
}

// DESCRIPTION vem com "\n" escapado (texto ICS, não quebras de linha
// reais) e uma linha "Docente: Nome Completo" no meio - ver exemplo no
// cabeçalho deste ficheiro.
function extractProfessor(description: string): string | undefined {
  const unescaped = unescapeIcsText(description);
  const match = unescaped
    .split('\n')
    .map((line) => line.trim())
    .find((line) => /^docente:/i.test(line));
  return match ? match.replace(/^docente:/i, '').trim() : undefined;
}

// Escaping de texto ICS (RFC 5545 §3.3.11): \\ -> \, \; -> ;, \, -> ,,
// \n ou \N -> quebra de linha real. A ordem importa - \\ tem de ser
// tratado primeiro, senão "\\n" seria lido como "\" + newline em vez de
// ficar como um "\" literal seguido de "n".
function unescapeIcsText(value: string): string {
  return value
    .replace(/\\\\/g, '\u0000') // placeholder temporário para "\\" literal
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\u0000/g, '\\');
}

// "20260914T171500Z" -> dia local (YYYY-MM-DD) e minutos desde a meia-
// noite, em Europe/Lisbon. Assume sempre UTC (sufixo "Z", ou a ausência
// de "Z"/TZID tratada como UTC na mesma) - suficiente para o único
// export que este parser precisa de suportar; não interpreta um TZID
// explícito diferente de Europe/Lisbon caso apareça um dia.
function toLisbonWallClock(value: string): {
  dateKey: string;
  minutes: number;
} {
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/.exec(value);
  if (!match) {
    throw new Error(`Unrecognized date/time format: "${value}".`);
  }

  const [, year, month, day, hour, minute, second] = match;
  const utcDate = new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
    ),
  );

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: SCHEDULE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(utcDate);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '0';
  const dateKey = `${get('year')}-${get('month')}-${get('day')}`;
  const minutes = Number(get('hour')) * 60 + Number(get('minute'));

  return { dateKey, minutes };
}
