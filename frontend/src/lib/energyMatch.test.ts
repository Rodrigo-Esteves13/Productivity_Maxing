import { describe, expect, it } from 'vitest';
import type { Task } from '../types/models';
import { energyBand, pickForEnergy } from './energyMatch';

const NOW = new Date('2026-06-15T12:00:00Z');

function makeTask(id: string, date: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    title: id,
    date,
    progressStatus: 'NOT_STARTED',
    dateCertainty: 'EXACT',
    isBlocked: false,
    availableFrom: null,
    priorityOrder: null,
    weightPercentage: null,
    effort: null,
    ...overrides,
  } as Task;
}

const heavySoon = makeTask('heavy', '2026-06-17T00:00:00.000Z', { effort: 'HEAVY' });
const lightLater = makeTask('light', '2026-06-20T00:00:00.000Z', { effort: 'LIGHT' });

describe('energyBand', () => {
  it('maps 1-5 to bands and missing to mid', () => {
    expect([1, 2, 3, 4, 5].map(energyBand)).toEqual(['low', 'low', 'mid', 'high', 'high']);
    expect(energyBand(null)).toBe('mid');
  });
});

describe('pickForEnergy', () => {
  it('prefers a light task on low energy', () => {
    expect(pickForEnergy([heavySoon, lightLater], 2, NOW)).toEqual({ task: lightLater, byEnergy: true });
  });
  it('keeps urgency order on mid energy or without a check-in', () => {
    expect(pickForEnergy([heavySoon, lightLater], 3, NOW)).toEqual({ task: heavySoon, byEnergy: false });
    expect(pickForEnergy([heavySoon, lightLater], null, NOW).task).toBe(heavySoon);
  });
  it('prefers a heavy task on high energy', () => {
    const lightSoon = makeTask('ls', '2026-06-16T00:00:00.000Z', { effort: 'LIGHT' });
    expect(pickForEnergy([lightSoon, heavySoon], 5, NOW)).toEqual({ task: heavySoon, byEnergy: true });
  });
  it('never skips an overdue task', () => {
    const overdueHeavy = makeTask('late', '2026-06-10T00:00:00.000Z', { effort: 'HEAVY' });
    expect(pickForEnergy([overdueHeavy, lightLater], 1, NOW)).toEqual({ task: overdueHeavy, byEnergy: false });
  });
  it('falls back to the urgent task when nothing fits', () => {
    expect(pickForEnergy([heavySoon], 1, NOW)).toEqual({ task: heavySoon, byEnergy: false });
  });
});
