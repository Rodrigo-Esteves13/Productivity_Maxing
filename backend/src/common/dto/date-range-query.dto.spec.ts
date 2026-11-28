import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DATE_RANGE_MAX_DAYS, DateRangeQueryDto } from './date-range-query.dto';

const check = (from: unknown, to: unknown) =>
  validate(plainToInstance(DateRangeQueryDto, { from, to }));

describe('DateRangeQueryDto', () => {
  it('accepts a normal range', async () => {
    expect(await check('2026-09-14', '2026-09-20')).toHaveLength(0);
  });

  it('accepts from after to (empty result, not an error)', async () => {
    expect(await check('2026-09-20', '2026-09-14')).toHaveLength(0);
  });

  it.each([
    ['2026-13-01', '2026-09-20'],
    ['2026-09-14', '2026-02-31'],
    ['lixo', '2026-09-20'],
    [undefined, '2026-09-20'],
    ['2026-09-14', undefined],
    ['2026-9-14', '2026-09-20'],
  ])('rejects invalid dates %s / %s', async (from, to) => {
    expect((await check(from, to)).length).toBeGreaterThan(0);
  });

  it('accepts exactly the max days and rejects one more', async () => {
    // 2026-01-01 + 399 dias = 2027-02-04 (400 dias inclusive)
    expect(DATE_RANGE_MAX_DAYS).toBe(400);
    expect(await check('2026-01-01', '2027-02-04')).toHaveLength(0);
    expect(await check('2026-01-01', '2027-02-05')).toHaveLength(1);
  });
});
