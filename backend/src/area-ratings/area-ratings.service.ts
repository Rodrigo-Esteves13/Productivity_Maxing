import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { assertAreaAccessible } from '../areas/area-access';
import type { AreaRating } from './area-ratings.types';
import type { SetAreaRatingDto } from './dto/set-area-rating.dto';

const RATING_SELECT = {
  areaId: true,
  teacherRating: true,
  courseLiking: true,
} as const;

type SentFields = Partial<Pick<AreaRating, 'teacherRating' | 'courseLiking'>>;

@Injectable()
export class AreaRatingsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Avaliacoes do user (so as dele, nunca de outros). */
  list(userId: string): Promise<AreaRating[]> {
    return this.prisma.areaRating.findMany({
      where: { userId },
      select: RATING_SELECT,
    });
  }

  /**
   * Campo ausente mantem o valor guardado; null limpa-o. Se no fim os dois
   * ficarem null, a linha e apagada (sem avaliacao = sem linha).
   *
   * Sem ler-e-fundir em JS (perdia pedidos concorrentes, um por campo): o
   * upsert so escreve os campos enviados e a limpeza apaga apenas linhas que
   * ja estejam com os dois a null. Cada instrucao e atomica por linha.
   *
   * Ciclo de vida: AreaRating tem onDelete Cascade para User e para Area.
   * Se um admin apagar uma Area oficial (so possivel sem tasks, caderno nem
   * componentes), as avaliacoes de todos os users para ela desaparecem em
   * silencio, tal como AreaTeacherNote. Comportamento intencional.
   */
  async set(
    userId: string,
    areaId: string,
    dto: SetAreaRatingDto,
  ): Promise<AreaRating> {
    // Oficial ou privada deste user; 404 igual nos dois casos (sem IDOR).
    await assertAreaAccessible(this.prisma, userId, areaId);

    const sent: SentFields = {};
    if (dto.teacherRating !== undefined) sent.teacherRating = dto.teacherRating;
    if (dto.courseLiking !== undefined) sent.courseLiking = dto.courseLiking;

    const saved = await this.prisma.areaRating.upsert({
      where: { userId_areaId: { userId, areaId } },
      create: {
        userId,
        areaId,
        teacherRating: sent.teacherRating ?? null,
        courseLiking: sent.courseLiking ?? null,
      },
      update: sent,
      select: RATING_SELECT,
    });

    if (sent.teacherRating !== undefined) {
      await this.syncSameTeacher(userId, areaId, sent.teacherRating);
    }

    // So apaga se a linha ficou vazia; nunca toca numa linha com valores.
    await this.prisma.areaRating.deleteMany({
      where: { userId, areaId, teacherRating: null, courseLiking: null },
    });
    return saved;
  }

  /**
   * O mesmo docente (mesmo nome, sem distinguir maiusculas) em outras
   * cadeiras do user: a nota do docente passa a ser a mesma. So toca nas
   * linhas deste user.
   */
  private async syncSameTeacher(
    userId: string,
    areaId: string,
    teacherRating: number | null,
  ): Promise<void> {
    const note = await this.prisma.areaTeacherNote.findUnique({
      where: { userId_areaId: { userId, areaId } },
      select: { teacherName: true },
    });
    const name = note?.teacherName.trim();
    if (!name) return;
    const sameTeacher = await this.prisma.areaTeacherNote.findMany({
      where: {
        userId,
        areaId: { not: areaId },
        teacherName: { equals: name, mode: 'insensitive' },
      },
      select: { areaId: true },
    });
    await Promise.all(
      sameTeacher.map((other) =>
        this.prisma.areaRating.upsert({
          where: { userId_areaId: { userId, areaId: other.areaId } },
          create: { userId, areaId: other.areaId, teacherRating },
          update: { teacherRating },
        }),
      ),
    );
    await this.prisma.areaRating.deleteMany({
      where: {
        userId,
        areaId: { in: sameTeacher.map((other) => other.areaId) },
        teacherRating: null,
        courseLiking: null,
      },
    });
  }

  /** Apagar uma avaliacao que nao existe nao e erro. */
  async remove(userId: string, areaId: string): Promise<void> {
    await this.prisma.areaRating.deleteMany({ where: { userId, areaId } });
  }
}
