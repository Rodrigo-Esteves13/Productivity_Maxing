import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export const FEEDBACK_REPLY_MAX_LENGTH = 2000;

export class ResolveFeedbackDto {
  @ApiProperty()
  @IsBoolean()
  isResolved: boolean;
}

// Resposta do admin ao autor. `resolve` fecha o feedback na mesma acao.
export class ReplyFeedbackDto {
  @ApiProperty({ example: 'Thanks, this is now on the roadmap.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(FEEDBACK_REPLY_MAX_LENGTH)
  message: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  resolve?: boolean;
}

// Recusar: fecha como REJECTED, com motivo opcional que o autor ve.
export class RejectFeedbackDto {
  @ApiPropertyOptional({ example: 'Out of scope for the app.' })
  @IsOptional()
  @IsString()
  @MaxLength(FEEDBACK_REPLY_MAX_LENGTH)
  reason?: string;
}

export class MuteFeedbackDto {
  @ApiProperty()
  @IsBoolean()
  muted: boolean;
}
