import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export const MIN_SYNC_DAYS = 1;
export const MAX_SYNC_DAYS = 14;
// Janela fixa de sincronização: o cliente não a escolhe (era uma escolha
// sem sentido para o utilizador). Duas semanas cobrem o plano de estudo.
export const DEFAULT_SYNC_DAYS = 14;

export class ScheduleSyncDto {
  @ApiPropertyOptional({
    example: 7,
    description: 'How many days ahead (starting today) to sync, 1 to 14.',
  })
  @IsOptional()
  @IsInt()
  @Min(MIN_SYNC_DAYS)
  @Max(MAX_SYNC_DAYS)
  days?: number;
}

// ?days= do preview: fora do intervalo ou nao numerico nao e 400, e
// ajustado (como no StudyPlanController).
export class ScheduleSyncPreviewQueryDto {
  @ApiPropertyOptional({ example: 7 })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    const parsed = Number(value);
    return Number.isFinite(parsed)
      ? Math.min(Math.max(Math.trunc(parsed), MIN_SYNC_DAYS), MAX_SYNC_DAYS)
      : DEFAULT_SYNC_DAYS;
  })
  @IsInt()
  days: number = DEFAULT_SYNC_DAYS;
}
