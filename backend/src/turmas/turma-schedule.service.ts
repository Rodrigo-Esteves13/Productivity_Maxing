import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TurmaAccessService } from './turma-access.service';
import { addUtcDays, getLisbonNow, toDateKey } from '../common/date-key.util';

// Quantos dias do horario partilhado se mostram e quantos se copiam.
export const TURMA_SCHEDULE_VIEW_DAYS = 14;
export const TURMA_SCHEDULE_COPY_DAYS = 180;
// Teto de aulas copiadas de uma vez (um semestre cheio fica bem abaixo).
export const TURMA_SCHEDULE_MAX_COPY = 600;

export interface TurmaScheduleClass {
  subject: string;
  date: string;
  startMinutes: number;
  endMinutes: number;
  location: string | null;
  /** Quantos membros que partilham tem esta aula. */
  sharedBy: number;
  /** Ja esta no meu horario (mesma cadeira, dia e hora). */
  inMine: boolean;
}

interface OccurrenceRow {
  userId: string;
  subject: string;
  date: Date;
  startMinutes: number;
  endMinutes: number;
  location: string | null;
  professor: string | null;
}

const slotKey = (
  o: Pick<OccurrenceRow, 'subject' | 'date' | 'startMinutes' | 'endMinutes'>,
) =>
  `${o.subject.trim().toLowerCase()}|${toDateKey(o.date)}|${o.startMinutes}|${o.endMinutes}`;

/** Junta as aulas iguais (mesma cadeira, dia e hora) de varios membros. */
export function mergeSharedClasses(
  rows: OccurrenceRow[],
  mine: Set<string>,
): TurmaScheduleClass[] {
  const bySlot = new Map<string, { row: OccurrenceRow; users: Set<string> }>();
  for (const row of rows) {
    const key = slotKey(row);
    const slot = bySlot.get(key) ?? { row, users: new Set<string>() };
    slot.users.add(row.userId);
    bySlot.set(key, slot);
  }
  return [...bySlot.entries()]
    .map(([key, { row, users }]) => ({
      subject: row.subject,
      date: toDateKey(row.date),
      startMinutes: row.startMinutes,
      endMinutes: row.endMinutes,
      location: row.location,
      sharedBy: users.size,
      inMine: mine.has(key),
    }))
    .sort(
      (a, b) => a.date.localeCompare(b.date) || a.startMinutes - b.startMinutes,
    );
}

/**
 * Horario da turma: cada membro escolhe se partilha as suas aulas
 * (desligado por defeito, nem todos tem as mesmas cadeiras). Mostra so
 * cadeira, dia, hora e sala, nunca quem partilhou. Quem nao importou o
 * .ics pode copiar uma cadeira para o proprio horario.
 */
@Injectable()
export class TurmaScheduleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: TurmaAccessService,
  ) {}

  private async sharerIds(turmaId: string): Promise<string[]> {
    const rows = await this.prisma.turmaMember.findMany({
      where: { turmaId, shareSchedule: true },
      select: { userId: true },
    });
    return rows.map((r) => r.userId);
  }

  async get(userId: string, turmaId: string) {
    await this.access.requireMember(userId, turmaId);
    const [me, sharers] = await Promise.all([
      this.prisma.turmaMember.findUnique({
        where: { turmaId_userId: { turmaId, userId } },
        select: { shareSchedule: true },
      }),
      this.sharerIds(turmaId),
    ]);
    const { today } = getLisbonNow();
    const until = addUtcDays(today, TURMA_SCHEDULE_VIEW_DAYS);
    const select = {
      userId: true,
      subject: true,
      date: true,
      startMinutes: true,
      endMinutes: true,
      location: true,
      professor: true,
    } as const;
    const [shared, mine] = await Promise.all([
      sharers.length === 0
        ? Promise.resolve([] as OccurrenceRow[])
        : this.prisma.classOccurrence.findMany({
            where: { userId: { in: sharers }, date: { gte: today, lt: until } },
            select,
          }),
      this.prisma.classOccurrence.findMany({
        where: { userId, date: { gte: today, lt: until } },
        select,
      }),
    ]);
    return {
      sharing: me?.shareSchedule ?? false,
      sharers: sharers.length,
      classes: mergeSharedClasses(shared, new Set(mine.map(slotKey))),
    };
  }

  async setSharing(userId: string, turmaId: string, share: boolean) {
    await this.access.requireMember(userId, turmaId);
    await this.prisma.turmaMember.update({
      where: { turmaId_userId: { turmaId, userId } },
      data: { shareSchedule: share },
    });
    return { sharing: share };
  }

  /**
   * Copia as proximas aulas de uma cadeira (dos membros que partilham)
   * para o horario de quem pede. externalUid fixo por aula: copiar outra
   * vez nao duplica, e um .ics importado depois convive com estas.
   */
  async copySubject(userId: string, turmaId: string, subject: string) {
    await this.access.requireMember(userId, turmaId);
    const sharers = (await this.sharerIds(turmaId)).filter(
      (id) => id !== userId,
    );
    const { today } = getLisbonNow();
    const rows = sharers.length
      ? await this.prisma.classOccurrence.findMany({
          where: {
            userId: { in: sharers },
            subject: { equals: subject, mode: 'insensitive' },
            date: {
              gte: today,
              lt: addUtcDays(today, TURMA_SCHEDULE_COPY_DAYS),
            },
          },
          select: {
            userId: true,
            subject: true,
            date: true,
            startMinutes: true,
            endMinutes: true,
            location: true,
            professor: true,
          },
          orderBy: { date: 'asc' },
        })
      : [];
    if (rows.length === 0) {
      throw new BadRequestException(
        'Nobody in this class shares that subject.',
      );
    }
    const unique = new Map<string, OccurrenceRow>();
    for (const row of rows) {
      if (!unique.has(slotKey(row))) unique.set(slotKey(row), row);
    }
    const toCopy = [...unique.entries()].slice(0, TURMA_SCHEDULE_MAX_COPY);
    await this.prisma.$transaction(
      toCopy.map(([key, row]) => {
        const externalUid = `turma:${turmaId}:${key}`;
        const data = {
          date: row.date,
          startMinutes: row.startMinutes,
          endMinutes: row.endMinutes,
          subject: row.subject,
          location: row.location,
          professor: row.professor,
        };
        return this.prisma.classOccurrence.upsert({
          where: { userId_externalUid: { userId, externalUid } },
          create: { userId, externalUid, ...data },
          update: data,
        });
      }),
    );
    return { copied: toCopy.length };
  }
}
