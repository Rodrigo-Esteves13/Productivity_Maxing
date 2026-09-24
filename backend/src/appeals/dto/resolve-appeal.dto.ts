import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { AppealResolution } from '@prisma/client';

export class ResolveAppealDto {
  @IsEnum(AppealResolution)
  resolution: AppealResolution;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  resolutionNote?: string;
}
