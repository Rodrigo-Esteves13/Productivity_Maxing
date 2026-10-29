import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  IsNumber,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { NormalizeEmail } from '../../auth/email.util';
import {
  ANNOUNCEMENT_BODY_MAX_LENGTH,
  ANNOUNCEMENT_TITLE_MAX_LENGTH,
  INVITE_CODE_PATTERN,
  SEARCH_QUERY_MAX_LENGTH,
  TURMA_DESCRIPTION_MAX_LENGTH,
  TURMA_NAME_MAX_LENGTH,
  TURMA_NOTE_MAX_CONTENT_LENGTH,
  TURMA_NOTE_TITLE_MAX_LENGTH,
} from '../turmas.constants';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const upperTrim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class CreateTurmaDto {
  @ApiProperty({ example: 'LEI 2A Turma 3' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(TURMA_NAME_MAX_LENGTH)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(TURMA_DESCRIPTION_MAX_LENGTH)
  description?: string;
}

export class UpdateTurmaDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(TURMA_NAME_MAX_LENGTH)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(TURMA_DESCRIPTION_MAX_LENGTH)
  description?: string;

  @ApiPropertyOptional({
    description: 'When false, only the delegado creates and edits turma notes.',
  })
  @IsOptional()
  @IsBoolean()
  membersCanEditNotes?: boolean;
}

export class JoinTurmaDto {
  @ApiProperty({ example: 'K7PQ2MXA' })
  @Transform(upperTrim)
  @IsString()
  @Matches(INVITE_CODE_PATTERN)
  code: string;
}

// Convite direto: um amigo por id; um admin pode usar o email de qualquer conta.
export class InviteToTurmaDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ example: 'colega@example.com' })
  @IsOptional()
  @NormalizeEmail()
  @IsEmail()
  email?: string;
}

export class TransferDelegadoDto {
  @ApiProperty({ description: 'Member who becomes the new delegado.' })
  @IsUUID()
  userId: string;
}

export class CreateAnnouncementDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(ANNOUNCEMENT_TITLE_MAX_LENGTH)
  title: string;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(ANNOUNCEMENT_BODY_MAX_LENGTH)
  body: string;
}

export class CreateTurmaNoteDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(TURMA_NOTE_TITLE_MAX_LENGTH)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(TURMA_NOTE_MAX_CONTENT_LENGTH)
  content?: string;
}

export class SaveTurmaNoteDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(TURMA_NOTE_TITLE_MAX_LENGTH)
  title: string;

  @ApiProperty()
  @IsString()
  @MaxLength(TURMA_NOTE_MAX_CONTENT_LENGTH)
  content: string;

  @ApiProperty({
    description:
      'Version the client last loaded. A different current version returns 409 with the latest note.',
  })
  @IsInt()
  @Min(1)
  baseVersion: number;
}

export class ShareProgramDto {
  @ApiProperty({ description: 'One of your programs (Grades).' })
  @IsUUID()
  programId: string;
}

export class ShareTurmaScheduleDto {
  @ApiProperty({ description: 'Share your class timetable with this class.' })
  @IsBoolean()
  share: boolean;
}

export class CopyTurmaSubjectDto {
  @ApiProperty({ example: 'Computacao Movel' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  subject: string;
}

export class LinkAreaDto {
  @ApiProperty({ description: 'One of your notebook subjects (areas).' })
  @IsUUID()
  areaId: string;
}

export class SharePackDto {
  @ApiProperty({ description: 'One of YOUR task packs.' })
  @IsUUID()
  packId: string;
}

export class SearchTurmaNotesQueryDto {
  @ApiProperty({ example: 'resumo' })
  @Transform(trim)
  @IsString()
  @MaxLength(SEARCH_QUERY_MAX_LENGTH)
  q: string;
}

// Prazos da turma: so os tipos academicos com data (sem tarefa secundaria).
export const TURMA_DEADLINE_KINDS = ['FREQUENCIA', 'TRABALHO_PRATICO'] as const;

export class CreateTurmaDeadlineDto {
  @ApiProperty({ example: 'Midterm' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @ApiProperty({ example: 'Computer Networks' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  subject: string;

  @ApiProperty({ example: '2026-11-12T09:00:00.000Z' })
  @IsDateString()
  dueAt: string;

  @ApiPropertyOptional({
    example: 40,
    description: 'Weight in the final grade (%).',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  weightPercentage?: number | null;

  @ApiProperty({ enum: TURMA_DEADLINE_KINDS })
  @IsIn(TURMA_DEADLINE_KINDS)
  kind: string;
}

export class UpdateTurmaDeadlineDto extends PartialType(
  CreateTurmaDeadlineDto,
) {}

export class AdoptTurmaDeadlineDto {
  @ApiProperty({ description: 'Your subject (area) the task goes into.' })
  @IsUUID()
  areaId: string;
}
