import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { IsStringMatrix, isStringMatrix } from './is-string-matrix.validator';

const LIMITS = { maxRows: 3, maxCols: 2, maxCellLength: 5 };

class TableProbe {
  @IsStringMatrix(LIMITS)
  rows: string[][];
}

describe('isStringMatrix', () => {
  it('aceita uma matriz de texto dentro dos limites', () => {
    expect(
      isStringMatrix(
        [
          ['a', 'b'],
          ['', 'c'],
        ],
        LIMITS,
      ),
    ).toBe(true);
  });

  it('aceita uma tabela sem linhas', () => {
    expect(isStringMatrix([], LIMITS)).toBe(true);
  });

  it('rejeita o formato antigo [{ cells: [...] }] (o bug das tabelas do caderno)', () => {
    expect(isStringMatrix([{ cells: ['a', 'b'] }], LIMITS)).toBe(false);
  });

  it('rejeita valores que nao sao arrays', () => {
    expect(isStringMatrix('abc', LIMITS)).toBe(false);
    expect(isStringMatrix(null, LIMITS)).toBe(false);
    expect(isStringMatrix(undefined, LIMITS)).toBe(false);
  });

  it('rejeita celulas que nao sao texto', () => {
    expect(isStringMatrix([['a', 1]], LIMITS)).toBe(false);
    expect(isStringMatrix([[null]], LIMITS)).toBe(false);
  });

  it('rejeita linhas a mais, colunas a mais e celulas compridas demais', () => {
    expect(isStringMatrix([['a'], ['a'], ['a'], ['a']], LIMITS)).toBe(false);
    expect(isStringMatrix([['a', 'b', 'c']], LIMITS)).toBe(false);
    expect(isStringMatrix([['abcdef']], LIMITS)).toBe(false);
  });

  it('aceita exatamente os limites', () => {
    expect(isStringMatrix([['abcde', 'abcde'], ['a'], ['b']], LIMITS)).toBe(
      true,
    );
  });
});

describe('@IsStringMatrix (decorator)', () => {
  it('valida sem erros um payload no formato que o frontend envia', async () => {
    const probe = plainToInstance(TableProbe, { rows: [['x', 'y']] });
    expect(await validate(probe)).toHaveLength(0);
  });

  it('devolve um erro com a mensagem dos limites para o formato errado', async () => {
    const probe = plainToInstance(TableProbe, { rows: [{ cells: ['x'] }] });
    const errors = await validate(probe);
    expect(errors).toHaveLength(1);
    expect(Object.values(errors[0].constraints ?? {})[0]).toContain(
      'at most 3 rows',
    );
  });
});
