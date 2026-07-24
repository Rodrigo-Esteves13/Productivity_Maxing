import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProgramDto } from './dto/create-program.dto';
import { UpdateProgramDto } from './dto/update-program.dto';
import { computeCreditWeightedAverage } from './grade-average.util';

@Injectable()
export class ProgramsService {
  constructor(private readonly prisma: PrismaService) {}

  findAllForUser(userId: string) {
    return this.prisma.academicProgram.findMany({
      where: { userId },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
  }

  // Used by this service and by PeriodsService to make sure a programId
  // received from the client actually belongs to the authenticated user
  // before using it - defense against IDOR (guessing another user's
  // program UUID), same pattern used across the rest of the app (see
  // comments in tasks.service.ts).
  async findOwnedOrThrow(userId: string, id: string) {
    const program = await this.prisma.academicProgram.findFirst({
      where: { id, userId },
    });
    if (!program) {
      throw new NotFoundException('Program not found or no access.');
    }
    return program;
  }

  create(userId: string, dto: CreateProgramDto) {
    return this.prisma.academicProgram.create({
      data: {
        userId,
        name: dto.name,
        gradeScale: dto.gradeScale ?? '0-20',
        order: dto.order ?? 0,
      },
    });
  }

  // Also used to archive a program: PATCH { isActive: false }.
  async update(userId: string, id: string, dto: UpdateProgramDto) {
    await this.findOwnedOrThrow(userId, id);
    return this.prisma.academicProgram.update({
      where: { id },
      data: { ...dto },
    });
  }

  /**
   * Hard delete. Blocked if the program has any task left anywhere in it
   * (any period, archived or not) - matches the "never lose data
   * silently" pattern used elsewhere in this app. Only a genuinely empty
   * program (no tasks in any of its periods) can actually be deleted;
   * periods themselves cascade automatically (AcademicPeriod.programId
   * is onDelete: Cascade in the schema).
   *
   * If the user is left without any active program/period afterwards,
   * User.activeProgramId/activePeriodId are cleared automatically
   * (onDelete: SetNull) - the next call to
   * PeriodsService.resolveActivePeriodId() self-heals by creating a new
   * default program+period.
   */
  async remove(userId: string, id: string) {
    await this.findOwnedOrThrow(userId, id);

    const taskCount = await this.prisma.task.count({
      where: { period: { programId: id } },
    });
    if (taskCount > 0) {
      throw new ConflictException(
        'This program still has tasks in it. Move or delete those tasks first before deleting the program.',
      );
    }

    return this.prisma.academicProgram.delete({ where: { id } });
  }

  /**
   * Cumulative weighted average: ALL graded tasks from ALL periods of
   * this program, archived included - an archived period still counts
   * towards the whole-program average, it just stops generating
   * notifications/alerts (see the archive rule in periods.service.ts).
   * Two levels (see computeCreditWeightedAverage): per-Area average
   * weighted by Task.weightPercentage, then those averages weighted by
   * Area.credits.
   */
  async getAverage(userId: string, id: string) {
    const program = await this.findOwnedOrThrow(userId, id);
    const tasks = await this.prisma.task.findMany({
      where: { period: { programId: id }, realGrade: { not: null } },
      select: { realGrade: true, weightPercentage: true, areaId: true },
    });
    const areas = await this.prisma.area.findMany({
      select: { id: true, credits: true },
    });
    return {
      programId: program.id,
      programName: program.name,
      ...computeCreditWeightedAverage(tasks, areas),
    };
  }

  /**
   * Comparison between periods of the SAME program - only within this
   * program, never cross-program (comparing a secondary school grade to
   * a university GPA makes no sense, different scales/contexts).
   */
  async getPeriodsComparison(userId: string, id: string) {
    await this.findOwnedOrThrow(userId, id);
    const periods = await this.prisma.academicPeriod.findMany({
      where: { programId: id },
      orderBy: { startDate: 'asc' },
      include: {
        tasks: {
          where: { realGrade: { not: null } },
          select: { realGrade: true, weightPercentage: true, areaId: true },
        },
      },
    });
    const areas = await this.prisma.area.findMany({
      select: { id: true, credits: true },
    });

    return periods.map((period) => ({
      periodId: period.id,
      periodName: period.name,
      startDate: period.startDate,
      isArchived: period.isArchived,
      ...computeCreditWeightedAverage(period.tasks, areas),
    }));
  }
}
