import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { accessibleAreaWhere } from '../areas/area-access';
import type { CourseRiskInput } from '../approval-rules/approval-rules.types';
import { roundTo } from '../common/round.util';
import { teacherKey } from './area-teachers.constants';
import {
  loadAreaGradeFractions,
  type AreaGradeAverage,
} from './area-grade-fractions';

export type TeacherStats = NonNullable<CourseRiskInput['teacher']>;

const mean = (values: number[]): number =>
  values.reduce((sum, v) => sum + v, 0) / values.length;

@Injectable()
export class AreaTeachersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Notas de docente do user (so as dele, nunca de outros). */
  list(userId: string) {
    return this.prisma.areaTeacherNote.findMany({
      where: { userId },
      select: { areaId: true, teacherName: true },
    });
  }

  async set(userId: string, areaId: string, teacherName: string) {
    // Oficial ou privada deste user; 404 igual nos dois casos (sem IDOR).
    const area = await this.prisma.area.findFirst({
      where: { id: areaId, ...accessibleAreaWhere(userId) },
      select: { id: true },
    });
    if (!area) throw new NotFoundException('Course not found.');

    return this.prisma.areaTeacherNote.upsert({
      where: { userId_areaId: { userId, areaId } },
      create: { userId, areaId, teacherName },
      update: { teacherName },
      select: { areaId: true, teacherName: true },
    });
  }

  /** Apagar uma nota que nao existe nao e erro. */
  async remove(userId: string, areaId: string): Promise<void> {
    await this.prisma.areaTeacherNote.deleteMany({ where: { userId, areaId } });
  }

  /**
   * Por cadeira com docente: media do user com esse docente (OUTRAS cadeiras
   * que partilham o nome, sem maiusculas/espacos) vs nas restantes cadeiras.
   * Leave-one-out: a cadeira pontuada nunca entra na sua propria comparacao
   * (as mesmas notas contariam duas vezes no risco). Sem outra cadeira do
   * mesmo docente com notas, nao ha estatistica.
   * Notas normalizadas para 0-1 pela escala do programa de cada periodo, para
   * misturar programas com escalas diferentes. Cadeiras sem nota ou sem
   * termo de comparacao ficam de fora.
   */
  async teacherStatsForUser(
    userId: string,
  ): Promise<Map<string, TeacherStats>> {
    const result = new Map<string, TeacherStats>();
    const notes = await this.prisma.areaTeacherNote.findMany({
      where: { userId },
      select: { areaId: true, teacherName: true },
    });
    if (notes.length === 0) return result;

    const averages = await loadAreaGradeFractions(this.prisma, userId);

    const keyByArea = new Map(
      notes.map((n) => [n.areaId, teacherKey(n.teacherName)]),
    );
    const nameByKey = new Map<string, string>();
    for (const n of notes) {
      const key = teacherKey(n.teacherName);
      if (!nameByKey.has(key)) nameByKey.set(key, n.teacherName.trim());
    }

    for (const [areaId, key] of keyByArea) {
      const withTeacher: AreaGradeAverage[] = [];
      const others: AreaGradeAverage[] = [];
      for (const [id, avg] of averages) {
        if (id === areaId) continue;
        (keyByArea.get(id) === key ? withTeacher : others).push(avg);
      }
      if (withTeacher.length === 0 || others.length === 0) continue;
      result.set(areaId, {
        name: nameByKey.get(key) ?? key,
        avgWithTeacher: roundTo(mean(withTeacher.map((a) => a.average)), 2),
        avgOthers: roundTo(mean(others.map((a) => a.average)), 2),
        sampleWithTeacher: withTeacher.reduce((sum, a) => sum + a.count, 0),
      });
    }
    return result;
  }
}
