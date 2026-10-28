import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GradeAggregation, Prisma, TurmaRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TurmaAccessService } from './turma-access.service';

// Limites de uma licenciatura partilhada (uma licenciatura real fica longe).
export const MAX_TURMA_PROGRAMS = 10;
export const MAX_SNAPSHOT_PERIODS = 20;
export const MAX_SNAPSHOT_COURSES = 200;

export interface ProgramSnapshotComponent {
  name: string;
  weightPercentage: number;
  aggregation: GradeAggregation;
  bestOfCount: number | null;
  expectedEntries: number | null;
}

export interface ProgramSnapshotCourse {
  name: string;
  colorHex: string;
  credits: number | null;
  components: ProgramSnapshotComponent[];
}

export interface ProgramSnapshot {
  gradeScale: string;
  roundFinalGrade: boolean;
  periods: {
    name: string;
    startDate: string;
    endDate: string | null;
    roundFinalGrade: boolean | null;
    courses: ProgramSnapshotCourse[];
  }[];
}

/** Agrupa as componentes de avaliacao por semestre e cadeira (sem notas). */
export function buildSnapshot(
  program: { gradeScale: string; roundFinalGrade: boolean },
  periods: {
    id: string;
    name: string;
    startDate: Date;
    endDate: Date | null;
    roundFinalGrade: boolean | null;
  }[],
  components: (ProgramSnapshotComponent & {
    periodId: string;
    area: { name: string; colorHex: string; credits: number | null };
  })[],
  // Cadeiras do semestre sem componentes (so com tarefas): entram vazias.
  extraCourses: {
    periodId: string | null;
    area: { name: string; colorHex: string; credits: number | null };
  }[] = [],
): ProgramSnapshot {
  return {
    gradeScale: program.gradeScale,
    roundFinalGrade: program.roundFinalGrade,
    periods: periods.map((period) => {
      const courses = new Map<string, ProgramSnapshotCourse>();
      for (const c of components.filter((x) => x.periodId === period.id)) {
        const course = courses.get(c.area.name) ?? {
          name: c.area.name,
          colorHex: c.area.colorHex,
          credits: c.area.credits,
          components: [],
        };
        course.components.push({
          name: c.name,
          weightPercentage: c.weightPercentage,
          aggregation: c.aggregation,
          bestOfCount: c.bestOfCount,
          expectedEntries: c.expectedEntries,
        });
        courses.set(c.area.name, course);
      }
      for (const extra of extraCourses.filter(
        (x) => x.periodId === period.id,
      )) {
        if (!courses.has(extra.area.name)) {
          courses.set(extra.area.name, {
            name: extra.area.name,
            colorHex: extra.area.colorHex,
            credits: extra.area.credits,
            components: [],
          });
        }
      }
      return {
        name: period.name,
        startDate: period.startDate.toISOString(),
        endDate: period.endDate?.toISOString() ?? null,
        roundFinalGrade: period.roundFinalGrade,
        courses: [...courses.values()],
      };
    }),
  };
}

/**
 * Licenciatura partilhada na turma: quem ja montou o Grades com todos os
 * semestres partilha a estrutura e os colegas importam-na com um clique.
 * E uma copia: nada do que se faz depois (notas, mudancas) passa de um
 * lado para o outro.
 */
@Injectable()
export class TurmaProgramsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: TurmaAccessService,
  ) {}

  async list(userId: string, turmaId: string) {
    await this.access.requireMember(userId, turmaId);
    const rows = await this.prisma.turmaProgram.findMany({
      where: { turmaId },
      select: {
        id: true,
        name: true,
        snapshot: true,
        createdAt: true,
        sharedById: true,
        sharedBy: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      sharedById: row.sharedById,
      sharedByName: row.sharedBy.name,
      createdAt: row.createdAt,
      snapshot: row.snapshot as unknown as ProgramSnapshot,
    }));
  }

  async share(userId: string, turmaId: string, programId: string) {
    await this.access.requireMember(userId, turmaId);
    const program = await this.prisma.academicProgram.findFirst({
      where: { id: programId, userId },
      select: {
        name: true,
        gradeScale: true,
        roundFinalGrade: true,
        periods: {
          select: {
            id: true,
            name: true,
            startDate: true,
            endDate: true,
            roundFinalGrade: true,
          },
          orderBy: { startDate: 'asc' },
        },
      },
    });
    if (!program) throw new NotFoundException('Program not found.');
    if (program.periods.length > MAX_SNAPSHOT_PERIODS) {
      throw new BadRequestException('This program has too many periods.');
    }
    const count = await this.prisma.turmaProgram.count({ where: { turmaId } });
    if (count >= MAX_TURMA_PROGRAMS) {
      throw new BadRequestException(
        `A class can have at most ${MAX_TURMA_PROGRAMS} shared programs.`,
      );
    }
    const components = await this.prisma.gradeComponent.findMany({
      where: { userId, periodId: { in: program.periods.map((p) => p.id) } },
      select: {
        periodId: true,
        name: true,
        weightPercentage: true,
        aggregation: true,
        bestOfCount: true,
        expectedEntries: true,
        area: { select: { name: true, colorHex: true, credits: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    const taskCourses = await this.prisma.task.findMany({
      where: { userId, periodId: { in: program.periods.map((p) => p.id) } },
      distinct: ['periodId', 'areaId'],
      select: {
        periodId: true,
        area: { select: { name: true, colorHex: true, credits: true } },
      },
    });
    const snapshot = buildSnapshot(
      program,
      program.periods,
      components,
      taskCourses,
    );
    const courses = snapshot.periods.reduce((n, p) => n + p.courses.length, 0);
    if (courses > MAX_SNAPSHOT_COURSES) {
      throw new BadRequestException('This program has too many courses.');
    }
    return this.prisma.turmaProgram.create({
      data: {
        turmaId,
        sharedById: userId,
        name: program.name.slice(0, 120),
        snapshot: snapshot as unknown as Prisma.InputJsonValue,
      },
      select: { id: true },
    });
  }

  async remove(userId: string, turmaId: string, linkId: string) {
    const membership = await this.access.requireMember(userId, turmaId);
    const row = await this.prisma.turmaProgram.findFirst({
      where: { id: linkId, turmaId },
      select: { sharedById: true },
    });
    if (!row) throw new NotFoundException('Shared program not found.');
    if (row.sharedById !== userId && membership.role !== TurmaRole.DELEGADO) {
      throw new ForbiddenException('Only who shared it or the class rep.');
    }
    await this.prisma.turmaProgram.delete({ where: { id: linkId } });
  }

  /**
   * Cria no Grades de quem pede um programa novo com os semestres, as
   * cadeiras (reaproveita uma cadeira propria com o mesmo nome) e as
   * componentes. Tudo numa transacao: ou fica tudo ou nada.
   */
  async import(userId: string, turmaId: string, linkId: string) {
    await this.access.requireMember(userId, turmaId);
    const row = await this.prisma.turmaProgram.findFirst({
      where: { id: linkId, turmaId },
      select: { name: true, snapshot: true },
    });
    if (!row) throw new NotFoundException('Shared program not found.');
    const snapshot = row.snapshot as unknown as ProgramSnapshot;

    const ownAreas = await this.prisma.area.findMany({
      where: { ownerId: userId },
      select: { id: true, name: true },
    });
    const areaByName = new Map(
      ownAreas.map((a) => [a.name.trim().toLowerCase(), a.id]),
    );

    return this.prisma.$transaction(
      async (tx) => {
        const program = await tx.academicProgram.create({
          data: {
            userId,
            name: row.name,
            gradeScale: snapshot.gradeScale,
            roundFinalGrade: snapshot.roundFinalGrade,
          },
          select: { id: true },
        });
        let courses = 0;
        for (const period of snapshot.periods) {
          const created = await tx.academicPeriod.create({
            data: {
              programId: program.id,
              name: period.name,
              startDate: new Date(period.startDate),
              endDate: period.endDate ? new Date(period.endDate) : null,
              roundFinalGrade: period.roundFinalGrade,
            },
            select: { id: true },
          });
          for (const course of period.courses) {
            const key = course.name.trim().toLowerCase();
            let areaId = areaByName.get(key);
            if (!areaId) {
              const area = await tx.area.create({
                data: {
                  name: course.name,
                  colorHex: course.colorHex,
                  credits: course.credits,
                  ownerId: userId,
                },
                select: { id: true },
              });
              areaId = area.id;
              areaByName.set(key, areaId);
            }
            await tx.gradeComponent.createMany({
              data: course.components.map((c) => ({
                userId,
                areaId: areaId,
                periodId: created.id,
                name: c.name,
                weightPercentage: c.weightPercentage,
                aggregation: c.aggregation,
                bestOfCount: c.bestOfCount,
                expectedEntries: c.expectedEntries,
              })),
              skipDuplicates: true,
            });
            courses += 1;
          }
        }
        return {
          programId: program.id,
          periods: snapshot.periods.length,
          courses,
        };
      },
      { timeout: 30_000 },
    );
  }
}
