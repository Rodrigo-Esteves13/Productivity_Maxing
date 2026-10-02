import { Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { DATE_KEY_PATTERN } from '../../common/date-key.util';

export class WorkShiftRangeQueryDto {
  @ApiProperty({ example: '2026-09-28' })
  @Matches(DATE_KEY_PATTERN, { message: 'from must be formatted YYYY-MM-DD.' })
  from: string;

  @ApiProperty({ example: '2026-10-04' })
  @Matches(DATE_KEY_PATTERN, { message: 'to must be formatted YYYY-MM-DD.' })
  to: string;
}
