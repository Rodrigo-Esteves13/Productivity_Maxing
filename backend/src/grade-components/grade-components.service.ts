import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  MAX_COMPONENTS_PER_AREA,
  MAX_ENTRIES_PER_COMPONENT,
} from './grade-components.constants';
import type { GradeAggregationKind } from './grade-components.constants';
import { computeComponentGrade } from './grade-component.util';
import {
  MAX_COURSE_WEIGHT_PERCENT,
  assertWeightFits,
  loadUsedWeight,
} from './weight-budget';
import {
  CreateGradeComponentDto,
  UpdateGradeComponentDto,
} from './dto/grade-component.dto';
import {
  CreateGradeEntryDto,
  UpdateGradeEntryDto,
} from './dto/grade-entry.dto';

const COMPONENT_INCLUDE = {
  entries: {
    orderBy: [{ date: 'asc' as const }, { createdAt: 'asc' as const }],
  },
};

interface ComponentRow {
  id: string;
  areaId: string;
  periodId: string;
  name: string;
  weightPercentage: number;
  aggregation: GradeAggregationKind;
  bestOfCount: number | null;
  expectedEntries: number | null;
  entries: {
    id: string;
    label: string | null;
    grade: number;
    date: Date | null;
  }[];
}

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === 'P2002';
}

@Injectable()
export class GradeComponentsService {
  constructor(private readonly prisma: PrismaService) {}

  private toView(row: ComponentRow) {
    return {
      id: row.id,
      areaId: row.areaId,
      periodId: row.periodId,
      name: row.name,
      weightPercentage: row.weightPercentage,
      aggregation: row.aggregation,
      bestOfCount: row.bestOfCount,
      expectedEntries: row.expectedEntries,
      // Nota ja agregada (null enquanto nao ha entradas).
      grade: computeComponentGrade(
        row.entries.map((e) => e.grade),
        row.aggregation,
        row.bestOfCount,
      ),
      entries: row.entries.map((e) => ({
        id: e.id,
        label: e.label,
        grade: e.grade,
        date: e.date ? e.date.toISOString() : null,
      })),
    };
  }

  private async findOwnedOrThrow(userId: string, id: string) {
    const component = await this.prisma.gradeComponent.findFirst({
      where: { id, userId },
      include: COMPONENT_INCLUDE,
    });
    if (!component) {
      throw new NotFoundException('Grade component not found.');
    }
    return component;
  }

  private assertBestOf(
    aggregation: GradeAggregationKind,
    bestOfCount: number | null | undefined,
  ) {
    if (aggregation === 'BEST_OF' && !bestOfCount) {
      throw new BadRequestException(
        'Choose how many of the best grades count.',
      );
    }
  }

  async list(userId: string, query: { periodId?: string; areaId?: string }) {
    const rows = await this.prisma.gradeComponent.findMany({
      where: {
        userId,
        ...(query.periodId ? { periodId: query.periodId } : {}),
        ...(query.areaId ? { areaId: query.areaId } : {}),
      },
      include: COMPONENT_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => this.toView(row as ComponentRow));
  }

  async weightBudget(
    userId: string,
    query: { areaId: string; periodId: string; excludeTaskId?: string },
  ) {
    const used = await loadUsedWeight(this.prisma, {
      userId,
      areaId: query.areaId,
      periodId: query.periodId,
      excludeTaskId: query.excludeTaskId,
    });
    return {
      used,
      remaining: Math.max(0, MAX_COURSE_WEIGHT_PERCENT - used),
      max: MAX_COURSE_WEIGHT_PERCENT,
    };
  }

  async create(userId: string, dto: CreateGradeComponentDto) {
    const [period, area] = await Promise.all([
      this.prisma.academicPeriod.findFirst({
        where: { id: dto.periodId, program: { userId } },
        select: { id: true },
      }),
      this.prisma.area.findUnique({
        where: { id: dto.areaId },
        select: { id: true },
      }),
    ]);
    if (!period) throw new NotFoundException('Period not found or no access.');
    if (!area) throw new NotFoundException('Area not found.');

    const aggregation = dto.aggregation ?? 'AVERAGE';
    this.assertBestOf(aggregation, dto.bestOfCount);

    const existing = await this.prisma.gradeComponent.count({
      where: { userId, areaId: dto.areaId, periodId: dto.periodId },
    });
    if (existing >= MAX_COMPONENTS_PER_AREA) {
      throw new BadRequestException(
        `At most ${MAX_COMPONENTS_PER_AREA} grade components per course and period.`,
      );
    }

    await assertWeightFits(
      this.prisma,
      { userId, areaId: dto.areaId, periodId: dto.periodId },
      dto.weightPercentage,
    );

    try {
      const created = await this.prisma.gradeComponent.create({
        data: {
          userId,
          areaId: dto.areaId,
          periodId: dto.periodId,
          name: dto.name,
          weightPercentage: dto.weightPercentage,
          aggregation,
          bestOfCount: aggregation === 'BEST_OF' ? dto.bestOfCount : null,
          expectedEntries: dto.expectedEntries ?? null,
        },
        include: COMPONENT_INCLUDE,
      });
      return this.toView(created);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          'This course already has a component with that name.',
        );
      }
      throw error;
    }
  }

  async update(userId: string, id: string, dto: UpdateGradeComponentDto) {
    const current = await this.findOwnedOrThrow(userId, id);
    const aggregation = dto.aggregation ?? current.aggregation;
    const bestOfCount =
      dto.bestOfCount !== undefined ? dto.bestOfCount : current.bestOfCount;
    this.assertBestOf(aggregation, bestOfCount);

    // So valida quando o peso sobe (mexer so no nome nao pode falhar).
    if (
      dto.weightPercentage !== undefined &&
      dto.weightPercentage > current.weightPercentage
    ) {
      await assertWeightFits(
        this.prisma,
        {
          userId,
          areaId: current.areaId,
          periodId: current.periodId,
          excludeComponentId: id,
        },
        dto.weightPercentage,
      );
    }

    try {
      const updated = await this.prisma.gradeComponent.update({
        where: { id },
        data: {
          name: dto.name,
          weightPercentage: dto.weightPercentage,
          aggregation,
          // Fora de BEST_OF o N nao faz sentido: limpa-se.
          bestOfCount: aggregation === 'BEST_OF' ? bestOfCount : null,
          expectedEntries: dto.expectedEntries,
        },
        include: COMPONENT_INCLUDE,
      });
      return this.toView(updated);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          'This course already has a component with that name.',
        );
      }
      throw error;
    }
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.findOwnedOrThrow(userId, id);
    await this.prisma.gradeComponent.delete({ where: { id } });
  }

  async addEntry(
    userId: string,
    componentId: string,
    dto: CreateGradeEntryDto,
  ) {
    await this.findOwnedOrThrow(userId, componentId);
    const count = await this.prisma.gradeEntry.count({
      where: { componentId },
    });
    if (count >= MAX_ENTRIES_PER_COMPONENT) {
      throw new BadRequestException(
        `At most ${MAX_ENTRIES_PER_COMPONENT} grades per component.`,
      );
    }
    await this.prisma.gradeEntry.create({
      data: {
        componentId,
        grade: dto.grade,
        label: dto.label || null,
        date: dto.date ? new Date(dto.date) : null,
      },
    });
    return this.toView(await this.findOwnedOrThrow(userId, componentId));
  }

  private async assertEntryInComponent(componentId: string, entryId: string) {
    const entry = await this.prisma.gradeEntry.findFirst({
      where: { id: entryId, componentId },
      select: { id: true },
    });
    if (!entry) throw new NotFoundException('Grade entry not found.');
  }

  async updateEntry(
    userId: string,
    componentId: string,
    entryId: string,
    dto: UpdateGradeEntryDto,
  ) {
    await this.findOwnedOrThrow(userId, componentId);
    await this.assertEntryInComponent(componentId, entryId);
    await this.prisma.gradeEntry.update({
      where: { id: entryId },
      data: {
        grade: dto.grade,
        label: dto.label === undefined ? undefined : dto.label || null,
        date: dto.date === undefined ? undefined : new Date(dto.date),
      },
    });
    return this.toView(await this.findOwnedOrThrow(userId, componentId));
  }

  async removeEntry(userId: string, componentId: string, entryId: string) {
    await this.findOwnedOrThrow(userId, componentId);
    await this.assertEntryInComponent(componentId, entryId);
    await this.prisma.gradeEntry.delete({ where: { id: entryId } });
    return this.toView(await this.findOwnedOrThrow(userId, componentId));
  }
}
