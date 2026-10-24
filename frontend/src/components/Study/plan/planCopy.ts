import type { CapacityStatus } from '../../../types/models';
import { formatDuration } from '../../../lib/timeFormat';
import { translateNow } from '../../../i18n/translate';

interface BannerContext {
  neededMinutes: number;
  overtimeMinutes: number;
  shortfallMinutes: number;
  dailyLimitMinutes: number;
}

interface BannerCopy {
  title: string;
  body: (ctx: BannerContext) => string;
  // Tokens de cor existentes (neutral/amber/red/violet), nunca hex novos.
  containerClass: string;
  titleClass: string;
}

// Tabela em vez de if/switch: cada estado da capacidade tem o seu texto
// e cor, e acrescentar um novo estado é acrescentar uma entrada.
export const BANNER_BY_STATUS: Record<CapacityStatus, BannerCopy> = {
  no_work: {
    get title() { return translateNow('plan.noWorkTitle'); },
    body: () => translateNow('plan.noWorkBody'),
    containerClass: 'border-neutral-800 bg-neutral-900/50',
    titleClass: 'text-neutral-200',
  },
  on_track: {
    get title() { return translateNow('plan.onTrackTitle'); },
    body: (c) =>
      translateNow('plan.onTrackBody', { needed: formatDuration(c.neededMinutes), limit: formatDuration(c.dailyLimitMinutes) }),
    containerClass: 'border-violet-900/50 bg-violet-950/20',
    titleClass: 'text-violet-300',
  },
  overtime: {
    get title() { return translateNow('plan.overtimeTitle'); },
    body: (c) =>
      translateNow('plan.overtimeBody', { overtime: formatDuration(c.overtimeMinutes), limit: formatDuration(c.dailyLimitMinutes) }),
    containerClass: 'border-amber-900/50 bg-amber-950/20',
    titleClass: 'text-amber-300',
  },
  short: {
    get title() { return translateNow('plan.shortTitle'); },
    body: (c) => translateNow('plan.shortBody', { shortfall: formatDuration(c.shortfallMinutes) }),
    containerClass: 'border-red-900/50 bg-red-950/20',
    titleClass: 'text-red-300',
  },
};

export const ESTIMATE_SOURCE_LABEL = {
  get manual() { return translateNow('plan.sourceManual'); },
  get manual_calibrated() { return translateNow('plan.sourceManualCalibrated'); },
  get predicted() { return translateNow('plan.sourcePredicted'); },
  get course_history() { return translateNow('plan.sourceCourseHistory'); },
  get default() { return translateNow('plan.sourceDefault'); },
};
