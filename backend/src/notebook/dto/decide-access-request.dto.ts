import { IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DecideAccessRequestDto {
  @ApiProperty({ enum: ['APPROVED', 'DENIED'] })
  @IsIn(['APPROVED', 'DENIED'])
  decision: 'APPROVED' | 'DENIED';
}
