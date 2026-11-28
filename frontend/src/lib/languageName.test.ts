import { describe, expect, it } from 'vitest';
import { languageName } from './languageName';

describe('languageName', () => {
  it('names a known code in the app language', () => {
    expect(languageName('pt', 'en')).toBe('Portuguese');
  });

  it('keeps an invalid code', () => {
    expect(languageName('??', 'en')).toBe('??');
  });
});
