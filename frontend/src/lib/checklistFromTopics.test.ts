import { describe, expect, it } from 'vitest';
import { MAX_TOPIC_STEPS, mergeStepsIntoChecklist, topicsToSteps } from './checklistFromTopics';

describe('topicsToSteps', () => {
  it('splits on commas, semicolons and lines, trimming and deduping', () => {
    expect(topicsToSteps('Limits, Derivatives;\nIntegrals,  limits ,')).toEqual(['Limits', 'Derivatives', 'Integrals']);
  });
  it('caps the number of steps', () => {
    const many = Array.from({ length: 30 }, (_, i) => `t${i}`).join(',');
    expect(topicsToSteps(many)).toHaveLength(MAX_TOPIC_STEPS);
  });
  it('returns nothing for blank input', () => {
    expect(topicsToSteps('  , ;')).toEqual([]);
  });
});

describe('mergeStepsIntoChecklist', () => {
  it('appends only missing steps', () => {
    expect(mergeStepsIntoChecklist('Read chapter\nlimits', ['Limits', 'Integrals'])).toBe('Read chapter\nlimits\nIntegrals');
  });
  it('starts a new checklist and is a no-op when nothing is missing', () => {
    expect(mergeStepsIntoChecklist('', ['A', 'B'])).toBe('A\nB');
    expect(mergeStepsIntoChecklist('a', ['A'])).toBe('a');
  });
});
