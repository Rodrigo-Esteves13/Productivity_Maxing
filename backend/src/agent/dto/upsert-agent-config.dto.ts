import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  AgentFailMode,
  AgentTriggerMode,
  Difficulty,
  ProgressStatus,
} from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';

// Progresso mínimo aceite em minProgressStatus - COMPLETED não faz sentido
// como "threshold de atraso" (é o oposto), por isso fica de fora da lista
// aceite mesmo sendo um valor válido do enum ProgressStatus no schema.
const ALLOWED_MIN_PROGRESS_STATUS = [
  ProgressStatus.AHEAD,
  ProgressStatus.ON_TRACK,
  ProgressStatus.BEHIND,
  ProgressStatus.VERY_BEHIND,
];

export class UpsertAgentConfigDto {
  @ApiPropertyOptional({ enum: AgentTriggerMode, example: AgentTriggerMode.ANY })
  @IsOptional()
  @IsEnum(AgentTriggerMode)
  triggerMode?: AgentTriggerMode;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  hasOverdueTasks?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  hasOverdueCheckins?: boolean;

  @ApiPropertyOptional({
    enum: Difficulty,
    nullable: true,
    example: Difficulty.HARD,
    description: 'null desativa esta regra',
  })
  @IsOptional()
  @ValidateIf((o: UpsertAgentConfigDto) => o.minDifficultyToday !== null)
  @IsEnum(Difficulty)
  minDifficultyToday?: Difficulty | null;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  anyTaskToday?: boolean;

  @ApiPropertyOptional({
    enum: ALLOWED_MIN_PROGRESS_STATUS,
    nullable: true,
    example: ProgressStatus.BEHIND,
    description: 'null desativa esta regra. COMPLETED não é um valor aceite aqui.',
  })
  @IsOptional()
  @ValidateIf((o: UpsertAgentConfigDto) => o.minProgressStatus !== null)
  @IsEnum(ALLOWED_MIN_PROGRESS_STATUS)
  minProgressStatus?: ProgressStatus | null;

  @ApiPropertyOptional({ example: ['steam.exe', 'Discord.exe'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(255, { each: true })
  blockedProcesses?: string[];

  @ApiPropertyOptional({ example: ['youtube.com', 'instagram.com'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  @MaxLength(255, { each: true })
  blockedDomains?: string[];

  @ApiPropertyOptional({ enum: AgentFailMode, example: AgentFailMode.CLOSED })
  @IsOptional()
  @IsEnum(AgentFailMode)
  failMode?: AgentFailMode;

  @ApiPropertyOptional({
    example: 60,
    description: 'Cada quantos segundos o agente volta a consultar a API',
  })
  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(3600)
  pollIntervalSeconds?: number;
}