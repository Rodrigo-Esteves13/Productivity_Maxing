import { describe, expect, it } from 'vitest';
import { ALL_MEDICATION_PARTS, MEDICATION_DATA_PARTS, MEDICATION_RELOAD, mergeParts } from './medicationReload';

describe('medication reload parts', () => {
  it('only reloads the disclaimer on mount and when it is accepted', () => {
    expect(ALL_MEDICATION_PARTS).toContain('disclaimer');
    expect(MEDICATION_DATA_PARTS).not.toContain('disclaimer');
    const others = Object.entries(MEDICATION_RELOAD).filter(([action]) => action !== 'disclaimer');
    for (const [, parts] of others) expect(parts).not.toContain('disclaimer');
    expect(MEDICATION_RELOAD.disclaimer).toEqual(['disclaimer']);
  });

  it('reloads only the intakes for an as-needed intake', () => {
    expect(MEDICATION_RELOAD.intake).toEqual(['intakes']);
  });

  it('reloads the intakes when their medication is renamed or removed', () => {
    expect(MEDICATION_RELOAD.rename).toContain('intakes');
    expect(MEDICATION_RELOAD.remove).toContain('intakes');
    expect(MEDICATION_RELOAD.update).not.toContain('intakes');
  });

  it('merges the parts left stale by a failed reload, without repeats', () => {
    expect(mergeParts(['intakes'], ['day', 'intakes'])).toEqual(['day', 'intakes']);
    expect(mergeParts(['intakes'], [])).toEqual(['intakes']);
  });
});
