import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SHIFT_SELECT, toShiftView } from './work-shifts.service';
import type { WorkShiftView } from './work-shifts.service';
import { MAX_COMMITMENTS_PER_USER } from './work-shifts.constants';
import { CreateCommitmentDto, UpdateCommitmentDto } from './dto/commitment.dto';

const COMMITMENT_SELECT = {
  id: true,
  name: true,
  commuteMinutes: true,
} satisfies Prisma.CommitmentSelect;

export interface CommitmentView {
  id: string;
  name: string;
  commuteMinutes: number;
}

export interface CommitmentWithShifts extends CommitmentView {
  shifts: WorkShiftView[];
}

export interface CommitmentsOverview {
  commitments: CommitmentWithShifts[];
  // Turnos criados antes de existirem locais: continuam visíveis e
  // editáveis, e podem ser movidos para um local.
  ungroupedShifts: WorkShiftView[];
}

const PRISMA_UNIQUE_VIOLATION = 'P2002';

@Injectable()
export class CommitmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(userId: string): Promise<CommitmentsOverview> {
    const [commitments, ungrouped] = await Promise.all([
      this.prisma.commitment.findMany({
        where: { userId },
        select: {
          ...COMMITMENT_SELECT,
          shifts: {
            select: SHIFT_SELECT,
            orderBy: [
              { dayOfWeek: 'asc' },
              { date: 'asc' },
              { startMinutes: 'asc' },
            ],
          },
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.workShift.findMany({
        where: { userId, commitmentId: null },
        select: SHIFT_SELECT,
        orderBy: [
          { dayOfWeek: 'asc' },
          { date: 'asc' },
          { startMinutes: 'asc' },
        ],
      }),
    ]);

    return {
      commitments: commitments.map((c) => ({
        id: c.id,
        name: c.name,
        commuteMinutes: c.commuteMinutes,
        shifts: c.shifts.map(toShiftView),
      })),
      ungroupedShifts: ungrouped.map(toShiftView),
    };
  }

  async create(
    userId: string,
    dto: CreateCommitmentDto,
  ): Promise<CommitmentView> {
    const count = await this.prisma.commitment.count({ where: { userId } });
    if (count >= MAX_COMMITMENTS_PER_USER) {
      throw new BadRequestException(
        `You can have at most ${MAX_COMMITMENTS_PER_USER} commitments.`,
      );
    }

    try {
      return await this.prisma.commitment.create({
        data: { userId, name: dto.name, commuteMinutes: dto.commuteMinutes },
        select: COMMITMENT_SELECT,
      });
    } catch (error) {
      throw this.mapWriteError(error);
    }
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateCommitmentDto,
  ): Promise<CommitmentView> {
    try {
      const { count } = await this.prisma.commitment.updateMany({
        where: { id, userId },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.commuteMinutes !== undefined && {
            commuteMinutes: dto.commuteMinutes,
          }),
        },
      });
      if (count === 0) throw this.notFound();
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw this.mapWriteError(error);
    }

    const updated = await this.prisma.commitment.findFirst({
      where: { id, userId },
      select: COMMITMENT_SELECT,
    });
    if (!updated) throw this.notFound();
    return updated;
  }

  // Apagar um local apaga também os seus turnos (cascade na BD): é o
  // comportamento pedido ("deixei de trabalhar aqui").
  async remove(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.commitment.deleteMany({
      where: { id, userId },
    });
    if (count === 0) throw this.notFound();
  }

  private notFound(): NotFoundException {
    return new NotFoundException(
      `Commitment not found or you don't have access.`,
    );
  }

  private mapWriteError(error: unknown): unknown {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === PRISMA_UNIQUE_VIOLATION
    ) {
      return new ConflictException(
        'You already have a commitment with that name.',
      );
    }
    return error;
  }
}
