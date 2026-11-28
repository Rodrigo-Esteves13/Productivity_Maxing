import { createDaysQueryDto } from '../../common/dto/days-query.dto';
import {
  STUDY_PLAN_DEFAULT_DAYS,
  STUDY_PLAN_MAX_DAYS,
} from '../study-plan.constants';

// GET /study-plan?days=N
export class StudyPlanQueryDto extends createDaysQueryDto({
  defaultDays: STUDY_PLAN_DEFAULT_DAYS,
  maxDays: STUDY_PLAN_MAX_DAYS,
}) {}
