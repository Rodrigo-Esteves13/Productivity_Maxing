import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { QuizAttemptMode } from '@prisma/client';
import {
  QUIZ_MAX_FILE_BYTES,
  QUIZ_MAX_QUESTIONS,
  QUIZ_TITLE_MAX,
} from '../quiz-format';
import { GENERATOR_KINDS, type GeneratorKind } from '../quiz-generators';
import {
  QUIZ_ATTEMPT_MAX_DURATION_MS,
  QUIZ_QUESTION_ID,
  QUIZ_QUESTION_MAX_TIME_MS,
} from '../quizzes.constants';

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
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(QUIZ_TITLE_MAX)
  title?: string;

  // Tipos de geradores ligados (lista fechada, sem repetidos).
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(GENERATOR_KINDS.length)
  @IsIn(GENERATOR_KINDS, { each: true })
  @ArrayUnique()
  generators?: GeneratorKind[];

  // Cadeira (Area) ligada; null = desligar. Ausente = nao mexer.
  @ValidateIf((o: UpdateQuizDto) => o.areaId !== undefined && o.areaId !== null)
  @IsUUID()
  areaId?: string | null;

  // Task ligada (ex: exame); null = desligar. Ausente = nao mexer.
  @ValidateIf((o: UpdateQuizDto) => o.taskId !== undefined && o.taskId !== null)
  @IsUUID()
  taskId?: string | null;
}

export class AttemptResultDto {
  @IsString()
  @Matches(QUIZ_QUESTION_ID)
  questionId!: string;

  @IsBoolean()
  correct!: boolean;

  // Tempo ativo gasto nesta resposta (opcional; clientes antigos nao enviam).
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(QUIZ_QUESTION_MAX_TIME_MS)
  timeMs?: number;
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
