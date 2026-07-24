import { Injectable, BadRequestException } from '@nestjs/common';
import { CreateAreaDto } from './dto/create-area.dto';
import { UpdateAreaDto } from './dto/update-area.dto';
import { PrismaService } from '../prisma/prisma.service';

const AREA_INCLUDE = { defaultTaskType: { select: { key: true } } } as const;

@Injectable()
export class AreasService {
  constructor(private readonly prisma: PrismaService) {}

  // Traduz a "key" vinda do frontend (ex: "ACADEMICO") para o id real na BD,
  // igual ao resolveTypes() do tasks.service.ts - mesma convenção em toda a
  // app: o frontend nunca fala em UUIDs de TaskType, só em keys estáveis.
  private async resolveDefaultTaskTypeId(
    key: string | null | undefined,
  ): Promise<string | null | undefined> {
    if (key === undefined) return undefined; // não mexer no campo
    if (key === null) return null; // desassociar explicitamente

    const taskType = await this.prisma.taskType.findUnique({ where: { key } });
    if (!taskType || !taskType.isActive) {
      throw new BadRequestException(`Task type "${key}" invalid or inactive.`);
    }
    return taskType.id;
  }

  private toResponse(area: {
    defaultTaskType: { key: string } | null;
    [key: string]: unknown;
  }) {
    const { defaultTaskType, ...rest } = area;
    return { ...rest, defaultTaskType: defaultTaskType?.key ?? null };
  }

  // credits (tal como name/colorHex) é um campo simples de Area, passa
  // direto em `rest` para o Prisma - não precisa de resolução como o
  // defaultTaskType (key -> id).
  async create(createAreaDto: CreateAreaDto) {
    const { defaultTaskType, ...rest } = createAreaDto;
    const defaultTaskTypeId =
      await this.resolveDefaultTaskTypeId(defaultTaskType);

    const area = await this.prisma.area.create({
      data: { ...rest, defaultTaskTypeId: defaultTaskTypeId ?? null },
      include: AREA_INCLUDE,
    });
    return this.toResponse(area);
  }

  async findAll() {
    const areas = await this.prisma.area.findMany({ include: AREA_INCLUDE });
    return areas.map((a) => this.toResponse(a));
  }

  async findOne(id: string) {
    const area = await this.prisma.area.findUnique({
      where: { id },
      include: AREA_INCLUDE,
    });
    return area ? this.toResponse(area) : null;
  }

  async update(id: string, updateAreaDto: UpdateAreaDto) {
    const { defaultTaskType, ...rest } = updateAreaDto;
    const defaultTaskTypeId =
      await this.resolveDefaultTaskTypeId(defaultTaskType);

    const area = await this.prisma.area.update({
      where: { id },
      data: {
        ...rest,
        ...(defaultTaskTypeId !== undefined ? { defaultTaskTypeId } : {}),
      },
      include: AREA_INCLUDE,
    });
    return this.toResponse(area);
  }

  async remove(id: string) {
    return this.prisma.area.delete({
      where: { id },
    });
  }
}
