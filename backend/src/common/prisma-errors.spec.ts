import {
  isForeignKeyViolation,
  isNotFound,
  isUniqueViolation,
} from './prisma-errors';

describe('prisma-errors', () => {
  it('reconhece cada codigo', () => {
    expect(isUniqueViolation({ code: 'P2002' })).toBe(true);
    expect(isForeignKeyViolation({ code: 'P2003' })).toBe(true);
    expect(isNotFound({ code: 'P2025' })).toBe(true);
  });

  it('nao confunde codigos', () => {
    expect(isUniqueViolation({ code: 'P2025' })).toBe(false);
    expect(isNotFound({ code: 'P2002' })).toBe(false);
  });

  it('ignora valores que nao sao erros', () => {
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
    expect(isNotFound('P2025')).toBe(false);
    expect(isNotFound({ code: 2025 })).toBe(false);
  });
});
