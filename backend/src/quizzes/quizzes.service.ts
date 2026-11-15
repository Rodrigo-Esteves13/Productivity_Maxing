import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  canonicalQuizText,
  recheckCanonicalQuiz,
  sanitizeQuizText,
} from './quiz-check';
import { sanitizeQuizDiagram, type QuizDiagram } from './quiz-diagram';
import { QUIZ_TITLE_MAX, type Quiz } from './quiz-format';
import { ImportQuizDto, SubmitAttemptDto, UpdateQuizDto } from './dto/quiz.dto';
import { MAX_QUIZZES_PER_USER, QUIZ_ATTEMPTS_KEPT } from './quizzes.constants';

export interface QuestionStat {
  seen: number;
  correct: number;
  last: boolean;
}
export type QuizStats = Record<string, QuestionStat>;

const PERCENT = 100;

const SUMMARY = {
  id: true,
  title: true,
  language: true,
  questionCount: true,
  lastScorePct: true,
  createdAt: true,
} satisfies Prisma.QuizSelect;

const ATTEMPT = {
  id: true,
  mode: true,
  total: true,
  correct: true,
  durationMs: true,
  planned: true,
  finishedAt: true,
} satisfies Prisma.QuizAttemptSelect;

const NOT_FOUND = 'Quiz not found.';
// Mensagem unica para qualquer recusa do import: nao diz o que falhou.
const IMPORT_REFUSED = 'This quiz did not pass the checks.';
// Chaves que nunca passam para um objeto devolvido (poluicao de prototipos),
// nem nomes herdados de Object.prototype ("toString", "valueOf"...).
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const isReservedKey = (key: string): boolean =>
  FORBIDDEN_KEYS.has(key) || key in Object.prototype;

// Figuras guardadas, lidas sem confiar na BD: cada uma volta a passar pela
// validacao dos diagramas; o que nao for um diagrama valido (ex.: SVG antigo) sai.
function readFigures(raw: Prisma.JsonValue): Record<string, QuizDiagram> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, QuizDiagram> = {};
  Object.entries(raw).forEach(([id, value]) => {
    const { diagram } = sanitizeQuizDiagram(value);
    if (diagram && !isReservedKey(id)) out[id] = diagram;
  });
  return out;
}

// Le as estatisticas guardadas sem confiar na forma (Json da BD). Objeto sem
// prototipo: um id antigo como "toString" e uma chave normal, nunca le uma
// funcao herdada. Chaves proibidas ("__proto__"...) nunca sao ids validos.
function readStats(raw: Prisma.JsonValue): QuizStats {
  const out = Object.create(null) as QuizStats;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  Object.entries(raw).forEach(([id, v]) => {
    if (
      !FORBIDDEN_KEYS.has(id) &&
      v &&
      typeof v === 'object' &&
      !Array.isArray(v)
    ) {
      const s = v as Record<string, unknown>;
      out[id] = {
        seen: Number(s.seen) || 0,
        correct: Number(s.correct) || 0,
        last: s.last === true,
      };
    }
  });
  return out;
}

function questionIds(raw: Prisma.JsonValue): Set<string> {
  if (!Array.isArray(raw)) return new Set();
  return new Set(
    raw.flatMap((q) =>
      q &&
      typeof q === 'object' &&
      !Array.isArray(q) &&
      typeof q.id === 'string'
        ? [q.id]
        : [],
    ),
  );
}

// Le o texto do import e so o aceita se for exatamente o texto canonico que o
// servidor gera para o quiz verificado agora. A comparacao byte a byte recusa
// tudo o que o JSON.parse esconde: chaves repetidas, numeros escritos de outra
// forma (72.0, 7.2e1), escapes \u, chaves "__proto__" e qualquer espaco a mais.
function readCanonicalQuiz(quizJson: string): Quiz {
  let payload: unknown;
  try {
    payload = JSON.parse(quizJson);
  } catch {
    throw new BadRequestException(IMPORT_REFUSED);
  }
  const quiz = recheckCanonicalQuiz(payload);
  if (!quiz || canonicalQuizText(quiz) !== quizJson)
    throw new BadRequestException(IMPORT_REFUSED);
  return quiz;
}

@Injectable()
export class QuizzesService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.quiz.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: MAX_QUIZZES_PER_USER,
      select: SUMMARY,
    });
  }

  async get(userId: string, id: string) {
    const quiz = await this.prisma.quiz.findFirst({
      where: { id, userId },
      select: {
        ...SUMMARY,
        secondsPerQuestion: true,
        topics: true,
        questions: true,
        figures: true,
        stats: true,
        attempts: {
          orderBy: { finishedAt: 'desc' },
          take: QUIZ_ATTEMPTS_KEPT,
          select: ATTEMPT,
        },
      },
    });
    if (!quiz) throw new NotFoundException(NOT_FOUND);
    return {
      ...quiz,
      figures: readFigures(quiz.figures),
      stats: readStats(quiz.stats),
    };
  }

  /**
   * Volta a verificar o quiz inteiro no servidor antes de gravar. Regra
   * estrita: o cliente envia o texto canonico de checkQuizText e so passa se
   * a verificacao do servidor der exatamente o mesmo texto, byte a byte, sem
   * avisos nem perguntas saltadas. Grava sempre a saida do servidor, nunca o
   * recebido.
   */
  async import(userId: string, dto: ImportQuizDto) {
    const quiz = readCanonicalQuiz(dto.quizJson);
    const created = await this.prisma.$transaction(async (tx) => {
      // Tranca a linha do utilizador ate ao fim da transacao: imports em
      // paralelo do mesmo utilizador esperam aqui, por isso a contagem e o
      // create nunca passam do limite.
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR NO KEY UPDATE`;
      const count = await tx.quiz.count({ where: { userId } });
      if (count >= MAX_QUIZZES_PER_USER) {
        throw new BadRequestException(
          `You can keep at most ${MAX_QUIZZES_PER_USER} quizzes.`,
        );
      }
      return tx.quiz.create({
        data: {
          userId,
          title: quiz.title || 'Quiz',
          language: quiz.language,
          secondsPerQuestion: quiz.secondsPerQuestion,
          topics: quiz.topics,
          questions: quiz.questions as unknown as Prisma.InputJsonValue,
          figures: quiz.figures as unknown as Prisma.InputJsonValue,
          questionCount: quiz.questions.length,
        },
        select: SUMMARY,
      });
    });
    // So entra um quiz sem perguntas saltadas (o cliente ja as tirou).
    return { ...created, skipped: 0 };
  }

  async update(userId: string, id: string, dto: UpdateQuizDto) {
    const title = sanitizeQuizText(dto.title, QUIZ_TITLE_MAX, undefined, false);
    if (!title) throw new BadRequestException('The title cannot be empty.');
    const { count } = await this.prisma.quiz.updateMany({
      where: { id, userId },
      data: { title },
    });
    if (count === 0) throw new NotFoundException(NOT_FOUND);
    return { id, title };
  }

  async remove(userId: string, id: string) {
    const { count } = await this.prisma.quiz.deleteMany({
      where: { id, userId },
    });
    if (count === 0) throw new NotFoundException(NOT_FOUND);
  }

  /** Grava uma tentativa e atualiza o estado de cada pergunta (so do dono). */
  submitAttempt(userId: string, id: string, dto: SubmitAttemptDto) {
    return this.prisma.$transaction(async (tx) => {
      // Tranca a linha do quiz ate ao fim: duas tentativas ao mesmo tempo
      // leem e gravam as estatisticas uma depois da outra (nenhuma se perde).
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "Quiz" WHERE "id" = ${id} AND "userId" = ${userId} FOR UPDATE`;
      if (locked.length === 0) throw new NotFoundException(NOT_FOUND);
      const quiz = await tx.quiz.findFirst({
        where: { id, userId },
        select: { questions: true, stats: true },
      });
      if (!quiz) throw new NotFoundException(NOT_FOUND);

      const known = questionIds(quiz.questions);
      const seen = new Set<string>();
      const results = dto.results.filter((r) => {
        if (!known.has(r.questionId) || seen.has(r.questionId)) return false;
        seen.add(r.questionId);
        return true;
      });
      if (results.length === 0) {
        throw new BadRequestException('No answers for this quiz.');
      }

      const stats = readStats(quiz.stats);
      results.forEach(({ questionId, correct }) => {
        const prev = Object.hasOwn(stats, questionId)
          ? stats[questionId]
          : { seen: 0, correct: 0, last: false };
        stats[questionId] = {
          seen: prev.seen + 1,
          correct: prev.correct + (correct ? 1 : 0),
          last: correct,
        };
      });
      const correct = results.filter((r) => r.correct).length;
      const lastScorePct = Math.round((correct / results.length) * PERCENT);
      // Planeadas: nunca menos que as respondidas nem mais que as do quiz.
      const planned = Math.min(
        Math.max(dto.planned ?? 0, results.length),
        known.size,
      );

      const old = await tx.quizAttempt.findMany({
        where: { quizId: id, userId },
        orderBy: { finishedAt: 'desc' },
        skip: QUIZ_ATTEMPTS_KEPT - 1,
        select: { id: true },
      });
      const attempt = await tx.quizAttempt.create({
        data: {
          quizId: id,
          userId,
          mode: dto.mode,
          total: results.length,
          correct,
          durationMs: dto.durationMs,
          planned,
        },
        select: ATTEMPT,
      });
      await tx.quiz.update({
        where: { id },
        data: {
          stats: { ...stats } as unknown as Prisma.InputJsonValue,
          lastScorePct,
        },
      });
      await tx.quizAttempt.deleteMany({
        where: { id: { in: old.map((a) => a.id) }, userId },
      });
      return { attempt, stats, lastScorePct };
    });
  }
}
