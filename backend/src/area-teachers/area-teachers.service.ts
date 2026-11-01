import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { accessibleAreaWhere } from '../areas/area-access';
import type { CourseRiskInput } from '../approval-rules/approval-rules.types';
import { roundTo } from '../common/round.util';
import { TEACHER_NAME_MAX_LENGTH, teacherKey } from './area-teachers.constants';
import {
  loadAreaGradeFractions,
  type AreaGradeAverage,
} from './area-grade-fractions';

export type TeacherStats = NonNullable<CourseRiskInput['teacher']>;

const mean = (values: number[]): number =>
  values.reduce((sum, v) => sum + v, 0) / values.length;

interface Spelling {
  total: number;
  names: Map<string, number>;
}

function addSpelling(
  perKey: Map<string, Spelling>,
  name: string,
  n: number,
): void {
  const key = teacherKey(name);
  const entry = perKey.get(key) ?? { total: 0, names: new Map() };
  entry.total += n;
  entry.names.set(name, (entry.names.get(name) ?? 0) + n);
  perKey.set(key, entry);
}

/** Professor com mais aulas (por chave) e a sua grafia mais frequente. Empates por < simples. */
function pickTeacherName(perKey: Map<string, Spelling>): string {
  let bestKey = '';
  let best: Spelling | null = null;
  for (const [key, spelling] of perKey) {
    if (
      !best ||
      spelling.total > best.total ||
      (spelling.total === best.total && key < bestKey)
    ) {
      best = spelling;
      bestKey = key;
    }
  }
  let name = '';
  let top = -1;
  for (const [n, count] of best?.names ?? []) {
    if (count > top || (count === top && n < name)) {
      name = n;
      top = count;
    }
  }
  return name;
}

@Injectable()
export class AreaTeachersService {
  private readonly logger = new Logger(AreaTeachersService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Sincronizacao best-effort: uma falha nunca impede a leitura. Regista uma
   * mensagem generica (sem o objeto de erro, que pode trazer dados do user).
   */
  async syncFromScheduleSafe(userId: string): Promise<void> {
    try {
      await this.syncFromSchedule(userId);
    } catch {
      this.logger.warn(
        'Teacher sync from schedule failed; reading stored notes.',
      );
    }
  }

  /** Notas de docente do user (so as dele, nunca de outros). */
  async list(userId: string) {
    await this.syncFromScheduleSafe(userId);
    return this.prisma.areaTeacherNote.findMany({
      where: { userId },
      select: { areaId: true, teacherName: true, autoFromSchedule: true },
    });
  }

  /**
   * Preenche o docente a partir do horario: por cadeira ligada ao horario
   * (AreaScheduleLink), o professor mais frequente das aulas do user cuja
   * disciplina esta ligada. Sem nota -> cria (autoFromSchedule=true); nota
   * automatica -> atualiza se o nome mudou; nota manual NUNCA e tocada.
   * Apagar uma nota automatica e permitido, mas volta a ser criada na
   * proxima sincronizacao, a nao ser que o user grave um valor manual.
   * Consultas em lote (sem N+1): ligacoes, contagens por (disciplina,
   * professor) e notas existentes.
   */
  async syncFromSchedule(userId: string): Promise<void> {
    const links = await this.prisma.areaScheduleLink.findMany({
      where: { userId },
      select: { areaId: true, scheduleSubject: true },
    });

    const subjects = [...new Set(links.map((l) => l.scheduleSubject))];
    const counts =
      subjects.length === 0
        ? []
        : await this.prisma.classOccurrence.groupBy({
            by: ['subject', 'professor'],
            where: {
              userId,
              subject: { in: subjects },
              professor: { not: null },
            },
            _count: { _all: true },
          });
    const notes = await this.prisma.areaTeacherNote.findMany({
      where: { userId },
      select: { areaId: true, teacherName: true, autoFromSchedule: true },
    });

    // subject -> (chave do professor -> grafias e n.o de aulas)
    const bySubject = new Map<string, Map<string, Spelling>>();
    for (const row of counts) {
      const name = row.professor?.trim().slice(0, TEACHER_NAME_MAX_LENGTH);
      if (!name) continue;
      const perKey = bySubject.get(row.subject) ?? new Map<string, Spelling>();
      addSpelling(perKey, name, row._count._all);
      bySubject.set(row.subject, perKey);
    }

    // areaId -> professor mais frequente (agrupado por teacherKey).
    const totals = new Map<string, Map<string, Spelling>>();
    for (const { areaId, scheduleSubject } of links) {
      const perKey = bySubject.get(scheduleSubject);
      if (!perKey) continue;
      const acc = totals.get(areaId) ?? new Map<string, Spelling>();
      for (const spelling of perKey.values())
        for (const [name, n] of spelling.names) addSpelling(acc, name, n);
      totals.set(areaId, acc);
    }
    const noteByArea = new Map(notes.map((n) => [n.areaId, n]));
    const toCreate: { userId: string; areaId: string; teacherName: string }[] =
      [];
    const toUpdate: { areaId: string; teacherName: string }[] = [];
    for (const [areaId, perKey] of totals) {
      const teacherName = pickTeacherName(perKey);
      const existing = noteByArea.get(areaId);
      if (!existing) toCreate.push({ userId, areaId, teacherName });
      else if (
        existing.autoFromSchedule &&
        existing.teacherName !== teacherName
      )
        toUpdate.push({ areaId, teacherName });
    }
    // Nota automatica sem aulas correspondentes ja nao tem origem: apaga.
    const staleAreaIds = notes
      .filter((n) => n.autoFromSchedule && !totals.has(n.areaId))
      .map((n) => n.areaId);
    if (
      toCreate.length === 0 &&
      toUpdate.length === 0 &&
      staleAreaIds.length === 0
    )
      return;

    await this.prisma.$transaction([
      ...(toCreate.length
        ? [
            this.prisma.areaTeacherNote.createMany({
              data: toCreate.map((c) => ({ ...c, autoFromSchedule: true })),
              skipDuplicates: true,
            }),
          ]
        : []),
      ...toUpdate.map(({ areaId, teacherName }) =>
        // O filtro autoFromSchedule protege contra uma edicao manual em corrida.
        this.prisma.areaTeacherNote.updateMany({
          where: { userId, areaId, autoFromSchedule: true },
          data: { teacherName },
        }),
      ),
      ...(staleAreaIds.length
        ? [
            this.prisma.areaTeacherNote.deleteMany({
              where: {
                userId,
                autoFromSchedule: true,
                areaId: { in: staleAreaIds },
              },
            }),
          ]
        : []),
    ]);
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
      create: { userId, areaId, teacherName, autoFromSchedule: false },
      update: { teacherName, autoFromSchedule: false },
      select: { areaId: true, teacherName: true, autoFromSchedule: true },
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
    await this.syncFromScheduleSafe(userId);
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
