import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PERSONAL_NOTE_BODY_MAX_LENGTH,
  PERSONAL_NOTE_TITLE_MAX_LENGTH,
} from '../personal-notes.constants';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreatePersonalNoteDto {
  @ApiProperty({ example: 'Levar o cartao de dador' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(PERSONAL_NOTE_TITLE_MAX_LENGTH)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(PERSONAL_NOTE_BODY_MAX_LENGTH)
  body?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  pinned?: boolean;

  // ISO com hora. null limpa o lembrete.
  @ApiPropertyOptional({ example: '2026-11-02T09:00:00.000Z', nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsDateString()
  remindAt?: string | null;
}

export class UpdatePersonalNoteDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(PERSONAL_NOTE_TITLE_MAX_LENGTH)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(PERSONAL_NOTE_BODY_MAX_LENGTH)
  body?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  pinned?: boolean;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsDateString()
  remindAt?: string | null;

  // Marcar como feito para de avisar (e arruma a nota no fim da lista).
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  done?: boolean;
}
