import { describe, expect, it } from 'vitest';
import { advanceSequence, GO_TARGETS, INITIAL_SEQUENCE, SEQUENCE_TIMEOUT_MS } from './shortcutSequence';

describe('advanceSequence', () => {
  it('arms on the prefix', () => {
    const r = advanceSequence(INITIAL_SEQUENCE, 'g', 100);
    expect(r.state.armedAt).toBe(100);
    expect(r.path).toBeNull();
  });

  it('navigates on a target letter inside the timeout', () => {
    const armed = advanceSequence(INITIAL_SEQUENCE, 'g', 100).state;
    const r = advanceSequence(armed, 't', 100 + SEQUENCE_TIMEOUT_MS);
    expect(r.path).toBe('/tasks');
    expect(r.state.armedAt).toBeNull();
  });

  it('ignores the letter after the timeout', () => {
    const armed = advanceSequence(INITIAL_SEQUENCE, 'g', 100).state;
    const r = advanceSequence(armed, 't', 100 + SEQUENCE_TIMEOUT_MS + 1);
    expect(r.path).toBeNull();
    expect(r.state.armedAt).toBeNull();
  });

  it('ignores a target letter without the prefix', () => {
    expect(advanceSequence(INITIAL_SEQUENCE, 'd', 5).path).toBeNull();
  });

  it('resets on an unknown key and re-arms on a second prefix', () => {
    const armed = advanceSequence(INITIAL_SEQUENCE, 'g', 0).state;
    expect(advanceSequence(armed, 'x', 10).state.armedAt).toBeNull();
    expect(advanceSequence(armed, 'g', 10).state.armedAt).toBe(10);
  });

  it('consumes the prefix and the completing key so page shortcuts (g n vs n) stay quiet', () => {
    const armed = advanceSequence(INITIAL_SEQUENCE, 'g', 0);
    expect(armed.consumed).toBe(true);
    const done = advanceSequence(armed.state, 'n', 10);
    expect(done.path).toBe('/notebook');
    expect(done.consumed).toBe(true);
  });

  it('does not consume keys outside a sequence or after it timed out', () => {
    expect(advanceSequence(INITIAL_SEQUENCE, 'n', 5).consumed).toBe(false);
    const armed = advanceSequence(INITIAL_SEQUENCE, 'g', 0).state;
    expect(advanceSequence(armed, 'x', 10).consumed).toBe(false);
    expect(advanceSequence(armed, 'n', SEQUENCE_TIMEOUT_MS + 1).consumed).toBe(false);
  });

  it('has unique target keys that are not the prefix', () => {
    const keys = GO_TARGETS.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).not.toContain('g');
  });
});
