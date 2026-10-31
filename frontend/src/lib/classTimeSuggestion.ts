import type { ClassOccurrence } from '../types/models';
import { formatClock } from './timeFormat';

// Sugestao "Teste com hora da aula": num teste/exame (tipo academico de
// evento) cuja data tem uma aula da mesma cadeira, propoe a hora e a duracao
// dessa aula. Nunca aplica sozinha e nunca sobrepoe uma hora ja escolhida.

// Mesmo minimo do input de duracao (create-task.dto.ts).
const MIN_DURATION_MINUTES = 5;
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

export interface ClassTimeSuggestion {
  occurrenceId: string;
  /** "HH:MM" para o campo de hora da task. */
  time: string;
  durationMinutes: number;
  /** "HH:MM-HH:MM" para mostrar. */
  rangeLabel: string;
}

export interface ClassTimeSuggestionInput {
  /** O tipo academico escolhido e um evento (teste/exame). */
  isEventType: boolean;
  /** "YYYY-MM-DD" escolhido no formulario. */
  date: string;
  /** Hora ja definida no formulario ("HH:MM"), '' = sem hora. */
  calendarTime: string;
  /** Os campos de hora/duracao estao visiveis no formulario (isCalendarTimeFieldVisible). */
  timeFieldVisible: boolean;
  areaName: string | undefined;
  classes: ClassOccurrence[];
}

// O dia de uma aula e a parte da data do ISO (guardada a meia-noite UTC), igual
// ao resto do horario: nunca se converte para o fuso local, que deslocava o dia
// a oeste de Greenwich.
function occurrenceDayKey(occurrence: ClassOccurrence): string {
  return occurrence.date.slice(0, 10);
}

function normalizeSubject(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Um nome contem o outro palavra a palavra (sequencia contigua): "Redes III - TP"
// contem "Redes III", mas "Redes III" nao contem "Redes I". O matchesAreaName
// partilhado compara substrings ("redes iii" inclui "redes i") e, num dia so com
// aula de Redes III, sugeria essa hora para um teste de Redes I.
function containsWords(haystack: string[], needle: string[]): boolean {
  if (needle.length === 0 || needle.length > haystack.length) return false;
  for (let start = 0; start + needle.length <= haystack.length; start += 1) {
    if (needle.every((word, i) => haystack[start + i] === word)) return true;
  }
  return false;
}

function matchesByWords(subject: string, areaName: string): boolean {
  const a = normalizeSubject(subject).split(' ').filter(Boolean);
  const b = normalizeSubject(areaName).split(' ').filter(Boolean);
  return containsWords(a, b) || containsWords(b, a);
}

export function classTimeSuggestion(input: ClassTimeSuggestionInput): ClassTimeSuggestion | null {
  const { isEventType, date, calendarTime, timeFieldVisible, areaName, classes } = input;
  // Sem campos visiveis o clique nao teria efeito visivel e gravaria uma hora escondida.
  if (!isEventType || !timeFieldVisible || calendarTime || !areaName || !DAY_KEY.test(date)) return null;

  const dayClasses = classes.filter(
    (c) =>
      !c.cancelled && occurrenceDayKey(c) === date && c.endMinutes - c.startMinutes >= MIN_DURATION_MINUTES,
  );
  // Nome exato primeiro: "Redes I" nao pode apanhar aulas de "Redes III".
  const wanted = normalizeSubject(areaName);
  let matched = dayClasses.filter((c) => normalizeSubject(c.subject) === wanted);
  if (matched.length === 0) {
    const partial = dayClasses.filter((c) => matchesByWords(c.subject, areaName));
    // Parcial so serve se for inequivoco: duas cadeiras diferentes => sem sugestao.
    if (new Set(partial.map((c) => normalizeSubject(c.subject))).size > 1) return null;
    matched = partial;
  }
  // Com varias aulas no dia, a primeira (e a que costuma ser o teste).
  const candidates = [...matched].sort((a, b) => a.startMinutes - b.startMinutes);

  const first = candidates[0];
  if (!first) return null;

  const durationMinutes = first.endMinutes - first.startMinutes;
  const time = formatClock(first.startMinutes);
  return {
    occurrenceId: first.id,
    time,
    durationMinutes,
    rangeLabel: `${time}-${formatClock(first.endMinutes)}`,
  };
}
