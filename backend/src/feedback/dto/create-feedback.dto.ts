import { FeedbackCategory } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

const FEEDBACK_MESSAGE_MIN_LENGTH = 3;
// O minimo conta sem espacos nas pontas: "   " nunca passa.
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const FEEDBACK_MESSAGE_MAX_LENGTH = 2000;

// O autor so pode mudar o texto.
export class UpdateOwnFeedbackDto {
  @Transform(trim)
  @IsString()
  @MinLength(FEEDBACK_MESSAGE_MIN_LENGTH)
  @MaxLength(FEEDBACK_MESSAGE_MAX_LENGTH)
  message: string;
}

export class CreateFeedbackDto {
  @IsEnum(FeedbackCategory)
  category: FeedbackCategory;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  // Qualquer língua (inclui CJK): só se limita o tamanho, nunca o alfabeto.
  @Transform(trim)
  @IsString()
  @MinLength(FEEDBACK_MESSAGE_MIN_LENGTH)
  @MaxLength(FEEDBACK_MESSAGE_MAX_LENGTH)
  message: string;

  // Língua da app (código curto: en, pt, zh...).
  @IsOptional()
  @IsString()
  @MaxLength(10)
  language?: string;

  // Rota onde estava (ex: /tasks) - ajuda a perceber o contexto.
  @IsOptional()
  @IsString()
  @MaxLength(200)
  page?: string;
}
