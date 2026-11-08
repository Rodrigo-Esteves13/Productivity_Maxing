import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ACCENT_IDS, ACCENT_SWATCHES, DEFAULT_ACCENT, isAccentId, parseStoredAccent } from './accentColor';

describe('accentColor', () => {
  it('accepts every known accent', () => {
    for (const id of ACCENT_IDS) expect(parseStoredAccent(id)).toBe(id);
  });

  it('falls back to the default for unknown, empty or missing values', () => {
    for (const bad of ['green', '', 'VIOLET', '{"a":1}', null, undefined]) {
      expect(parseStoredAccent(bad)).toBe(DEFAULT_ACCENT);
    }
  });

  it('isAccentId rejects non strings', () => {
    expect(isAccentId(3)).toBe(false);
    expect(isAccentId('blue')).toBe(true);
  });

  it('has a swatch for every accent and none is a green', () => {
    for (const id of ACCENT_IDS) expect(ACCENT_SWATCHES[id]).toMatch(/^#[0-9a-f]{6}$/);
    expect(ACCENT_IDS).not.toContain('green');
    expect(ACCENT_IDS).not.toContain('emerald');
  });

  it('accents.css defines a block (dark, light, high contrast) for each non default accent', () => {
    const css = readFileSync(new URL('../styles/accents.css', import.meta.url), 'utf8');
    for (const id of ACCENT_IDS.filter((a) => a !== DEFAULT_ACCENT)) {
      expect(css).toContain(`:root[data-accent='${id}'] {`);
      expect(css).toContain(`:root[data-accent='${id}'][data-theme='light'] {`);
      expect(css).toContain(`:root[data-accent='${id}'][data-contrast='high']`);
    }
  });
});
