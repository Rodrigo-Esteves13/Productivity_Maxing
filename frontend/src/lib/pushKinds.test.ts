import { describe, expect, it } from 'vitest';
import { toggleMutedKind } from './pushKinds';

describe('toggleMutedKind', () => {
  it('mutes a kind when it is turned off', () => {
    expect(toggleMutedKind([], 'streakRisk', false)).toEqual(['streakRisk']);
  });
  it('never duplicates and unmutes when turned on', () => {
    expect(toggleMutedKind(['streakRisk'], 'streakRisk', false)).toEqual(['streakRisk']);
    expect(toggleMutedKind(['streakRisk', 'moneyReminder'], 'streakRisk', true)).toEqual(['moneyReminder']);
  });
});
