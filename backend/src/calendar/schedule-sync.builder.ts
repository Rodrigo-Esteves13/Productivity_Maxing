import { createHash } from 'crypto';
import { MINUTES_PER_DAY } from '../study-plan/study-plan.constants';
import { COLOR_ID_BY_KIND } from './schedule-sync.constants';
import type {
  DesiredEvent,
  ExistingSyncedEvent,
  SyncDiff,
} from './schedule-sync.types';
import type { ItineraryLeg } from '../schedule/itinerary.builder';

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
  // Sem local e nao recorrente = evento pontual (medico, entrevista...).
  commitmentId: string | null;
  isRecurring: boolean;
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

// Uma viagem do itinerario do dia (ItineraryService), ja decidida: casa ->
// sitio, sitio -> casa ou direta entre dois sitios.
export interface SyncTravelInput {
  date: string;
  leg: ItineraryLeg;
}

export interface BuildInput {
  classes: SyncClassInput[];
  shifts: SyncShiftInput[];
  study: SyncStudyInput[];
  travel: SyncTravelInput[];
}

const LATE_TRAVEL_DESCRIPTION =
  'This trip does not fit before the next start: you may arrive late.';

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
      // A cor entra no hash: mudar a cor de um tipo atualiza os eventos ja
      // criados no Google Calendar no proximo sync.
      COLOR_ID_BY_KIND[fields.kind],
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

function travelTitle(leg: ItineraryLeg): string {
  return leg.kind === 'to_home' ? 'Travel home' : `Travel to ${leg.toLabel}`;
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

  for (const s of input.shifts) {
    const isOneTimeEvent = s.commitmentId === null && !s.isRecurring;
    pushIfValid(
      events,
      makeEvent({
        sourceKey: `shift:${s.shiftId}:${s.date}`,
        kind: isOneTimeEvent ? 'event' : 'work',
        date: s.date,
        startMinutes: s.startMinutes,
        endMinutes: s.endMinutes,
        title: s.label ?? (isOneTimeEvent ? 'Event' : 'Work'),
        description: null,
        location: null,
      }),
    );
  }

  // Viagens: decididas pelo itinerario (vai a casa entre duas coisas so se
  // houver tempo; senao vai direto).
  for (const { date, leg } of input.travel) {
    pushIfValid(
      events,
      makeEvent({
        sourceKey: `travel:${date}:${leg.key}`,
        kind: 'travel',
        date,
        startMinutes: leg.start,
        endMinutes: leg.end,
        title: travelTitle(leg),
        description: leg.late ? LATE_TRAVEL_DESCRIPTION : null,
        location: null,
      }),
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
