import { DateCertainty, Prisma, ProgressStatus } from '@prisma/client';

// Datas que sao mesmo um prazo. UNKNOWN (ainda nao marcada) e SURPRISE (pode
// calhar em qualquer dia) guardam so um palpite em `date`, por isso nunca
// ficam em atraso, nunca aparecem em "Hoje" e adiar o palpite nao conta como
// procrastinar.
export const FIRM_DATE_CERTAINTIES: readonly DateCertainty[] = [
  DateCertainty.EXACT,
  DateCertainty.APPROXIMATE,
];

export function hasFirmDate(certainty: DateCertainty): boolean {
  return FIRM_DATE_CERTAINTIES.includes(certainty);
}

// Marca no titulo de eventos de calendario (Google, feed .ics): uma data
// por marcar/surpresa e so um palpite e nao pode parecer um prazo real.
const CALENDAR_TITLE_PREFIX: Record<DateCertainty, string> = {
  EXACT: '',
  APPROXIMATE: '~ ',
  UNKNOWN: '(TBD) ',
  SURPRISE: '(?) ',
};

export function calendarTitle(
  title: string,
  certainty: DateCertainty | null | undefined,
): string {
  return `${CALENDAR_TITLE_PREFIX[certainty ?? DateCertainty.EXACT]}${title}`;
}

// So prazos reais (independente de bloqueio): lembretes "falta 1 dia".
export const FIRM_DATE_WHERE = {
  dateCertainty: { in: [...FIRM_DATE_CERTAINTIES] },
} satisfies Prisma.TaskWhereInput;

// Filtro para "esta task tem um prazo real e da para a fazer": usado pelos
// atrasos, pelo "Hoje" e (por esses endpoints) pelas regras do agente. Uma
// task bloqueada nao pode estar em atraso porque nem sequer da para comecar.
export const ACTIONABLE_DEADLINE_WHERE = {
  isBlocked: false,
  dateCertainty: { in: [...FIRM_DATE_CERTAINTIES] },
} satisfies Prisma.TaskWhereInput;

// Ainda nao da para comecar: bloqueada ou so abre numa data futura.
export function isTaskLocked(
  task: { isBlocked: boolean; availableFrom: Date | null },
  now: Date = new Date(),
): boolean {
  return task.isBlocked || (!!task.availableFrom && task.availableFrom > now);
}

// Estado mostrado ao user: uma task trancada (e nao concluida) e NOT_STARTED.
export function effectiveProgressStatus(
  task: {
    progressStatus: ProgressStatus;
    isBlocked: boolean;
    availableFrom: Date | null;
  },
  now: Date = new Date(),
): ProgressStatus {
  return task.progressStatus !== ProgressStatus.COMPLETED &&
    isTaskLocked(task, now)
    ? ProgressStatus.NOT_STARTED
    : task.progressStatus;
}
