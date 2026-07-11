import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StartStudySessionDto } from './dto/start-study-session.dto';
import { StopStudySessionDto } from './dto/stop-study-session.dto';

const SESSION_SELECT = {
  id: true,
  startedAt: true,
  endedAt: true,
  note: true,
  taskId: true,
  areaId: true,
  task: { select: { id: true, title: true } },
  area: { select: { id: true, name: true, colorHex: true } },
} satisfies Prisma.StudySessionSelect;

type SessionWithRelations = Prisma.StudySessionGetPayload<{
  select: typeof SESSION_SELECT;
}>;

// Uma célula da grelha do heatmap: dia da semana (0=Domingo..6=Sábado) x
// bloco de 4h do dia (0=00h-04h, 1=04h-08h, ..., 5=20h-24h). Um grid 7x6
// em vez de 7x24 - com o volume de dados de um único utilizador, um
// heatmap por hora exata ficaria demasiado esparso para ser legível;
// blocos de 4h já mostram um padrão útil ("estudo melhor à tarde").
const HOUR_BUCKET_SIZE = 4;
const HOUR_BUCKET_COUNT = 24 / HOUR_BUCKET_SIZE;

export interface HeatmapCell {
  dayOfWeek: number; // 0-6
  hourBucket: number; // 0-5
  totalMinutes: number;
  sessionCount: number;
}

export interface TaskPriorityRow {
  id: string;
  title: string;
  date: string;
  difficulty: string;
  weightPercentage: number | null;
  areaName: string;
}

@Injectable()
export class StudySessionsService {
  constructor(private readonly prisma: PrismaService) {}

  async start(userId: string, dto: StartStudySessionDto) {
    // Só uma sessão ativa de cada vez por utilizador - evita sobreposições
    // que corromperiam o heatmap e o histórico (ex: começar 2 sessões em
    // 2 separadores e só parar uma).
    const active = await this.prisma.studySession.findFirst({
      where: { userId, endedAt: null },
      select: { id: true },
    });
    if (active) {
      throw new ConflictException(
        'You already have an active study session. Stop it before starting another one.',
      );
    }

    if (dto.taskId) {
      await this.assertTaskOwnership(userId, dto.taskId);
    }
    if (dto.areaId) {
      await this.assertAreaExists(dto.areaId);
    }

    const session = await this.prisma.studySession.create({
      data: {
        userId,
        taskId: dto.taskId ?? null,
        areaId: dto.areaId ?? null,
        note: dto.note ?? null,
      },
      select: SESSION_SELECT,
    });

    return this.toResponse(session);
  }

  async stop(userId: string, id: string, dto: StopStudySessionDto) {
    // where: { id, userId } - não confiar só num findFirst() prévio (defesa
    // em profundidade contra IDOR, mesmo pouco provável aqui já que
    // validamos posse antes).
    const existing = await this.prisma.studySession.findFirst({
      where: { id, userId },
      select: { id: true, endedAt: true },
    });
    if (!existing) {
      throw new NotFoundException(
        `Study session not found or you don't have access.`,
      );
    }
    if (existing.endedAt) {
      throw new ConflictException('This session has already been stopped.');
    }

    const session = await this.prisma.studySession.update({
      where: { id, userId },
      data: {
        endedAt: new Date(),
        ...(dto.note !== undefined ? { note: dto.note } : {}),
      },
      select: SESSION_SELECT,
    });

    return this.toResponse(session);
  }

  async getActive(userId: string) {
    const session = await this.prisma.studySession.findFirst({
      where: { userId, endedAt: null },
      select: SESSION_SELECT,
    });
    return session ? this.toResponse(session) : null;
  }

  /**
   * Agrega TODAS as sessões terminadas do utilizador num grid 7 (dia da
   * semana) x 6 (bloco de 4h). Feito em memória (não em SQL bruto) de
   * propósito: para o volume esperado (uma pessoa, meses de uso) isto é
   * perfeitamente rápido, e evita escrever SQL manual só para um dashboard.
   * Se um dia isto crescer muito, é o primeiro sítio a otimizar com uma
   * query agregada (groupBy por extract(dow)/extract(hour)).
   */
  async getHeatmap(userId: string): Promise<HeatmapCell[]> {
    const sessions = await this.prisma.studySession.findMany({
      where: { userId, endedAt: { not: null } },
      select: { startedAt: true, endedAt: true },
    });

    const grid = new Map<
      string,
      { totalMinutes: number; sessionCount: number }
    >();

    for (const session of sessions) {
      if (!session.endedAt) continue; // já filtrado pelo where, é só para o TS
      const dayOfWeek = session.startedAt.getDay();
      const hourBucket = Math.floor(
        session.startedAt.getHours() / HOUR_BUCKET_SIZE,
      );
      const minutes =
        (session.endedAt.getTime() - session.startedAt.getTime()) / 60_000;

      const key = `${dayOfWeek}:${hourBucket}`;
      const cell = grid.get(key) ?? { totalMinutes: 0, sessionCount: 0 };
      cell.totalMinutes += Math.max(0, minutes);
      cell.sessionCount += 1;
      grid.set(key, cell);
    }

    const result: HeatmapCell[] = [];
    for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
      for (let hourBucket = 0; hourBucket < HOUR_BUCKET_COUNT; hourBucket++) {
        const cell = grid.get(`${dayOfWeek}:${hourBucket}`);
        result.push({
          dayOfWeek,
          hourBucket,
          totalMinutes: cell ? Math.round(cell.totalMinutes) : 0,
          sessionCount: cell?.sessionCount ?? 0,
        });
      }
    }
    return result;
  }

  private async assertTaskOwnership(userId: string, taskId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, userId },
      select: { id: true },
    });
    if (!task) {
      throw new NotFoundException(`Task not found or you don't have access.`);
    }
  }

  private async assertAreaExists(areaId: string) {
    // Areas são partilhadas (não têm userId no schema), por isso só
    // confirmamos que existe - não é uma questão de posse.
    const area = await this.prisma.area.findUnique({
      where: { id: areaId },
      select: { id: true },
    });
    if (!area) {
      throw new NotFoundException(`Area not found.`);
    }
  }

  private toResponse(session: SessionWithRelations) {
    const durationSeconds = session.endedAt
      ? Math.max(
          0,
          Math.round(
            (session.endedAt.getTime() - session.startedAt.getTime()) / 1000,
          ),
        )
      : null;

    return { ...session, durationSeconds };
  }
}
