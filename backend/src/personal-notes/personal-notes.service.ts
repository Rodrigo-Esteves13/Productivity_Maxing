import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import {
  CreatePersonalNoteDto,
  UpdatePersonalNoteDto,
} from './dto/personal-note.dto';
import {
  MAX_PERSONAL_NOTES_PER_USER,
  MAX_PERSONAL_REMINDERS_PER_RUN,
  MAX_REMINDER_AHEAD_MS,
  PERSONAL_NOTES_PATH,
  PERSONAL_REMINDER_LATE_WINDOW_MS,
} from './personal-notes.constants';

const NOTE_SELECT = {
  id: true,
  title: true,
  body: true,
  pinned: true,
  remindAt: true,
  remindedAt: true,
  doneAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PersonalNoteSelect;

// Notas soltas do proprio, com lembrete opcional (push a propria pessoa).
@Injectable()
export class PersonalNotesService {
  private readonly logger = new Logger(PersonalNotesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
  ) {}

  list(userId: string) {
    // Por fazer primeiro; dentro disso afixadas e as mais recentes.
    return this.prisma.personalNote.findMany({
      where: { userId },
      orderBy: [
        { doneAt: { sort: 'desc', nulls: 'first' } },
        { pinned: 'desc' },
        { updatedAt: 'desc' },
      ],
      take: MAX_PERSONAL_NOTES_PER_USER,
      select: NOTE_SELECT,
    });
  }

  async create(userId: string, dto: CreatePersonalNoteDto) {
    const count = await this.prisma.personalNote.count({ where: { userId } });
    if (count >= MAX_PERSONAL_NOTES_PER_USER) {
      throw new BadRequestException(
        `You can keep at most ${MAX_PERSONAL_NOTES_PER_USER} notes.`,
      );
    }
    return this.prisma.personalNote.create({
      data: {
        userId,
        title: dto.title,
        body: dto.body ?? '',
        pinned: dto.pinned ?? false,
        remindAt: this.parseRemindAt(dto.remindAt),
      },
      select: NOTE_SELECT,
    });
  }

  async update(userId: string, id: string, dto: UpdatePersonalNoteDto) {
    const data: Prisma.PersonalNoteUpdateManyMutationInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.body !== undefined) data.body = dto.body;
    if (dto.pinned !== undefined) data.pinned = dto.pinned;
    if (dto.done !== undefined) data.doneAt = dto.done ? new Date() : null;
    if (dto.remindAt !== undefined) {
      data.remindAt = this.parseRemindAt(dto.remindAt);
      // Hora nova: volta a poder avisar.
      data.remindedAt = null;
    }
    const { count } = await this.prisma.personalNote.updateMany({
      where: { id, userId },
      data,
    });
    if (count === 0) throw new NotFoundException('Note not found.');
    return this.prisma.personalNote.findFirstOrThrow({
      where: { id, userId },
      select: NOTE_SELECT,
    });
  }

  async remove(userId: string, id: string) {
    const { count } = await this.prisma.personalNote.deleteMany({
      where: { id, userId },
    });
    if (count === 0) throw new NotFoundException('Note not found.');
  }

  /**
   * Chamado pelo cron dos lembretes. Um push por nota com hora vencida (ate
   * um dia de atraso). So marca como avisada quando algum dispositivo
   * recebeu; sem push, a pagina das notas mostra-a como vencida.
   */
  async sendDueReminders(now = new Date()): Promise<number> {
    const due = await this.prisma.personalNote.findMany({
      where: {
        remindAt: {
          lte: now,
          gte: new Date(now.getTime() - PERSONAL_REMINDER_LATE_WINDOW_MS),
        },
        remindedAt: null,
        doneAt: null,
      },
      orderBy: { remindAt: 'asc' },
      take: MAX_PERSONAL_REMINDERS_PER_RUN,
      select: { id: true, userId: true, title: true },
    });

    let sent = 0;
    for (const note of due) {
      const delivered = await this.push.notifyUser(
        note.userId,
        'selfReminder',
        {
          title: note.title,
          url: PERSONAL_NOTES_PATH,
        },
      );
      if (delivered === 0) continue;
      await this.prisma.personalNote.updateMany({
        where: { id: note.id, remindedAt: null },
        data: { remindedAt: now },
      });
      sent += 1;
    }
    if (sent > 0) this.logger.log(`Lembretes pessoais enviados: ${sent}`);
    return sent;
  }

  private parseRemindAt(value: string | null | undefined): Date | null {
    if (!value) return null;
    const at = new Date(value);
    if (Number.isNaN(at.getTime())) {
      throw new BadRequestException('remindAt must be a valid date.');
    }
    if (at.getTime() - Date.now() > MAX_REMINDER_AHEAD_MS) {
      throw new BadRequestException('remindAt is too far in the future.');
    }
    return at;
  }
}
