import { createDaysQueryDto } from '../../common/dto/days-query.dto';
import {
  DISTRACTION_STATS_DEFAULT_DAYS,
  DISTRACTION_STATS_MAX_DAYS,
  DISTRACTION_STATS_MIN_DAYS,
} from '../distraction-stats.util';

export class DistractionStatsQueryDto extends createDaysQueryDto({
  defaultDays: DISTRACTION_STATS_DEFAULT_DAYS,
  maxDays: DISTRACTION_STATS_MAX_DAYS,
  minDays: DISTRACTION_STATS_MIN_DAYS,
}) {}
