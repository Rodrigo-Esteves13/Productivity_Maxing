import {
  IsOptional,
  IsString,
  IsInt,
  IsEnum,
  Min,
  Max,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CommuteMode } from '@prisma/client';

// Usado por PATCH /auth/me. De propósito só tem campos de texto/número
// simples: o avatar tem o seu próprio endpoint (POST /auth/me/avatar)
// porque é um upload de ficheiro, não um campo de texto, assim nunca se
// aceita um avatarUrl arbitrário vindo do cliente, só o que o próprio
// Supabase Storage devolve.
export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Rodrigo Esteves' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string;

  // Horário/plano de estudo (Fase 6) - ver comentário completo em
  // User.commuteMinutes no schema.prisma. homeAddress/campusAddress
  // também podem ser gravados diretamente aqui (edição manual), embora o
  // caminho normal para os três juntos seja POST /schedule/commute/
  // estimate.
  @ApiPropertyOptional({
    example: 25,
    description:
      'One-way commute time in minutes, used by the study plan generator.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(300)
  commuteMinutes?: number;

  // Nem todo o estudante tem carro - guardado separadamente para o
  // CommuteSettingsCard lembrar a escolha mesmo quando o commute é
  // editado à mão (sem passar pelo botão "Calculate automatically").
  @ApiPropertyOptional({ enum: CommuteMode, example: CommuteMode.TRANSIT })
  @IsOptional()
  @IsEnum(CommuteMode)
  commuteMode?: CommuteMode;

  @ApiPropertyOptional({ example: 'Rua Exemplo 123, Porto' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  homeAddress?: string;

  @ApiPropertyOptional({ example: 'Instituto XYZ, Maia' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  campusAddress?: string;

  // Minutos desde a meia-noite (hora de Lisboa). Só fazem efeito quando
  // os dois são enviados juntos - ver comentário em
  // User.quietHoursStart/quietHoursEnd no schema.prisma.
  @ApiPropertyOptional({
    example: 1380,
    description:
      'Quiet hours start, minutes since midnight (e.g. 23:00 = 1380).',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1439)
  quietHoursStart?: number;

  @ApiPropertyOptional({
    example: 420,
    description: 'Quiet hours end, minutes since midnight (e.g. 07:00 = 420).',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1439)
  quietHoursEnd?: number;
}
