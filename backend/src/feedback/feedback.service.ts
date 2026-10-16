import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';

@Injectable()
export class FeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateFeedbackDto) {
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

  /** Admin: mais recentes primeiro; por resolver antes. */
  list() {
    return this.prisma.feedback.findMany({
      orderBy: [{ isResolved: 'asc' }, { createdAt: 'desc' }],
      take: 300,
      select: {
        id: true,
        category: true,
        rating: true,
        message: true,
        language: true,
        page: true,
        createdAt: true,
        isResolved: true,
        user: { select: { name: true } },
      },
    });
  }

  async setResolved(id: string, isResolved: boolean) {
    const result = await this.prisma.feedback.updateMany({
      where: { id },
      data: { isResolved },
    });
    if (result.count === 0) throw new NotFoundException('Feedback not found.');
    return { id, isResolved };
  }
}
