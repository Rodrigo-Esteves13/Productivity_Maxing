import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

export class LinkAreaDto {
  @ApiProperty({ description: 'One of your notebook subjects (areas).' })
  @IsUUID()
  areaId: string;
}

export class SearchTurmaNotesQueryDto {
  @ApiProperty({ example: 'resumo' })
  @Transform(trim)
  @IsString()
  @MaxLength(SEARCH_QUERY_MAX_LENGTH)
  q: string;
}
