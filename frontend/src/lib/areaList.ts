import type { Area, RiskLevel } from '../types/models';
import type { AreaOverviewItem } from './areaOverview';
import { foldText } from './textSearch';
import { taskDayKey, todayKey } from './dateKey';
import { MS_PER_DAY } from './timeConstants';

// Pesquisa, filtro e ordenacao da pagina Areas. Funcoes puras: o resumo por
// cadeira (useAreaOverview) e opcional, por isso tudo funciona sem ele.

export const AREA_FILTERS = ['all', 'on', 'off'] as const;
export type AreaFilter = (typeof AREA_FILTERS)[number];

export const AREA_SORTS = ['manual', 'name', 'risk', 'tasks'] as const;
export type AreaSort = (typeof AREA_SORTS)[number];

export const DEFAULT_AREA_FILTER: AreaFilter = 'all';
export const DEFAULT_AREA_SORT: AreaSort = 'manual';

export type AreaOverviewLookup = ReadonlyMap<string, AreaOverviewItem>;

export function isAreaFilter(value: unknown): value is AreaFilter {
  return typeof value === 'string' && (AREA_FILTERS as readonly string[]).includes(value);
}

export function isAreaSort(value: unknown): value is AreaSort {
  return typeof value === 'string' && (AREA_SORTS as readonly string[]).includes(value);
}

// Ordem de gravidade (sem veredicto fica abaixo de "low").
const RISK_RANK: Record<RiskLevel, number> = { low: 1, medium: 2, high: 3, extreme: 4 };
const NO_RISK_RANK = 0;

const AT_RISK_LEVELS: ReadonlySet<RiskLevel> = new Set<RiskLevel>(['high', 'extreme']);

export function isAtRisk(level: RiskLevel | null | undefined): boolean {
  return !!level && AT_RISK_LEVELS.has(level);
}

/** Desligada = oficial que o utilizador escondeu. As pessoais estao sempre ligadas. */
export function isAreaOn(area: Pick<Area, 'isHidden'>): boolean {
  return !area.isHidden;
}

export interface AreaListQuery {
  search: string;
  filter: AreaFilter;
}

export function hasActiveListQuery({ search, filter }: AreaListQuery): boolean {
  return search.trim() !== '' || filter !== DEFAULT_AREA_FILTER;
}

/** Nome ou docente, sem diferenca de maiusculas e acentos. */
export function filterAreas<T extends Area>(areas: readonly T[], query: AreaListQuery, overview?: AreaOverviewLookup): T[] {
  const folded = foldText(query.search.trim());
  return areas.filter((area) => {
    if (query.filter === 'on' && !isAreaOn(area)) return false;
    if (query.filter === 'off' && isAreaOn(area)) return false;
    if (!folded) return true;
    if (foldText(area.name).includes(folded)) return true;
    const teacher = overview?.get(area.id)?.teacherName;
    return !!teacher && foldText(teacher).includes(folded);
  });
}

/**
 * `areas` ja vem pela ordem manual (useAreaOrder); 'manual' devolve-a igual.
 * Empates nos outros modos ficam pela ordem manual (sort estavel).
 */
export function sortAreaList<T extends Area>(
  areas: readonly T[],
  sort: AreaSort,
  overview: AreaOverviewLookup | undefined,
  locale: string,
): T[] {
  if (sort === 'manual') return [...areas];
  const collator = new Intl.Collator(locale, { sensitivity: 'base', numeric: true });
  const byName = (a: T, b: T) => collator.compare(a.name, b.name);
  if (sort === 'name') return [...areas].sort(byName);
  const item = (area: T) => overview?.get(area.id);
  if (sort === 'risk') {
    return [...areas].sort((a, b) => {
      const ia = item(a);
      const ib = item(b);
      const rank = rankOf(ib?.riskLevel) - rankOf(ia?.riskLevel);
      if (rank !== 0) return rank;
      return (ib?.riskScore ?? -1) - (ia?.riskScore ?? -1);
    });
  }
  return [...areas].sort((a, b) => {
    const ia = item(a);
    const ib = item(b);
    const open = (ib?.openTasks ?? 0) - (ia?.openTasks ?? 0);
    if (open !== 0) return open;
    return (ib?.overdueTasks ?? 0) - (ia?.overdueTasks ?? 0);
  });
}

function rankOf(level: RiskLevel | null | undefined): number {
  return level ? RISK_RANK[level] : NO_RISK_RANK;
}

export interface AreaSummary {
  total: number;
  active: number;
  off: number;
  // null = sem dados de tarefas/risco (a carregar ou falhou).
  openTasks: number | null;
  atRisk: number | null;
}

export function summarizeAreas(areas: readonly Area[], overview: AreaOverviewLookup | undefined): AreaSummary {
  const active = areas.filter(isAreaOn).length;
  let openTasks = 0;
  let atRisk = 0;
  let assessed = 0;
  for (const area of areas) {
    const item = overview?.get(area.id);
    if (!item) continue;
    openTasks += item.openTasks;
    if (item.riskLevel) assessed += 1;
    if (isAtRisk(item.riskLevel)) atRisk += 1;
  }
  const hasOverview = !!overview && overview.size > 0;
  return {
    total: areas.length,
    active,
    off: areas.length - active,
    openTasks: hasOverview ? openTasks : null,
    atRisk: assessed > 0 ? atRisk : null,
  };
}

/** Dias de calendario ate ao prazo (0 = hoje), com a mesma regra de dia das tasks. */
export function daysUntil(iso: string, now: Date = new Date()): number {
  const toUtc = (key: string) => {
    const [year, month, day] = key.split('-').map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((toUtc(taskDayKey(new Date(iso))) - toUtc(todayKey(now))) / MS_PER_DAY);
}

/** "amanha", "daqui a 3 dias" na lingua da app. */
export function formatDaysUntil(days: number, locale: string): string {
  return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(days, 'day');
}
