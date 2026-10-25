import type { ClassOccurrence, Task, WorkShiftOccurrence } from '../types/models';
import { mergeAgenda, type AgendaItem } from './agenda';
import { AGENDA_TONE_CLASSES, AGENDA_TONE_LABEL_KEY, getAgendaTone, type AgendaTone } from './agendaTone';
import { formatClock } from './timeFormat';
import { hasFirmDate } from './taskReadiness';
import { matchesAreaName } from './subjectMatch';

// Vista mensal do horario: cada dia vira uma lista de "chips". Prazos de
// tasks vem primeiro (testes e exames a cabeca, e o que interessa ver na
// epoca de exames), depois aulas e turnos por hora, como na grelha semanal.
export type MonthChipTone = 'exam' | 'deadline' | AgendaTone;

export interface MonthChip {
  id: string;
  tone: MonthChipTone;
  // Titulo da task, disciplina da aula ou nome do turno. null = o texto
  // por omissao do tom (ver MONTH_CHIP_FALLBACK_KEY).
  label: string | null;
  // "09:00-10:30" em aulas e turnos, null em prazos.
  time: string | null;
  done: boolean;
  taskId: string | null;
}

// Chip de um prazo: tem sempre a task de onde veio (para a abrir) e a
// cadeira, para o juntar a aula dessa cadeira no mesmo dia.
export type DeadlineChip = MonthChip & { taskId: string; areaName: string | null };

// Ordem da legenda e dos pontos no telemovel.
export const MONTH_CHIP_TONES: MonthChipTone[] = ['exam', 'deadline', 'class', 'work', 'event'];

const agendaToneChip = (tone: AgendaTone) => ({
  chip: `${AGENDA_TONE_CLASSES[tone].card} ${AGENDA_TONE_CLASSES[tone].title}`,
  dot: AGENDA_TONE_CLASSES[tone].dot,
});

export const MONTH_CHIP_TONE_CLASSES: Record<MonthChipTone, { chip: string; dot: string }> = {
  exam: {
    chip: 'bg-violet-600 border border-violet-500 text-white font-semibold',
    dot: 'bg-violet-600 ring-1 ring-violet-300',
  },
  deadline: {
    chip: 'bg-violet-950/40 border border-violet-800/50 text-violet-200',
    dot: 'bg-violet-400',
  },
  class: agendaToneChip('class'),
  work: agendaToneChip('work'),
  event: agendaToneChip('event'),
};

export const MONTH_CHIP_LABEL_KEY: Record<MonthChipTone, string> = {
  exam: 'schedule.month.legend.exam',
  deadline: 'schedule.month.legend.deadline',
  ...AGENDA_TONE_LABEL_KEY,
};

export const MONTH_CHIP_FALLBACK_KEY: Partial<Record<MonthChipTone, string>> = {
  work: 'schedule.fallback.work',
  event: 'schedule.fallback.event',
};

const COMPLETED_STATUS: Task['progressStatus'] = 'COMPLETED';

function pushTo<T>(map: Map<string, T[]>, key: string, value: T) {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

function taskChip(task: Task): DeadlineChip {
  return {
    id: `task-${task.id}`,
    tone: task.academicTypeIsEvent ? 'exam' : 'deadline',
    label: task.title,
    time: null,
    done: task.progressStatus === COMPLETED_STATUS,
    taskId: task.id,
    areaName: task.area?.name ?? null,
  };
}

// Exames primeiro, depois o que ainda esta por fazer. sort() e estavel, por
// isso o resto fica na ordem do backend (sortOrder, data).
const deadlineRank = (chip: MonthChip) => (chip.tone === 'exam' ? 0 : 2) + (chip.done ? 1 : 0);

/**
 * Prazos por dia ("YYYY-MM-DD"), ja ordenados. Tambem usado pela grelha
 * semanal, que mostra aulas e turnos com mais detalhe mas os prazos iguais.
 */
export function buildDeadlineChips(tasks: Task[]): Map<string, DeadlineChip[]> {
  const result = new Map<string, DeadlineChip[]>();
  // Palpites (data por marcar/surpresa) nao ocupam um dia no calendario.
  for (const task of tasks) {
    if (hasFirmDate(task)) pushTo(result, task.date.slice(0, 10), taskChip(task));
  }
  for (const chips of result.values()) chips.sort((a, b) => deadlineRank(a) - deadlineRank(b));
  return result;
}

export interface PinnedDeadlines {
  // Prazos que ficam dentro do bloco de uma aula, por id da aula.
  byClassId: Map<string, DeadlineChip[]>;
  // O resto (sem cadeira ou sem aula dessa cadeira no dia), soltos no topo.
  loose: DeadlineChip[];
}

/**
 * Um teste ou apresentacao no dia de uma aula da mesma cadeira e quase
 * sempre feito nessa aula: em vez de dois cartoes separados, o prazo vai
 * para dentro do bloco da aula. Com varias aulas da cadeira no dia fica na
 * primeira (items ja vem por hora, ver mergeAgenda).
 */
export function pinDeadlinesToClasses(deadlines: DeadlineChip[], items: AgendaItem[]): PinnedDeadlines {
  const byClassId = new Map<string, DeadlineChip[]>();
  const loose: DeadlineChip[] = [];
  for (const chip of deadlines) {
    const areaName = chip.areaName;
    const host = areaName
      ? items.find((item) => item.kind === 'class' && matchesAreaName(item.occurrence.subject, areaName))
      : undefined;
    if (host) pushTo(byClassId, host.id, chip);
    else loose.push(chip);
  }
  return { byClassId, loose };
}

/** Chips por dia ("YYYY-MM-DD"). Dias sem nada nao aparecem no mapa. */
export function buildMonthAgenda(
  tasks: Task[],
  classes: ClassOccurrence[],
  shifts: WorkShiftOccurrence[],
): Map<string, MonthChip[]> {
  const deadlinesByDay = buildDeadlineChips(tasks);
  const classesByDay = new Map<string, ClassOccurrence[]>();
  for (const occ of classes) pushTo(classesByDay, occ.date.slice(0, 10), occ);
  const shiftsByDay = new Map<string, WorkShiftOccurrence[]>();
  for (const shift of shifts) pushTo(shiftsByDay, shift.date, shift);

  const keys = new Set([...deadlinesByDay.keys(), ...classesByDay.keys(), ...shiftsByDay.keys()]);
  const result = new Map<string, MonthChip[]>();
  for (const key of keys) {
    const deadlines = deadlinesByDay.get(key) ?? [];
    const agenda = mergeAgenda(classesByDay.get(key) ?? [], shiftsByDay.get(key) ?? []).map(
      (item): MonthChip => ({
        id: `${item.kind}-${item.id}`,
        tone: getAgendaTone(item),
        label: item.kind === 'class' ? item.occurrence.subject : item.occurrence.label,
        time: `${formatClock(item.startMinutes)}-${formatClock(item.endMinutes)}`,
        done: false,
        taskId: null,
      }),
    );
    result.set(key, [...deadlines, ...agenda]);
  }
  return result;
}

/** Tons presentes num dia, pela ordem da legenda (um ponto por tom no telemovel). */
export function chipTones(chips: MonthChip[]): MonthChipTone[] {
  const present = new Set(chips.map((chip) => chip.tone));
  return MONTH_CHIP_TONES.filter((tone) => present.has(tone));
}
