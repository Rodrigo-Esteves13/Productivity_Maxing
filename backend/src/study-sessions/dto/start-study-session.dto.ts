import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class StartStudySessionDto {
  @ApiPropertyOptional({
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    description:
      'Task this session is for. Must belong to the current user - validated in StudySessionsService.',
  })
  @IsOptional()
  @IsUUID()
  taskId?: string;

  @ApiPropertyOptional({
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    description: 'Area this session is for (Areas are shared, not per-user).',
  })
  @IsOptional()
  @IsUUID()
  areaId?: string;

  @ApiPropertyOptional({
    example: 'Focused on limits and derivatives',
    description: 'Free-text note for this session.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
