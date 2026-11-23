import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CalendarFeedQueryDto } from './calendar-feed-query.dto';
import { ScheduleSyncPreviewQueryDto } from './schedule-sync.dto';
import { FinanceSummaryQueryDto } from '../../finance/dto/finance.dto';

describe('ScheduleSyncPreviewQueryDto', () => {
  it.each([
    [undefined, 14],
    ['7', 7],
    ['0', 1],
    ['99', 14],
    ['abc', 14],
  ])('days=%s becomes %s and stays valid', async (raw, expected) => {
    const dto = plainToInstance(
      ScheduleSyncPreviewQueryDto,
      raw === undefined ? {} : { days: raw },
    );
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.days).toBe(expected);
  });
});

describe('CalendarFeedQueryDto', () => {
  it('accepts no scope and known scopes, rejects others', async () => {
    expect(await validate(plainToInstance(CalendarFeedQueryDto, {}))).toEqual(
      [],
    );
    expect(
      await validate(plainToInstance(CalendarFeedQueryDto, { only: 'tasks' })),
    ).toEqual([]);
    expect(
      (await validate(plainToInstance(CalendarFeedQueryDto, { only: 'x' })))
        .length,
    ).toBeGreaterThan(0);
  });
});

describe('FinanceSummaryQueryDto', () => {
  it.each(['2026-05', '2026-12'])('accepts %s', async (month) => {
    expect(
      await validate(plainToInstance(FinanceSummaryQueryDto, { month })),
    ).toEqual([]);
  });

  it.each(['2026-13', '2026-00', '2026-5', 'lixo'])(
    'rejects %s',
    async (month) => {
      expect(
        (await validate(plainToInstance(FinanceSummaryQueryDto, { month })))
          .length,
      ).toBeGreaterThan(0);
    },
  );

  it('rejects a missing month', async () => {
    expect(
      (await validate(plainToInstance(FinanceSummaryQueryDto, {}))).length,
    ).toBeGreaterThan(0);
  });
});
