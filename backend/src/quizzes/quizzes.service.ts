import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { assertAreaAccessible } from '../areas/area-access';
import {
  canonicalQuizText,
  recheckCanonicalQuiz,
  sanitizeQuizText,
} from './quiz-check';
import { genStatKey, normalizeGenerators } from './quiz-generators';
import { sanitizeQuizDiagram, type QuizDiagram } from './quiz-diagram';
import { QUIZ_TITLE_MAX, type Quiz } from './quiz-format';
import { ImportQuizDto, SubmitAttemptDto, UpdateQuizDto } from './dto/quiz.dto';
import {
  MAX_QUIZZES_PER_USER,
  QUIZ_ATTEMPTS_KEPT,
  QUIZ_QUESTION_ID,
} from './quizzes.constants';

export interface QuestionStat {
  seen: number;
  correct: number;
  last: boolean;
  // Tempo ativo acumulado (ms) e quantas respostas trouxeram tempo.
  timeMs: number;
  timed: number;
  // Relogio do servidor (epoch ms); 0 = nunca.
  lastAt: number;
  wrongAt: number;
  // Tirada da lista de erradas pelo utilizador (volta a false ao errar).
  dismissed: boolean;
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

// Quem partilhou a copia (so o nome, nunca o email) e se o quiz tem partilha ativa.
const SHARE_INFO = {
  sharedBy: { select: { name: true } },
  share: { select: { id: true } },
} satisfies Prisma.QuizSelect;

function withShareInfo<
  T extends {
    sharedBy?: { name: string | null } | null;
    share?: { id: string } | null;
  },
>(row: T) {
  const { sharedBy, share, ...rest } = row;
  return {
    ...rest,
    sharedBy: sharedBy ? { name: sharedBy.name ?? '' } : null,
    isShared: Boolean(share),
  };
}

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
const TASK_NOT_FOUND = `Task not found or you don't have access.`;
// Mensagem unica para qualquer recusa do import: nao diz o que falhou.
const IMPORT_REFUSED = 'This quiz did not pass the checks.';
// Chaves que nunca passam para um objeto devolvido (poluicao de prototipos),
// nem nomes herdados de Object.prototype ("toString", "valueOf"...).
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const isReservedKey = (key: string): boolean =>
  FORBIDDEN_KEYS.has(key) || key in Object.prototype;

// Numero guardado lido sem confiar na BD: inteiro seguro >= 0, senao 0.
const safeCount = (v: unknown): number =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 ? v : 0;

const EMPTY_STAT: QuestionStat = {
  seen: 0,
  correct: 0,
  last: false,
  timeMs: 0,
  timed: 0,
  lastAt: 0,
  wrongAt: 0,
  dismissed: false,
};

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
        seen: safeCount(s.seen),
        correct: safeCount(s.correct),
        last: s.last === true,
        timeMs: safeCount(s.timeMs),
        timed: safeCount(s.timed),
        lastAt: safeCount(s.lastAt),
        wrongAt: safeCount(s.wrongAt),
        dismissed: s.dismissed === true,
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

  async list(userId: string) {
    const rows = await this.prisma.quiz.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: MAX_QUIZZES_PER_USER,
      select: { ...SUMMARY, ...SHARE_INFO },
    });
    return rows.map(withShareInfo);
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
        generators: true,
        stats: true,
        ...SHARE_INFO,
        areaId: true,
        taskId: true,
        area: { select: { id: true, name: true } },
        task: { select: { id: true, title: true } },
        attempts: {
          orderBy: { finishedAt: 'desc' },
          take: QUIZ_ATTEMPTS_KEPT,
          select: ATTEMPT,
        },
      },
    });
    if (!quiz) throw new NotFoundException(NOT_FOUND);
    return {
      ...withShareInfo(quiz),
      figures: readFigures(quiz.figures),
      generators: normalizeGenerators(quiz.generators),
      stats: readStats(quiz.stats),
      areaId: quiz.areaId ?? null,
      taskId: quiz.taskId ?? null,
      area: quiz.area ?? null,
      task: quiz.task ?? null,
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
    if (
      dto.title === undefined &&
      dto.generators === undefined &&
      dto.areaId === undefined &&
      dto.taskId === undefined
    ) {
      throw new BadRequestException('Nothing to update.');
    }
    const data: Prisma.QuizUpdateManyMutationInput = {};
    if (dto.title !== undefined) {
      const title = sanitizeQuizText(
        dto.title,
        QUIZ_TITLE_MAX,
        undefined,
        false,
      );
      if (!title) throw new BadRequestException('The title cannot be empty.');
      data.title = title;
    }
    if (dto.generators !== undefined) {
      data.generators = normalizeGenerators(dto.generators);
    }
    await this.applyLinks(userId, dto, data);
    const { count } = await this.prisma.quiz.updateMany({
      where: { id, userId },
      data,
    });
    if (count === 0) throw new NotFoundException(NOT_FOUND);
    return { id, ...data };
  }

  /**
   * Valida e junta areaId/taskId ao update. Mesma regra das sessoes de estudo
   * (StudySessionsService.start): Area oficial ou propria (assertAreaAccessible)
   * e Task do proprio user; 404 se nao. Task sem areaId no pedido herda a Area
   * da task; areaId null desliga tambem a task.
   */
  private async applyLinks(
    userId: string,
    dto: UpdateQuizDto,
    data: Prisma.QuizUpdateManyMutationInput & {
      areaId?: string | null;
      taskId?: string | null;
    },
  ) {
    if (dto.taskId) {
      const task = await this.prisma.task.findFirst({
        where: { id: dto.taskId, userId },
        select: { id: true, areaId: true },
      });
      if (!task) throw new NotFoundException(TASK_NOT_FOUND);
      data.taskId = task.id;
      if (dto.areaId === undefined) data.areaId = task.areaId;
    } else if (dto.taskId === null) {
      data.taskId = null;
    }
    if (dto.areaId) {
      await assertAreaAccessible(this.prisma, userId, dto.areaId);
      data.areaId = dto.areaId;
    } else if (dto.areaId === null) {
      data.areaId = null;
      data.taskId = null;
    }
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
        select: { questions: true, generators: true, stats: true },
      });
      if (!quiz) throw new NotFoundException(NOT_FOUND);

      const known = questionIds(quiz.questions);
      // Chaves gen-<tipo> dos geradores ligados: podem repetir (cada uma conta).
      const genKeys = new Set(
        normalizeGenerators(quiz.generators).map(genStatKey),
      );
      const seen = new Set<string>();
      const results = dto.results.filter((r) => {
        if (genKeys.has(r.questionId)) return true;
        if (!known.has(r.questionId) || seen.has(r.questionId)) return false;
        seen.add(r.questionId);
        return true;
      });
      if (results.length === 0) {
        throw new BadRequestException('No answers for this quiz.');
      }

      const stats = readStats(quiz.stats);
      const now = Date.now();
      results.forEach(({ questionId, correct, timeMs }) => {
        const prev = Object.hasOwn(stats, questionId)
          ? stats[questionId]
          : EMPTY_STAT;
        stats[questionId] = {
          seen: prev.seen + 1,
          correct: prev.correct + (correct ? 1 : 0),
          last: correct,
          timeMs: prev.timeMs + (timeMs ?? 0),
          timed: prev.timed + (timeMs === undefined ? 0 : 1),
          lastAt: now,
          wrongAt: correct ? prev.wrongAt : now,
          dismissed: correct ? prev.dismissed : false,
        };
      });
      const correct = results.filter((r) => r.correct).length;
      const lastScorePct = Math.round((correct / results.length) * PERCENT);
      // Planeadas: nunca menos que as respondidas nem mais que as do quiz.
      const planned = Math.min(
        Math.max(dto.planned ?? 0, results.length),
        Math.max(known.size, results.length),
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

  /**
   * Corre uma escrita com a linha do quiz trancada (so do dono): leituras e
   * gravacoes das estatisticas ficam em serie, como em submitAttempt.
   */
  private lockedWrite(
    userId: string,
    id: string,
    run: (
      tx: Prisma.TransactionClient,
      quiz: { stats: Prisma.JsonValue },
    ) => Promise<void>,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "Quiz" WHERE "id" = ${id} AND "userId" = ${userId} FOR UPDATE`;
      if (locked.length === 0) throw new NotFoundException(NOT_FOUND);
      const quiz = await tx.quiz.findFirst({
        where: { id, userId },
        select: { stats: true },
      });
      if (!quiz) throw new NotFoundException(NOT_FOUND);
      await run(tx, quiz);
    });
  }

  private async saveStats(
    tx: Prisma.TransactionClient,
    id: string,
    stats: QuizStats,
  ) {
    await tx.quiz.update({
      where: { id },
      data: { stats: { ...stats } as unknown as Prisma.InputJsonValue },
    });
  }

  /** Apaga o historico de tentativas do quiz e a ultima nota. */
  clearAttempts(userId: string, id: string) {
    return this.lockedWrite(userId, id, async (tx) => {
      await tx.quizAttempt.deleteMany({ where: { quizId: id, userId } });
      await tx.quiz.update({ where: { id }, data: { lastScorePct: null } });
    });
  }

  /**
   * Apaga uma tentativa; a ultima nota passa a ser a da mais recente que
   * sobra. As estatisticas por pergunta sao agregadas (a tentativa nao guarda
   * as respostas), por isso ficam como estao.
   */
  removeAttempt(userId: string, id: string, attemptId: string) {
    return this.lockedWrite(userId, id, async (tx) => {
      const { count } = await tx.quizAttempt.deleteMany({
        where: { id: attemptId, quizId: id, userId },
      });
      if (count === 0) throw new NotFoundException('Attempt not found.');
      const latest = await tx.quizAttempt.findFirst({
        where: { quizId: id, userId },
        orderBy: { finishedAt: 'desc' },
        select: { total: true, correct: true },
      });
      const lastScorePct = latest?.total
        ? Math.round((latest.correct / latest.total) * PERCENT)
        : null;
      await tx.quiz.update({ where: { id }, data: { lastScorePct } });
    });
  }

  /** Poe as estatisticas por pergunta a zero. */
  clearStats(userId: string, id: string) {
    return this.lockedWrite(userId, id, async (tx) => {
      await this.saveStats(tx, id, Object.create(null) as QuizStats);
    });
  }

  /** Tira da lista de erradas todas as perguntas (last === false). */
  dismissWrong(userId: string, id: string) {
    return this.lockedWrite(userId, id, async (tx, quiz) => {
      const stats = readStats(quiz.stats);
      Object.values(stats).forEach((s) => {
        if (!s.last) s.dismissed = true;
      });
      await this.saveStats(tx, id, stats);
    });
  }

  /** Tira uma pergunta da lista de erradas; id invalido = 400, desconhecido = 404. */
  dismissWrongOne(userId: string, id: string, questionId: string) {
    if (!QUIZ_QUESTION_ID.test(questionId)) {
      throw new BadRequestException('Invalid question id.');
    }
    return this.lockedWrite(userId, id, async (tx, quiz) => {
      const stats = readStats(quiz.stats);
      if (isReservedKey(questionId) || !Object.hasOwn(stats, questionId)) {
        throw new NotFoundException('Question not found.');
      }
      stats[questionId].dismissed = true;
      await this.saveStats(tx, id, stats);
    });
  }
}
