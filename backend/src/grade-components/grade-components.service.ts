import { accessibleAreaWhere } from '../areas/area-access';
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
  loadUsedWeightByArea,
} from './weight-budget';
import {
  CreateGradeComponentDto,
  UpdateGradeComponentDto,
} from './dto/grade-component.dto';
import {
  CreateGradeEntryDto,
  UpdateGradeEntryDto,
} from './dto/grade-entry.dto';
import { isUniqueViolation } from '../common/prisma-errors';
import { runWithUserTaskLock } from '../tasks/user-lock.util';

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

  // Orcamento de peso de todas as cadeiras com algum peso atribuido no
  // periodo (tasks ou componentes). Mesma regra do limite de 100%.
  async weightBudgets(userId: string, periodId: string) {
    // Um groupBy por tabela para o periodo todo (B-36), em vez de um
    // loadUsedWeight por cadeira.
    const usedByArea = await loadUsedWeightByArea(this.prisma, {
      userId,
      periodId,
    });
    const budgets = [...usedByArea.entries()].map(([areaId, used]) => ({
      areaId,
      used,
      remaining: Math.max(0, MAX_COURSE_WEIGHT_PERCENT - used),
    }));
    return { max: MAX_COURSE_WEIGHT_PERCENT, budgets };
  }

  async create(userId: string, dto: CreateGradeComponentDto) {
    const [period, area] = await Promise.all([
      this.prisma.academicPeriod.findFirst({
        where: { id: dto.periodId, program: { userId } },
        select: { id: true },
      }),
      this.prisma.area.findFirst({
        where: { id: dto.areaId, ...accessibleAreaWhere(userId) },
        select: { id: true },
      }),
    ]);
    if (!period) throw new NotFoundException('Period not found or no access.');
    if (!area) throw new NotFoundException('Area not found.');

    const aggregation = dto.aggregation ?? 'AVERAGE';
    this.assertBestOf(aggregation, dto.bestOfCount);

    try {
      // Contar, validar o peso e inserir com o mesmo lock por user das
      // tasks (B-42): tasks e componentes partilham os 100% da cadeira.
      const created = await runWithUserTaskLock(
        this.prisma,
        userId,
        async (tx) => {
          const existing = await tx.gradeComponent.count({
            where: { userId, areaId: dto.areaId, periodId: dto.periodId },
          });
          if (existing >= MAX_COMPONENTS_PER_AREA) {
            throw new BadRequestException(
              `At most ${MAX_COMPONENTS_PER_AREA} grade components per course and period.`,
            );
          }
          await assertWeightFits(
            tx,
            { userId, areaId: dto.areaId, periodId: dto.periodId },
            dto.weightPercentage,
          );
          return tx.gradeComponent.create({
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
        },
      );
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

    // So valida quando o peso sobe (mexer so no nome nao pode falhar):
    // assertWeightFits ignora um peso null.
    const weightIncreased =
      dto.weightPercentage !== undefined &&
      dto.weightPercentage > current.weightPercentage;

    try {
      // Validar e gravar com o lock por user (B-42), como no create().
      const updated = await runWithUserTaskLock(
        this.prisma,
        userId,
        async (tx) => {
          await assertWeightFits(
            tx,
            {
              userId,
              areaId: current.areaId,
              periodId: current.periodId,
              excludeComponentId: id,
            },
            weightIncreased ? dto.weightPercentage : null,
          );
          return tx.gradeComponent.update({
            where: { id, userId },
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
        },
      );
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
    await this.prisma.gradeComponent.delete({ where: { id, userId } });
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

  // Entrada, componente e dono numa so query (B-44): substitui o
  // findOwnedOrThrow do componente mais a verificacao da entrada.
  private entryScope(userId: string, componentId: string, entryId: string) {
    return { id: entryId, componentId, component: { userId } };
  }

  private async assertEntryOwned(
    userId: string,
    componentId: string,
    entryId: string,
  ) {
    const entry = await this.prisma.gradeEntry.findFirst({
      where: this.entryScope(userId, componentId, entryId),
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
    await this.assertEntryOwned(userId, componentId, entryId);
    await this.prisma.gradeEntry.update({
      where: this.entryScope(userId, componentId, entryId),
      data: {
        grade: dto.grade,
        label: dto.label === undefined ? undefined : dto.label || null,
        date: dto.date === undefined ? undefined : new Date(dto.date),
      },
    });
    return this.toView(await this.findOwnedOrThrow(userId, componentId));
  }

  async removeEntry(userId: string, componentId: string, entryId: string) {
    await this.assertEntryOwned(userId, componentId, entryId);
    await this.prisma.gradeEntry.delete({
      where: this.entryScope(userId, componentId, entryId),
    });
    return this.toView(await this.findOwnedOrThrow(userId, componentId));
  }
}
