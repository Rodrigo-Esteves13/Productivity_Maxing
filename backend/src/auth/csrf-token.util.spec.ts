import { isWellFormedCsrfToken } from './csrf-token.util';

describe('isWellFormedCsrfToken', () => {
  it('aceita um token de 64 hex', () => {
    expect(isWellFormedCsrfToken('a'.repeat(64))).toBe(true);
    expect(isWellFormedCsrfToken('0123456789abcdef'.repeat(4))).toBe(true);
  });

  it('recusa tamanhos e caracteres errados', () => {
    expect(isWellFormedCsrfToken('a'.repeat(63))).toBe(false);
    expect(isWellFormedCsrfToken('a'.repeat(65))).toBe(false);
    expect(isWellFormedCsrfToken('g'.repeat(64))).toBe(false);
    expect(isWellFormedCsrfToken('A'.repeat(64))).toBe(false);
  });

  it('recusa valores que nao sao texto', () => {
    expect(isWellFormedCsrfToken(undefined)).toBe(false);
    expect(isWellFormedCsrfToken(null)).toBe(false);
    expect(isWellFormedCsrfToken(12345)).toBe(false);
    expect(isWellFormedCsrfToken('')).toBe(false);
  });
});
