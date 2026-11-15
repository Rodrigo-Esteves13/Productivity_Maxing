import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { areFriends } from '../social/friendship.util';
import { normalizeGenerators } from './quiz-generators';
import { MAX_QUIZZES_PER_USER, QUIZ_SHARE_LIST_MAX } from './quizzes.constants';

const NOT_FOUND = 'Quiz not found.';
const SHARE_NOT_FOUND = 'Shared quiz not found.';
const COPY_NOT_SHAREABLE = 'Only the author can share this quiz.';

export interface QuizShareRecipientView {
  id: string;
  userId: string;
  name: string;
  addedAt: string | null;
  createdAt: string;
}

export interface QuizShareStatus {
  token: string | null;
  copyCount: number;
  createdAt: string | null;
  recipients: QuizShareRecipientView[];
}

export interface QuizSharePreview {
  title: string;
  ownerName: string;
  questionCount: number;
  topics: string[];
  language: string;
  generatorCount: number;
  isOwner: boolean;
  addedQuizId: string | null;
}

export interface QuizSharedWithMeItem {
  token: string;
  title: string;
  ownerName: string;
  questionCount: number;
  topics: string[];
  sharedAt: string;
  addedQuizId: string | null;
}

export interface MyQuizShareItem {
  quizId: string;
  title: string;
  token: string;
  copyCount: number;
  recipientCount: number;
  createdAt: string;
}

// Estado da partilha visto pelo dono. So o nome de cada destinatario sai,
// nunca o email.
const STATUS_SELECT = {
  token: true,
  copyCount: true,
  createdAt: true,
  recipients: {
    orderBy: { createdAt: 'desc' },
    take: QUIZ_SHARE_LIST_MAX,
    select: {
      id: true,
      userId: true,
      addedAt: true,
      createdAt: true,
      user: { select: { name: true } },
    },
  },
} satisfies Prisma.QuizShareSelect;

type StatusRow = Prisma.QuizShareGetPayload<{ select: typeof STATUS_SELECT }>;

const EMPTY_STATUS: QuizShareStatus = {
  token: null,
  copyCount: 0,
  createdAt: null,
  recipients: [],
};

function toStatus(share: StatusRow | null): QuizShareStatus {
  if (!share) return { ...EMPTY_STATUS, recipients: [] };
  return {
    token: share.token,
    copyCount: share.copyCount,
    createdAt: share.createdAt.toISOString(),
    recipients: share.recipients.map((r) => ({
      id: r.id,
      userId: r.userId,
      name: r.user.name ?? '',
      addedAt: r.addedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

/**
 * Partilha de quizzes so dentro da app: o dono gera um link (token UUID do
 * servidor) e/ou manda-o a amigos. Quem o abre tem de ter sessao e recebe uma
 * COPIA no proprio perfil; as perguntas nunca saem por aqui (nem no preview).
 */
@Injectable()
export class QuizShareService {
  constructor(private readonly prisma: PrismaService) {}

  // Quiz do proprio user (404 para os outros), com o que a partilha precisa.
  private async ownedQuiz(userId: string, quizId: string) {
    const quiz = await this.prisma.quiz.findFirst({
      where: { id: quizId, userId },
      select: {
        id: true,
        sharedById: true,
        sourceQuizId: true,
        share: { select: { id: true } },
      },
    });
    if (!quiz) throw new NotFoundException(NOT_FOUND);
    return quiz;
  }

  private async readStatus(quizId: string): Promise<QuizShareStatus> {
    const share = await this.prisma.quizShare.findUnique({
      where: { quizId },
      select: STATUS_SELECT,
    });
    return toStatus(share);
  }

  /** Estado da partilha de um quiz meu (token null = nao partilhado). */
  async status(userId: string, quizId: string): Promise<QuizShareStatus> {
    await this.ownedQuiz(userId, quizId);
    return this.readStatus(quizId);
  }

  /**
   * Cria a partilha se ainda nao existir. Uma copia recebida nunca se
   * partilha: so o autor decide quem fica com o quiz dele.
   */
  async enable(userId: string, quizId: string): Promise<QuizShareStatus> {
    await this.ensureShare(userId, quizId);
    return this.readStatus(quizId);
  }

  private async ensureShare(userId: string, quizId: string): Promise<string> {
    const quiz = await this.ownedQuiz(userId, quizId);
    if (quiz.sharedById !== null || quiz.sourceQuizId !== null) {
      throw new ForbiddenException(COPY_NOT_SHAREABLE);
    }
    if (quiz.share) return quiz.share.id;
    // upsert: dois pedidos ao mesmo tempo nao criam duas partilhas.
    const share = await this.prisma.quizShare.upsert({
      where: { quizId },
      create: { quizId },
      update: {},
      select: { id: true },
    });
    return share.id;
  }

  /** Desliga a partilha (o link deixa de abrir); as copias ja feitas ficam. */
  async revoke(userId: string, quizId: string): Promise<void> {
    await this.ownedQuiz(userId, quizId);
    await this.prisma.quizShare.deleteMany({
      where: { quizId, quiz: { userId } },
    });
  }

  /** Manda o quiz a um amigo (amizade aceite). Idempotente. */
  async addFriend(
    userId: string,
    quizId: string,
    friendId: string,
  ): Promise<QuizShareStatus> {
    await this.ownedQuiz(userId, quizId);
    if (friendId === userId) {
      throw new BadRequestException('You cannot share a quiz with yourself.');
    }
    if (!(await areFriends(this.prisma, userId, friendId))) {
      throw new ForbiddenException('You can only share quizzes with friends.');
    }
    const shareId = await this.ensureShare(userId, quizId);
    await this.prisma.quizShareRecipient.upsert({
      where: { shareId_userId: { shareId, userId: friendId } },
      create: { shareId, userId: friendId },
      update: {},
      select: { id: true },
    });
    return this.readStatus(quizId);
  }

  /** Tira um amigo da lista (a copia que ele ja tenha fica com ele). */
  async removeFriend(
    userId: string,
    quizId: string,
    recipientId: string,
  ): Promise<void> {
    await this.ownedQuiz(userId, quizId);
    const { count } = await this.prisma.quizShareRecipient.deleteMany({
      where: { id: recipientId, share: { quizId, quiz: { userId } } },
    });
    if (count === 0) throw new NotFoundException('Recipient not found.');
  }

  /** Quizzes meus com partilha ativa, mais recentes primeiro. */
  async mine(userId: string): Promise<MyQuizShareItem[]> {
    const rows = await this.prisma.quizShare.findMany({
      where: { quiz: { userId } },
      orderBy: { createdAt: 'desc' },
      take: QUIZ_SHARE_LIST_MAX,
      select: {
        quizId: true,
        token: true,
        copyCount: true,
        createdAt: true,
        quiz: { select: { title: true } },
        _count: { select: { recipients: true } },
      },
    });
    return rows.map((r) => ({
      quizId: r.quizId,
      title: r.quiz.title,
      token: r.token,
      copyCount: r.copyCount,
      recipientCount: r._count.recipients,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  // Copia minha de um quiz de origem (se ainda existir).
  private async myCopies(userId: string, sourceIds: string[]) {
    if (sourceIds.length === 0) return new Map<string, string>();
    const copies = await this.prisma.quiz.findMany({
      where: { userId, sourceQuizId: { in: sourceIds } },
      select: { id: true, sourceQuizId: true },
    });
    const out = new Map<string, string>();
    copies.forEach((c) => {
      if (c.sourceQuizId && !out.has(c.sourceQuizId)) {
        out.set(c.sourceQuizId, c.id);
      }
    });
    return out;
  }

  /** Quizzes que amigos me mandaram, mais recentes primeiro. */
  async sharedWithMe(userId: string): Promise<QuizSharedWithMeItem[]> {
    const rows = await this.prisma.quizShareRecipient.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: QUIZ_SHARE_LIST_MAX,
      select: {
        createdAt: true,
        share: {
          select: {
            token: true,
            quizId: true,
            quiz: {
              select: {
                title: true,
                questionCount: true,
                topics: true,
                user: { select: { name: true } },
              },
            },
          },
        },
      },
    });
    const copies = await this.myCopies(
      userId,
      rows.map((r) => r.share.quizId),
    );
    return rows.map((r) => ({
      token: r.share.token,
      title: r.share.quiz.title,
      ownerName: r.share.quiz.user.name ?? '',
      questionCount: r.share.quiz.questionCount,
      topics: r.share.quiz.topics,
      sharedAt: r.createdAt.toISOString(),
      addedQuizId: copies.get(r.share.quizId) ?? null,
    }));
  }

  /**
   * Resumo de um quiz partilhado para decidir se se adiciona. Nunca devolve
   * perguntas, respostas nem figuras: so titulo, dono e contagens.
   */
  async preview(userId: string, token: string): Promise<QuizSharePreview> {
    const share = await this.prisma.quizShare.findUnique({
      where: { token },
      select: {
        quiz: {
          select: {
            id: true,
            userId: true,
            title: true,
            questionCount: true,
            topics: true,
            language: true,
            generators: true,
            user: { select: { name: true } },
          },
        },
      },
    });
    if (!share) throw new NotFoundException(SHARE_NOT_FOUND);
    const { quiz } = share;
    const isOwner = quiz.userId === userId;
    const addedQuizId = isOwner
      ? quiz.id
      : ((await this.myCopies(userId, [quiz.id])).get(quiz.id) ?? null);
    return {
      title: quiz.title,
      ownerName: quiz.user.name ?? '',
      questionCount: quiz.questionCount,
      topics: quiz.topics,
      language: quiz.language,
      generatorCount: normalizeGenerators(quiz.generators).length,
      isOwner,
      addedQuizId,
    };
  }

  /**
   * Cria (uma vez) a copia do quiz partilhado no perfil de quem pede. O dono
   * recebe o proprio id; quem ja tem copia recebe-a de volta sem contar outra.
   * A copia leva perguntas, figuras e geradores, mas nunca estatisticas,
   * tentativas nem ligacoes a cadeira/task do dono.
   */
  add(userId: string, token: string): Promise<{ id: string }> {
    return this.prisma.$transaction(async (tx) => {
      const share = await tx.quizShare.findUnique({
        where: { token },
        select: { id: true, quizId: true, quiz: { select: { userId: true } } },
      });
      if (!share) throw new NotFoundException(SHARE_NOT_FOUND);
      if (share.quiz.userId === userId) return { id: share.quizId };

      // Tranca a linha do utilizador (como no import): pedidos em paralelo
      // esperam aqui, por isso nunca nascem duas copias nem se passa o limite.
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR NO KEY UPDATE`;
      const existing = await tx.quiz.findFirst({
        where: { userId, sourceQuizId: share.quizId },
        select: { id: true },
      });
      if (existing) return { id: existing.id };

      const count = await tx.quiz.count({ where: { userId } });
      if (count >= MAX_QUIZZES_PER_USER) {
        throw new BadRequestException(
          `You can keep at most ${MAX_QUIZZES_PER_USER} quizzes.`,
        );
      }
      const source = await tx.quiz.findUnique({
        where: { id: share.quizId },
        select: {
          userId: true,
          title: true,
          language: true,
          secondsPerQuestion: true,
          topics: true,
          questions: true,
          figures: true,
          generators: true,
          questionCount: true,
        },
      });
      if (!source) throw new NotFoundException(SHARE_NOT_FOUND);
      const copy = await tx.quiz.create({
        data: {
          userId,
          title: source.title,
          language: source.language,
          secondsPerQuestion: source.secondsPerQuestion,
          topics: source.topics,
          questions: source.questions as Prisma.InputJsonValue,
          figures: source.figures ?? {},
          generators: normalizeGenerators(source.generators),
          questionCount: source.questionCount,
          sharedById: source.userId,
          sourceQuizId: share.quizId,
        },
        select: { id: true },
      });
      await tx.quizShare.update({
        where: { id: share.id },
        data: { copyCount: { increment: 1 } },
      });
      await tx.quizShareRecipient.updateMany({
        where: { shareId: share.id, userId, addedAt: null },
        data: { addedAt: new Date() },
      });
      return { id: copy.id };
    });
  }
}
