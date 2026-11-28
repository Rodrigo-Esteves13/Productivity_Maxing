import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { IsRealDateKey } from '../../common/validators/is-real-date-key.decorator';

export class EctsWorkloadQueryDto {
  @ApiProperty({ example: '2026-09-14' })
  @IsRealDateKey()
  from!: string;

  @ApiProperty({ example: '2027-01-31' })
  @IsRealDateKey()
  to!: string;

  @ApiPropertyOptional({
    description:
      'Only courses used in this period (must belong to the user). Without it: courses linked to the timetable or with study time in the range.',
  })
  @IsOptional()
  @IsUUID()
  periodId?: string;
}
