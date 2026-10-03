import { IsInt, Max, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import {
  MAX_DAILY_STUDY_LIMIT_MINUTES,
  MIN_DAILY_STUDY_LIMIT_MINUTES,
} from '../study-plan.constants';

export class UpdateStudyPlanSettingsDto {
  @ApiProperty({
    example: 240,
    description:
      'Most study minutes the plan should schedule in a single day before it counts as overtime.',
  })
  @IsInt()
  @Min(MIN_DAILY_STUDY_LIMIT_MINUTES)
  @Max(MAX_DAILY_STUDY_LIMIT_MINUTES)
  dailyLimitMinutes: number;
}
