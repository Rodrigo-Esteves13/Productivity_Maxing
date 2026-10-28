import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FeedbackResolution, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { ReplyFeedbackDto } from './dto/moderate-feedback.dto';

// Igual a FEEDBACK_LIST_LIMIT no frontend (feedbackService.ts, E-14).
export const FEEDBACK_LIST_LIMIT = 300;
export const MY_FEEDBACK_LIMIT = 100;
// Onde o autor le as respostas (link do aviso push).
export const MY_FEEDBACK_PATH = '/my-feedback';
// Titulo do aviso: inicio da mensagem original, para o autor saber qual foi.
const PUSH_TITLE_PREVIEW_LENGTH = 60;

const ADMIN_SELECT = {
  id: true,
  category: true,
  rating: true,
  message: true,
  language: true,
  page: true,
  createdAt: true,
  isResolved: true,
  resolution: true,
  adminReply: true,
  repliedAt: true,
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      feedbackMutedAt: true,
    },
  },
} satisfies Prisma.FeedbackSelect;

// O autor so ve o seu proprio feedback e a resposta, nada sobre quem moderou.
const OWN_SELECT = {
  id: true,
  category: true,
  message: true,
  createdAt: true,
  isResolved: true,
  resolution: true,
  adminReply: true,
  repliedAt: true,
} satisfies Prisma.FeedbackSelect;

type FeedbackPushKey = 'feedbackReplied' | 'feedbackRejected';

@Injectable()
export class FeedbackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
  ) {}

  async create(userId: string, dto: CreateFeedbackDto) {
    const author = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { feedbackMutedAt: true },
    });
    if (author?.feedbackMutedAt) {
      throw new ForbiddenException('You cannot send feedback right now.');
    }
    // Só a parte do caminho (sem query string nem fragmento): nunca guardar
    // tokens/ids que apareçam no URL.
    const page = dto.page ? dto.page.split(/[?#]/)[0].slice(0, 200) : null;
    const created = await this.prisma.feedback.create({
      data: {
        userId,
        category: dto.category,
        rating: dto.rating ?? null,
        message: dto.message.trim(),
        language: (dto.language ?? 'en').slice(0, 10),
        page,
      },
      select: { id: true },
    });
    return { id: created.id };
  }

  /** O que o proprio enviou, com as respostas do admin. */
  listMine(userId: string) {
    return this.prisma.feedback.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: MY_FEEDBACK_LIMIT,
      select: OWN_SELECT,
    });
  }

  /** Admin: mais recentes primeiro; por resolver antes. */
  list() {
    // Limite fixo; o frontend avisa quando a lista chega a ele (E-14).
    return this.prisma.feedback.findMany({
      orderBy: [{ isResolved: 'asc' }, { createdAt: 'desc' }],
      take: FEEDBACK_LIST_LIMIT,
      select: ADMIN_SELECT,
    });
  }

  setResolved(id: string, isResolved: boolean) {
    return this.update(id, {
      isResolved,
      resolution: isResolved ? FeedbackResolution.DONE : null,
    });
  }

  async reply(id: string, dto: ReplyFeedbackDto) {
    const data: Prisma.FeedbackUpdateInput = {
      adminReply: dto.message.trim(),
      repliedAt: new Date(),
    };
    if (dto.resolve) {
      data.isResolved = true;
      data.resolution = FeedbackResolution.DONE;
    }
    const updated = await this.update(id, data);
    this.notifyAuthor(updated, 'feedbackReplied');
    return updated;
  }

  async reject(id: string, reason?: string) {
    const trimmed = reason?.trim();
    const updated = await this.update(id, {
      isResolved: true,
      resolution: FeedbackResolution.REJECTED,
      ...(trimmed ? { adminReply: trimmed, repliedAt: new Date() } : {}),
    });
    this.notifyAuthor(updated, 'feedbackRejected');
    return updated;
  }

  /** Impede (ou volta a permitir) um user de enviar feedback. */
  async setMuted(userId: string, muted: boolean) {
    const result = await this.prisma.user.updateMany({
      where: { id: userId },
      data: { feedbackMutedAt: muted ? new Date() : null },
    });
    if (result.count === 0) throw new NotFoundException('User not found.');
    return { userId, muted };
  }

  private async update(id: string, data: Prisma.FeedbackUpdateInput) {
    try {
      return await this.prisma.feedback.update({
        where: { id },
        data,
        select: ADMIN_SELECT,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('Feedback not found.');
      }
      throw error;
    }
  }

  // Sem autor (conta apagada) nao ha a quem avisar. Um push falhado nunca
  // parte a moderacao (notifyUser ja engole erros).
  private notifyAuthor(
    feedback: { message: string; user: { id: string } | null },
    key: FeedbackPushKey,
  ) {
    if (!feedback.user) return;
    void this.push.notifyUser(feedback.user.id, key, {
      title: feedback.message.slice(0, PUSH_TITLE_PREVIEW_LENGTH),
      url: MY_FEEDBACK_PATH,
    });
  }
}
