import { createDaysQueryDto } from '../../common/dto/days-query.dto';
import {
  DAILY_TOTALS_DEFAULT_DAYS,
  DAILY_TOTALS_MAX_DAYS,
  HISTORY_DEFAULT_DAYS,
  HISTORY_MAX_DAYS,
} from '../study-sessions.constants';

// GET /study-sessions/history?days=N
export class HistoryQueryDto extends createDaysQueryDto({
  defaultDays: HISTORY_DEFAULT_DAYS,
  maxDays: HISTORY_MAX_DAYS,
}) {}

// GET /study-sessions/daily-totals?days=N
export class DailyTotalsQueryDto extends createDaysQueryDto({
  defaultDays: DAILY_TOTALS_DEFAULT_DAYS,
  maxDays: DAILY_TOTALS_MAX_DAYS,
}) {}
