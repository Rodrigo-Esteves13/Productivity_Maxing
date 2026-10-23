import { describe, expect, it } from 'vitest';
import { isValidPadSlug, toPadSlug } from './padSlug';

describe('toPadSlug', () => {
  it('lowercases, drops accents and turns spaces into dashes', () => {
    expect(toPadSlug('Física 1A')).toBe('fisica-1a');
  });

  it('drops characters the backend would refuse', () => {
    expect(toPadSlug('../admin?x=1')).toBe('adminx1');
  });

  it('never starts with - or _', () => {
    expect(toPadSlug('--notas')).toBe('notas');
  });
});

describe('isValidPadSlug', () => {
  it('accepts what toPadSlug produces and refuses the empty name', () => {
    expect(isValidPadSlug(toPadSlug('Turma 3 LEI'))).toBe(true);
    expect(isValidPadSlug('')).toBe(false);
  });
});
