import { createHash } from 'crypto';
import { MINUTES_PER_DAY } from '../study-plan/study-plan.constants';
import type {
  DesiredEvent,
  ExistingSyncedEvent,
  ScheduleEventKind,
  SyncDiff,
} from './schedule-sync.types';

// Lógica pura do sync: sem Prisma, sem rede, sem relógio. O
// ScheduleSyncService carrega os dados e executa o diff contra a Google.

export interface SyncClassInput {
  id: string;
  date: string;
  startMinutes: number;
  endMinutes: number;
  subject: string;
  location: string | null;
  professor: string | null;
}

export interface SyncShiftInput {
  shiftId: string;
  date: string;
  startMinutes: number;
  endMinutes: number;
  bufferMinutes: number;
  label: string | null;
}

export interface SyncStudyInput {
  date: string;
  startMinutes: number;
  endMinutes: number;
  taskId: string;
  taskTitle: string;
  isOvertime: boolean;
}

export interface BuildInput {
  classes: SyncClassInput[];
  shifts: SyncShiftInput[];
  study: SyncStudyInput[];
  // Deslocação casa-campus (um sentido). 0/null = sem eventos de viagem
  // para as aulas.
  commuteMinutes: number | null;
}

function hashOf(parts: (string | number | null)[]): string {
  return createHash('sha256').update(JSON.stringify(parts)).digest('hex');
}

function makeEvent(
  fields: Omit<DesiredEvent, 'contentHash'>,
): DesiredEvent | null {
  const start = Math.max(0, fields.startMinutes);
  const end = Math.min(MINUTES_PER_DAY, fields.endMinutes);
  if (end <= start) return null;

  return {
    ...fields,
    startMinutes: start,
    endMinutes: end,
    contentHash: hashOf([
      fields.kind,
      fields.title,
      fields.date,
      start,
      end,
      fields.description,
      fields.location,
    ]),
  };
}

function pushIfValid(target: DesiredEvent[], event: DesiredEvent | null): void {
  if (event) target.push(event);
}

// Uma viagem antes e outra depois de um bloco. Partilhado por aulas (1º e
// último do dia) e turnos (cada um, com o seu buffer).
function travelAround(
  keyPrefix: string,
  date: string,
  blockStart: number,
  blockEnd: number,
  minutes: number,
  labels: { to: string; from: string },
): DesiredEvent[] {
  if (minutes <= 0) return [];
  const events: DesiredEvent[] = [];
  const base = {
    kind: 'travel' as ScheduleEventKind,
    date,
    description: null,
    location: null,
  };
  pushIfValid(
    events,
    makeEvent({
      ...base,
      sourceKey: `${keyPrefix}-to`,
      title: labels.to,
      startMinutes: blockStart - minutes,
      endMinutes: blockStart,
    }),
  );
  pushIfValid(
    events,
    makeEvent({
      ...base,
      sourceKey: `${keyPrefix}-from`,
      title: labels.from,
      startMinutes: blockEnd,
      endMinutes: blockEnd + minutes,
    }),
  );
  return events;
}

export function buildDesiredEvents(input: BuildInput): DesiredEvent[] {
  const events: DesiredEvent[] = [];

  for (const c of input.classes) {
    pushIfValid(
      events,
      makeEvent({
        sourceKey: `class:${c.id}`,
        kind: 'class',
        date: c.date,
        startMinutes: c.startMinutes,
        endMinutes: c.endMinutes,
        title: c.subject,
        description: c.professor ? `Professor: ${c.professor}` : null,
        location: c.location,
      }),
    );
  }

  // Viagem das aulas: só antes da primeira e depois da última de cada dia.
  const classesByDate = new Map<string, SyncClassInput[]>();
  for (const c of input.classes) {
    const list = classesByDate.get(c.date) ?? [];
    list.push(c);
    classesByDate.set(c.date, list);
  }
  if (input.commuteMinutes && input.commuteMinutes > 0) {
    for (const [date, list] of classesByDate) {
      const first = Math.min(...list.map((c) => c.startMinutes));
      const last = Math.max(...list.map((c) => c.endMinutes));
      events.push(
        ...travelAround(
          `travel:class:${date}`,
          date,
          first,
          last,
          input.commuteMinutes,
          {
            to: 'Travel to campus',
            from: 'Travel home',
          },
        ),
      );
    }
  }

  for (const s of input.shifts) {
    pushIfValid(
      events,
      makeEvent({
        sourceKey: `shift:${s.shiftId}:${s.date}`,
        kind: 'work',
        date: s.date,
        startMinutes: s.startMinutes,
        endMinutes: s.endMinutes,
        title: s.label ?? 'Work',
        description: null,
        location: null,
      }),
    );
    events.push(
      ...travelAround(
        `travel:shift:${s.shiftId}:${s.date}`,
        s.date,
        s.startMinutes,
        s.endMinutes,
        s.bufferMinutes,
        { to: `Travel to ${s.label ?? 'work'}`, from: 'Travel home' },
      ),
    );
  }

  for (const b of input.study) {
    pushIfValid(
      events,
      makeEvent({
        sourceKey: `study:${b.date}:${b.taskId}:${b.startMinutes}`,
        kind: b.isOvertime ? 'study_overtime' : 'study',
        date: b.date,
        startMinutes: b.startMinutes,
        endMinutes: b.endMinutes,
        title: `Study: ${b.taskTitle}`,
        description: b.isOvertime
          ? 'Overtime block: this study time goes past your daily limit.'
          : 'Suggested by your study plan.',
        location: null,
      }),
    );
  }

  return events;
}

export interface DiffContext {
  todayKey: string;
  nowMinutes: number;
}

/**
 * Compara o que devia existir com o que já enviámos. Um evento que já não
 * é desejado só é apagado se ainda não aconteceu: o plano de estudo só
 * gera blocos futuros, por isso o bloco de ESTA manhã "desaparece" do plano
 * à tarde e apagá-lo do calendário seria reescrever o passado.
 */
export function diffEvents(
  desired: DesiredEvent[],
  existing: ExistingSyncedEvent[],
  ctx: DiffContext,
): SyncDiff {
  const existingByKey = new Map(existing.map((e) => [e.sourceKey, e]));
  const desiredKeys = new Set(desired.map((d) => d.sourceKey));

  const toCreate: DesiredEvent[] = [];
  const toUpdate: SyncDiff['toUpdate'] = [];
  let unchangedCount = 0;

  for (const d of desired) {
    const match = existingByKey.get(d.sourceKey);
    if (!match) toCreate.push(d);
    else if (match.contentHash !== d.contentHash)
      toUpdate.push({ desired: d, existing: match });
    else unchangedCount += 1;
  }

  const toDelete = existing.filter((e) => {
    if (desiredKeys.has(e.sourceKey)) return false;
    const alreadyHappened =
      e.date < ctx.todayKey ||
      (e.date === ctx.todayKey && e.endMinutes <= ctx.nowMinutes);
    return !alreadyHappened;
  });

  return { toCreate, toUpdate, toDelete, unchangedCount };
}
