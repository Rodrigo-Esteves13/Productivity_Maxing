import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { accessibleAreaWhere } from '../areas/area-access';

@Injectable()
export class AreaInterestsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Interesse (1 a 5) que o user deu a cada cadeira. */
  list(userId: string) {
    return this.prisma.areaInterest.findMany({
      where: { userId },
      select: { areaId: true, rating: true },
    });
  }

  async set(userId: string, areaId: string, rating: number) {
    // Oficial ou privada deste user (o interesse em si e sempre do user).
    const area = await this.prisma.area.findFirst({
      where: { id: areaId, ...accessibleAreaWhere(userId) },
      select: { id: true },
    });
    if (!area) throw new NotFoundException('Course not found.');

    return this.prisma.areaInterest.upsert({
      where: { userId_areaId: { userId, areaId } },
      create: { userId, areaId, rating },
      update: { rating },
      select: { areaId: true, rating: true },
    });
  }

  /** Remove o interesse; apagar um que nao existe nao e erro. */
  async remove(userId: string, areaId: string): Promise<void> {
    await this.prisma.areaInterest.deleteMany({ where: { userId, areaId } });
  }
}
