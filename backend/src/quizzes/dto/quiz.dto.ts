import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { QuizAttemptMode } from '@prisma/client';
import {
  QUIZ_MAX_FILE_BYTES,
  QUIZ_MAX_QUESTIONS,
  QUIZ_TITLE_MAX,
} from '../quiz-format';
import { QUIZ_ATTEMPT_MAX_DURATION_MS } from '../quizzes.constants';

const QUESTION_ID = /^[\w-]{1,48}$/;

// O quiz chega como texto (canonicalQuizText), nunca como objeto: assim nao
// passa pelo class-transformer (quadratico em objetos largos, e reescrevia o
// que foi enviado). O servidor le-o com JSON.parse, verifica-o campo a campo em
// quiz-check.ts e so o aceita se o texto canonico dele for byte a byte igual.
// MaxLength conta unidades UTF-16, sempre <= bytes UTF-8: um quiz dentro de
// QUIZ_MAX_FILE_BYTES passa sempre; o tamanho em bytes e medido na verificacao.
export class ImportQuizDto {
  @IsString()
  @MaxLength(QUIZ_MAX_FILE_BYTES)
  quizJson!: string;
}

export class UpdateQuizDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(QUIZ_TITLE_MAX)
  title!: string;
}

export class AttemptResultDto {
  @IsString()
  @Matches(QUESTION_ID)
  questionId!: string;

  @IsBoolean()
  correct!: boolean;
}

export class SubmitAttemptDto {
  @IsEnum(QuizAttemptMode)
  mode!: QuizAttemptMode;

  @IsInt()
  @Min(0)
  @Max(QUIZ_ATTEMPT_MAX_DURATION_MS)
  durationMs!: number;

  // Perguntas planeadas (maior que results = tentativa parcial).
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(QUIZ_MAX_QUESTIONS)
  planned?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(QUIZ_MAX_QUESTIONS)
  @ValidateNested({ each: true })
  @Type(() => AttemptResultDto)
  results!: AttemptResultDto[];
}
