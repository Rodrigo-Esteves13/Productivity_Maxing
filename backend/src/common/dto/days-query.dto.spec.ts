import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
  HistoryQueryDto,
  DailyTotalsQueryDto,
} from '../../study-sessions/dto/session-days-query.dto';
import { DistractionStatsQueryDto } from '../../study-sessions/dto/distraction-stats-query.dto';
import { StudyPlanQueryDto } from '../../study-plan/dto/study-plan-query.dto';
import {
  DAYS_QUERY_DEFAULT,
  DAYS_QUERY_MAX,
  DaysQueryDto,
} from './days-query.dto';

type DaysDto = { days: number };

// Como o ValidationPipe global (transform + whitelist + forbidNonWhitelisted).
function parse(cls: new () => DaysDto, query: Record<string, unknown>) {
  const dto = plainToInstance(cls, query);
  const errors = validateSync(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return { dto, errors };
}

describe('DaysQueryDto / createDaysQueryDto', () => {
  it.each([
    [HistoryQueryDto, 14, 90],
    [DailyTotalsQueryDto, 84, 365],
    [StudyPlanQueryDto, 7, 30],
    [DistractionStatsQueryDto, 90, 365],
    [DaysQueryDto, DAYS_QUERY_DEFAULT, DAYS_QUERY_MAX],
  ])('%p: default %p, max %p', (cls, defaultDays, maxDays) => {
    const missing = parse(cls, {});
    expect(missing.errors).toHaveLength(0);
    expect(missing.dto.days).toBe(defaultDays);

    const atMax = parse(cls, { days: String(maxDays) });
    expect(atMax.errors).toHaveLength(0);
    expect(atMax.dto.days).toBe(maxDays);

    expect(parse(cls, { days: String(maxDays + 1) }).errors).not.toHaveLength(
      0,
    );
  });

  it.each(['0', '-3', '1e9', '7.5', 'abc'])(
    'rejects days=%p instead of clamping it in silence',
    (days) => {
      expect(parse(HistoryQueryDto, { days }).errors).not.toHaveLength(0);
    },
  );

  it('keeps the per-route minimum (distraction stats starts at 7)', () => {
    expect(
      parse(DistractionStatsQueryDto, { days: '6' }).errors,
    ).not.toHaveLength(0);
    expect(parse(DistractionStatsQueryDto, { days: '7' }).errors).toHaveLength(
      0,
    );
  });

  it('accepts the values the frontend sends', () => {
    for (const days of ['7', '14', '30', '90', '2']) {
      expect(parse(HistoryQueryDto, { days }).errors).toHaveLength(0);
    }
    for (const days of ['1', '7']) {
      expect(parse(StudyPlanQueryDto, { days }).errors).toHaveLength(0);
    }
  });
});
