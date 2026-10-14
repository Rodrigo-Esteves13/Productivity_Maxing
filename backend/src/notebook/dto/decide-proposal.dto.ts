import { IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DecideProposalDto {
  @ApiProperty({ enum: ['APPROVED', 'REJECTED'] })
  @IsIn(['APPROVED', 'REJECTED'])
  decision: 'APPROVED' | 'REJECTED';
}
