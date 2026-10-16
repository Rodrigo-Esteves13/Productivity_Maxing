import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class RejectAreaProposalDto {
  @ApiPropertyOptional({
    example: 'Duplicate of an existing official area.',
    description: 'Optional reason, shown to the owner of the area.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}
