import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CourseRiskQueryDto } from './course-risk-query.dto';

const errorsOf = async (query: Record<string, unknown>) =>
  (await validate(plainToInstance(CourseRiskQueryDto, query))).map(
    (e) => e.property,
  );

describe('CourseRiskQueryDto', () => {
  it('accepts a missing limit', async () => {
    expect(await errorsOf({})).toEqual([]);
  });

  it('accepts the 1 and 100 bounds, also as query strings', async () => {
    expect(await errorsOf({ absenceLimitPct: '1' })).toEqual([]);
    expect(await errorsOf({ absenceLimitPct: '100' })).toEqual([]);
    expect(await errorsOf({ absenceLimitPct: 25 })).toEqual([]);
  });

  it('accepts a missing periodId and a valid UUID', async () => {
    expect(await errorsOf({})).toEqual([]);
    expect(
      await errorsOf({ periodId: '3f1c2b4e-9a7d-4c1e-8b2a-5d6e7f8a9b0c' }),
    ).toEqual([]);
  });

  it.each(['abc', '123', '', "' OR 1=1 --"])(
    'rejects periodId %j',
    async (value) => {
      expect(await errorsOf({ periodId: value })).toEqual(['periodId']);
    },
  );

  it.each(['0', '101', '-5', '12.5', 'abc'])('rejects %s', async (value) => {
    expect(await errorsOf({ absenceLimitPct: value })).toEqual([
      'absenceLimitPct',
    ]);
  });
});
