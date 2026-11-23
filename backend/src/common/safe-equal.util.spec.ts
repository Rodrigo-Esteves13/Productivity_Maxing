import { safeEqual } from './safe-equal.util';

describe('safeEqual', () => {
  it('devolve true para strings iguais', () => {
    expect(safeEqual('abc123', 'abc123')).toBe(true);
  });

  it('devolve false para strings diferentes do mesmo tamanho', () => {
    expect(safeEqual('abc123', 'abc124')).toBe(false);
  });

  it('devolve false, sem lancar, quando os tamanhos diferem', () => {
    expect(safeEqual('abc', 'abcdef')).toBe(false);
    expect(safeEqual('abcdef', 'abc')).toBe(false);
  });

  it('trata strings vazias', () => {
    expect(safeEqual('', '')).toBe(true);
    expect(safeEqual('', 'a')).toBe(false);
  });

  it('compara bytes e nao caracteres (multibyte)', () => {
    expect(safeEqual('ação', 'ação')).toBe(true);
    expect(safeEqual('ação', 'acao')).toBe(false);
  });
});
