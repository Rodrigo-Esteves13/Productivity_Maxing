import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProgramsService } from './programs.service';
import { CreatePeriodDto } from './dto/create-period.dto';
import { UpdatePeriodDto } from './dto/update-period.dto';
import {
  computeCreditWeightedAverage,
  resolveRoundFinalGrade,
} from './grade-average.util';

@Injectable()
export class PeriodsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly programsService: ProgramsService,
  ) {}

  async findAllForProgram(userId: string, programId: string) {
    // Confirms ownership of the program before listing - without this,
    // anyone could list another user's periods just by knowing the UUID.
    await this.programsService.findOwnedOrThrow(userId, programId);
    return this.prisma.academicPeriod.findMany({
      where: { programId },
      orderBy: { startDate: 'desc' },
    });
  }

  async create(userId: string, dto: CreatePeriodDto) {
    await this.programsService.findOwnedOrThrow(userId, dto.programId);
    return this.prisma.academicPeriod.create({
      data: {
        programId: dto.programId,
        name: dto.name,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
      },
    });
  }

  // Used internally (archive, and by the ?periodId= filter) to confirm a
  // period belongs to the user before returning/editing it - via
  // program.userId, since AcademicPeriod has no userId of its own.
  async findOwnedOrThrow(userId: string, id: string) {
    const period = await this.prisma.academicPeriod.findFirst({
      where: { id, program: { userId } },
    });
    if (!period) {
      throw new NotFoundException('Period not found or no access.');
    }
    return period;
  }

  /**
   * Renames a period and/or edits its dates - doesn't touch isArchived,
   * that's archive()/restore()'s job. This is what lets a program like
   * "Bachelor's" actually be organized into semesters/years after
   * creation, instead of only getting a name at creation time.
   */
  async update(userId: string, id: string, dto: UpdatePeriodDto) {
    await this.findOwnedOrThrow(userId, id);
    return this.prisma.academicPeriod.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.startDate !== undefined
          ? { startDate: new Date(dto.startDate) }
          : {}),
        ...(dto.endDate !== undefined
          ? { endDate: dto.endDate ? new Date(dto.endDate) : null }
          : {}),
        // null is a meaningful value here (explicitly go back to
        // inheriting the program's default), so it's checked against
        // undefined, not falsiness.
        ...(dto.roundFinalGrade !== undefined
          ? { roundFinalGrade: dto.roundFinalGrade }
          : {}),
      },
    });
  }

  /**
   * Soft-archive. Never deletes data - only marks isArchived/archivedAt.
   * Reversible: see restore() below - archived periods are hidden from
   * the selector by default (frontend), never permanently lost.
   *
   * Two business rules:
   *
   * 1. Hard block, no way around it: a user can never end up with zero
   *    active periods across ALL of their programs. This is what used to
   *    be informally "the General/fallback dashboard" - instead of
   *    special-casing it by name (fragile: renaming it would silently
   *    remove the protection), we protect whatever period currently
   *    happens to be the user's only remaining active one, in any
   *    program. Archiving it is refused outright, confirm or not - the
   *    user has to create another active period first.
   *
   * 2. Soft block (confirm required): if this is merely the most recent
   *    period of ITS OWN program with no successor yet, but the user
   *    still has other active periods elsewhere, we just ask for
   *    confirm:true instead of refusing outright (normal case: "I closed
   *    this semester, the next one is already created").
   */
  async archive(userId: string, id: string, confirm = false) {
    const period = await this.findOwnedOrThrow(userId, id);
    if (period.isArchived) {
      return period;
    }

    const otherActiveCount = await this.prisma.academicPeriod.count({
      where: {
        program: { userId },
        isArchived: false,
        id: { not: period.id },
      },
    });
    if (otherActiveCount === 0) {
      throw new BadRequestException(
        'This is your only active period. Archiving it would leave you without any active dashboard - create another period first.',
      );
    }

    const hasNewerSibling = await this.prisma.academicPeriod.findFirst({
      where: {
        programId: period.programId,
        id: { not: period.id },
        startDate: { gt: period.startDate },
      },
    });

    if (!hasNewerSibling && !confirm) {
      throw new ConflictException(
        'This is the most recent period in this program, with no successor created yet. Confirm you really want to archive it.',
      );
    }

    return this.prisma.academicPeriod.update({
      where: { id },
      data: { isArchived: true, archivedAt: new Date() },
    });
  }

  /**
   * Reverses archive(). No restrictions - restoring a period never leaves
   * the user without an active dashboard, it only ever adds one back.
   */
  async restore(userId: string, id: string) {
    const period = await this.findOwnedOrThrow(userId, id);
    if (!period.isArchived) {
      return period;
    }
    return this.prisma.academicPeriod.update({
      where: { id },
      data: { isArchived: false, archivedAt: null },
    });
  }

  /**
   * Toggles isPinned. Pinning a period makes it the one this program
   * auto-selects (in loadPeriodsFor on the frontend) instead of always
   * defaulting to the chronologically most recent non-archived period -
   * useful when you're intentionally working in an older period for a
   * while and don't want every switch back to this program to jump you
   * to the newest one. At most one pinned period per program: pinning
   * one unpins whichever was previously pinned in the same program, in
   * the same transaction.
   */
  async togglePin(userId: string, id: string) {
    const period = await this.findOwnedOrThrow(userId, id);

    if (period.isPinned) {
      return this.prisma.academicPeriod.update({
        where: { id },
        data: { isPinned: false },
      });
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.academicPeriod.updateMany({
        where: { programId: period.programId, isPinned: true },
        data: { isPinned: false },
      });
      return tx.academicPeriod.update({
        where: { id },
        data: { isPinned: true },
      });
    });
  }

  /**
   * This period's weighted average - only graded tasks (realGrade set)
   * of this specific period, archived or not (see getProgramAverage for
   * the cumulative version). Two levels (see
   * computeCreditWeightedAverage): per-Area average weighted by
   * Task.weightPercentage, then those averages weighted by Area.credits
   * (areas without credits set default to weight 1).
   */
  async getAverage(userId: string, id: string) {
    const period = await this.findOwnedOrThrow(userId, id);
    const program = await this.programsService.findOwnedOrThrow(
      userId,
      period.programId,
    );
    const tasks = await this.prisma.task.findMany({
      where: { periodId: id, realGrade: { not: null } },
      select: { realGrade: true, weightPercentage: true, areaId: true },
    });
    const areas = await this.prisma.area.findMany({
      select: { id: true, credits: true },
    });
    const shouldRound = resolveRoundFinalGrade(
      program.roundFinalGrade,
      period.roundFinalGrade,
    );
    const result = computeCreditWeightedAverage(tasks, areas, shouldRound);
    return {
      periodId: period.id,
      periodName: period.name,
      ...result,
    };
  }

  /**
   * Marks this period (and the program it belongs to) as the user's
   * active dashboard - called by the period selector at the top of the
   * app when the selection changes. Stored on User instead of just
   * localStorage, to persist across sessions/devices (see GET /auth/me).
   */
  async setActive(userId: string, id: string) {
    const period = await this.findOwnedOrThrow(userId, id);
    await this.prisma.user.update({
      where: { id: userId },
      data: { activeProgramId: period.programId, activePeriodId: period.id },
    });
    return period;
  }

  /**
   * Resolves which period to use when a Task is created/updated without
   * an explicit periodId in the request body - this is what keeps the
   * existing Task endpoints working without any breaking change for the
   * current frontend (see TasksService.create).
   *
   * Self-healing: if the user doesn't have an activePeriodId yet (e.g.
   * an account created before this migration, without having gone
   * through the bulk backfill), this creates a "General" program+period
   * on the spot, in the same shape the migration creates.
   */
  async resolveActivePeriodId(userId: string): Promise<string> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { activePeriodId: true },
    });
    if (user.activePeriodId) return user.activePeriodId;

    const program = await this.prisma.academicProgram.create({
      data: { userId, name: 'General' },
    });
    const period = await this.prisma.academicPeriod.create({
      data: { programId: program.id, name: 'General', startDate: new Date() },
    });
    await this.prisma.user.update({
      where: { id: userId },
      data: { activeProgramId: program.id, activePeriodId: period.id },
    });

    return period.id;
  }
}
