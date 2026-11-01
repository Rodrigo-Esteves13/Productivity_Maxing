import { describe, expect, it } from 'vitest';
import type { Area } from '../types/models';
import type { AreaOverviewItem } from './areaOverview';
import {
  daysUntil,
  filterAreas,
  hasActiveListQuery,
  isAreaFilter,
  isAreaSort,
  sortAreaList,
  summarizeAreas,
} from './areaList';

function area(id: string, name: string, extra: Partial<Area> = {}): Area {
  return {
    id,
    userId: 'u1',
    name,
    colorHex: '#7c3aed',
    defaultTaskType: null,
    credits: null,
    isOfficial: false,
    isMine: true,
    proposalStatus: 'NONE',
    ...extra,
  } as Area;
}

function item(areaId: string, extra: Partial<AreaOverviewItem> = {}): AreaOverviewItem {
  return {
    areaId,
    openTasks: 0,
    overdueTasks: 0,
    nextDeadline: null,
    riskLevel: null,
    riskScore: null,
    currentAverage: null,
    teacherName: null,
    ...extra,
  };
}

const maths = area('a', 'Matemática');
const physics = area('b', 'Física', { isOfficial: true, isMine: false, isHidden: true });
const art = area('c', 'Art', { isOfficial: true, isMine: false, isHidden: false });
const all = [maths, physics, art];

describe('filterAreas', () => {
  it('ignores case and accents', () => {
    expect(filterAreas(all, { search: 'MATEMATICA', filter: 'all' }).map((a) => a.id)).toEqual(['a']);
  });

  it('matches the teacher name from the overview', () => {
    const overview = new Map([['c', item('c', { teacherName: 'Joana Sá' })]]);
    expect(filterAreas(all, { search: 'joana sa', filter: 'all' }, overview).map((a) => a.id)).toEqual(['c']);
  });

  it('filters by on and off', () => {
    expect(filterAreas(all, { search: '', filter: 'on' }).map((a) => a.id)).toEqual(['a', 'c']);
    expect(filterAreas(all, { search: '', filter: 'off' }).map((a) => a.id)).toEqual(['b']);
  });
});

describe('sortAreaList', () => {
  it('keeps the manual order', () => {
    expect(sortAreaList(all, 'manual', undefined, 'en').map((a) => a.id)).toEqual(['a', 'b', 'c']);
  });

  it('sorts by name with the locale', () => {
    expect(sortAreaList(all, 'name', undefined, 'pt').map((a) => a.name)).toEqual(['Art', 'Física', 'Matemática']);
  });

  it('puts the worst risk first and areas without a verdict last', () => {
    const overview = new Map([
      ['a', item('a', { riskLevel: 'medium', riskScore: 40 })],
      ['b', item('b', { riskLevel: 'extreme', riskScore: 90 })],
    ]);
    expect(sortAreaList(all, 'risk', overview, 'en').map((a) => a.id)).toEqual(['b', 'a', 'c']);
  });

  it('sorts by open tasks, then overdue', () => {
    const overview = new Map([
      ['a', item('a', { openTasks: 2, overdueTasks: 0 })],
      ['b', item('b', { openTasks: 2, overdueTasks: 1 })],
      ['c', item('c', { openTasks: 5 })],
    ]);
    expect(sortAreaList(all, 'tasks', overview, 'en').map((a) => a.id)).toEqual(['c', 'b', 'a']);
  });
});

describe('summarizeAreas', () => {
  it('counts active, off, open tasks and courses at risk', () => {
    const overview = new Map([
      ['a', item('a', { openTasks: 3, riskLevel: 'high' })],
      ['c', item('c', { openTasks: 1, riskLevel: 'low' })],
    ]);
    expect(summarizeAreas(all, overview)).toEqual({ total: 3, active: 2, off: 1, openTasks: 4, atRisk: 1 });
  });

  it('returns null for data it does not have', () => {
    expect(summarizeAreas(all, new Map())).toMatchObject({ openTasks: null, atRisk: null });
  });
});

describe('helpers', () => {
  it('validates stored prefs', () => {
    expect(isAreaFilter('off')).toBe(true);
    expect(isAreaFilter('hidden')).toBe(false);
    expect(isAreaSort('risk')).toBe(true);
    expect(isAreaSort(3)).toBe(false);
  });

  it('knows when a query narrows the list', () => {
    expect(hasActiveListQuery({ search: '  ', filter: 'all' })).toBe(false);
    expect(hasActiveListQuery({ search: 'x', filter: 'all' })).toBe(true);
    expect(hasActiveListQuery({ search: '', filter: 'on' })).toBe(true);
  });

  it('counts calendar days to a date-only deadline', () => {
    const now = new Date(2026, 10, 1, 23, 30);
    expect(daysUntil('2026-11-01T00:00:00.000Z', now)).toBe(0);
    expect(daysUntil('2026-11-04T00:00:00.000Z', now)).toBe(3);
  });
});
