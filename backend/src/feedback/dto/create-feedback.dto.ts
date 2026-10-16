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

export class CreateFeedbackDto {
  @IsEnum(FeedbackCategory)
  category: FeedbackCategory;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  // Qualquer língua (inclui CJK): só se limita o tamanho, nunca o alfabeto.
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
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
